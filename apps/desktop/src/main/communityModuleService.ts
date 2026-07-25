import { app } from "electron";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  validateModuleManifest,
  type AppPreferences,
  type CommunityCatalogState,
  type CommunityModuleEntry,
  type ModuleManifest,
} from "@apexhud/protocol";
import type { ModuleCatalog } from "./moduleCatalog.js";

const execFileAsync = promisify(execFile);
const MAX_PREVIEW_BYTES = 2_500_000;

export class CommunityModuleService {
  private state: CommunityCatalogState = emptyState();
  private entryRoots = new Map<string, string>();
  private refreshPromise: Promise<CommunityCatalogState> | undefined;

  public constructor(private readonly modules: ModuleCatalog) {}

  public get cached(): CommunityCatalogState {
    return structuredClone(this.state);
  }

  public async refresh(preferences: AppPreferences): Promise<CommunityCatalogState> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshInternal(preferences).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  public async install(
    moduleId: string,
    preferences: AppPreferences,
  ): Promise<CommunityCatalogState> {
    if (!this.entryRoots.has(moduleId)) {
      await this.refresh(preferences);
    }
    const source = this.entryRoots.get(moduleId);
    const entry = this.state.entries.find((item) => item.id === moduleId);
    if (!source || !entry) throw new Error(`Community module ${moduleId} was not found`);

    const destination = path.join(this.modules.userModulesPath, safeDirectoryName(moduleId));
    const temporary = `${destination}.installing`;
    await mkdir(this.modules.userModulesPath, { recursive: true });
    await rm(temporary, { recursive: true, force: true });
    try {
      await cp(source, temporary, {
        recursive: true,
        force: true,
        filter: (candidate: string) =>
          !candidate.split(path.sep).some((part: string) => part === ".git"),
      });
      await writeFile(
        path.join(temporary, ".apexhud-community.json"),
        JSON.stringify({
          moduleId: entry.id,
          repositoryUrl: preferences.communityRepositoryUrl,
          installedVersion: entry.version,
          installedAt: new Date().toISOString(),
        }, null, 2),
        "utf8",
      );
      await rm(destination, { recursive: true, force: true });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    await this.modules.reload();
    return this.rescanInstalled(preferences);
  }

  public async uninstall(
    moduleId: string,
    preferences: AppPreferences,
  ): Promise<CommunityCatalogState> {
    const destination = path.join(this.modules.userModulesPath, safeDirectoryName(moduleId));
    await rm(destination, { recursive: true, force: true });
    await this.modules.reload();
    return this.rescanInstalled(preferences);
  }

  private async refreshInternal(preferences: AppPreferences): Promise<CommunityCatalogState> {
    const git = await this.resolveGit();
    if (!git) {
      this.state = {
        ...emptyState(preferences),
        error: "Git was not found. Install Git for Windows or place portable Git in bin/git.",
      };
      return this.cached;
    }

    try {
      const gitVersion = (await this.runGit(git, ["--version"])).trim();
      const repository = this.repositoryPath();
      await this.syncRepository(git, repository, preferences);
      const commit = (await this.runGit(git, ["-C", repository, "rev-parse", "HEAD"])).trim();
      const entries = await this.scanRepository(repository);
      this.state = {
        repositoryUrl: preferences.communityRepositoryUrl,
        branch: preferences.communityBranch,
        gitAvailable: true,
        gitVersion,
        lastUpdatedAt: new Date().toISOString(),
        repositoryCommit: commit,
        entries,
        error: "",
      };
      return this.cached;
    } catch (error) {
      this.state = {
        ...this.state,
        repositoryUrl: preferences.communityRepositoryUrl,
        branch: preferences.communityBranch,
        gitAvailable: true,
        lastUpdatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
      return this.cached;
    }
  }

  private async rescanInstalled(preferences: AppPreferences): Promise<CommunityCatalogState> {
    const undecorated = this.state.entries.map((item) => {
      const { installedVersion: _installedVersion, ...entry } = item;
      return entry;
    });
    const entries = await this.decorateInstalled(undecorated);
    this.state = {
      ...this.state,
      repositoryUrl: preferences.communityRepositoryUrl,
      branch: preferences.communityBranch,
      entries,
    };
    return this.cached;
  }

  private async syncRepository(
    git: string,
    repository: string,
    preferences: AppPreferences,
  ): Promise<void> {
    const gitDirectory = path.join(repository, ".git");
    if (!(await exists(gitDirectory))) {
      await rm(repository, { recursive: true, force: true });
      await mkdir(path.dirname(repository), { recursive: true });
      await this.runGit(git, [
        "clone",
        "--depth",
        "1",
        "--recurse-submodules",
        "--shallow-submodules",
        "--branch",
        preferences.communityBranch,
        preferences.communityRepositoryUrl,
        repository,
      ], 180_000);
      return;
    }

    await this.runGit(git, [
      "-C",
      repository,
      "remote",
      "set-url",
      "origin",
      preferences.communityRepositoryUrl,
    ]);
    await this.runGit(git, [
      "-C",
      repository,
      "fetch",
      "--depth",
      "1",
      "origin",
      preferences.communityBranch,
    ], 120_000);
    await this.runGit(git, [
      "-C",
      repository,
      "submodule",
      "deinit",
      "--all",
      "--force",
    ]);
    await this.runGit(git, [
      "-C",
      repository,
      "checkout",
      "-B",
      preferences.communityBranch,
      `origin/${preferences.communityBranch}`,
    ]);
    await this.runGit(git, [
      "-C",
      repository,
      "reset",
      "--hard",
      `origin/${preferences.communityBranch}`,
    ]);
    await this.runGit(git, ["-C", repository, "clean", "-ffd"]);
    await this.runGit(git, ["-C", repository, "submodule", "sync", "--recursive"]);
    await this.runGit(git, [
      "-C",
      repository,
      "submodule",
      "update",
      "--init",
      "--recursive",
      "--depth",
      "1",
    ], 180_000);
  }

  private async scanRepository(repository: string): Promise<CommunityModuleEntry[]> {
    this.entryRoots.clear();
    const roots = [repository, path.join(repository, "modules")];
    const entries: CommunityModuleEntry[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!(await exists(root))) continue;
      for (const directory of await readdir(root, { withFileTypes: true })) {
        if (!directory.isDirectory() || directory.name.startsWith(".")) continue;
        const moduleRoot = path.join(root, directory.name);
        const manifest = await readManifest(moduleRoot);
        if (!manifest || seen.has(manifest.id)) continue;
        seen.add(manifest.id);
        this.entryRoots.set(manifest.id, moduleRoot);
        entries.push({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author,
          sourceDirectory: directory.name,
          ...(await previewDataUrl(moduleRoot)),
          status: "available",
        });
      }
    }

    return this.decorateInstalled(entries);
  }

  private async decorateInstalled(
    entries: CommunityModuleEntry[],
  ): Promise<CommunityModuleEntry[]> {
    const installed = await installedVersions(this.modules.userModulesPath);
    return entries
      .map((entry) => {
        const installedVersion = installed.get(entry.id);
        if (!installedVersion) return { ...entry, status: "available" as const };
        return {
          ...entry,
          installedVersion,
          status: compareVersions(entry.version, installedVersion) > 0
            ? "update-available" as const
            : "installed" as const,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private async resolveGit(): Promise<string | undefined> {
    const candidates = [
      process.env.APEXHUD_GIT_PATH,
      app.isPackaged ? path.join(process.resourcesPath, "bin", "git", "cmd", "git.exe") : undefined,
      app.isPackaged ? path.join(process.resourcesPath, "bin", "git.exe") : undefined,
      path.resolve(app.getAppPath(), "../../bin/git/cmd/git.exe"),
      path.resolve(app.getAppPath(), "../../bin/git.exe"),
      "git",
    ].filter((item): item is string => Boolean(item));

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, ["--version"], {
          windowsHide: true,
          timeout: 8_000,
        });
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
    return undefined;
  }

  private async runGit(
    executable: string,
    arguments_: string[],
    timeout = 60_000,
  ): Promise<string> {
    const result = await execFileAsync(executable, arguments_, {
      windowsHide: true,
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
      },
    });
    return String(result.stdout ?? "");
  }

  private repositoryPath(): string {
    return path.join(app.getPath("userData"), "community-catalog");
  }
}

async function readManifest(moduleRoot: string): Promise<ModuleManifest | undefined> {
  try {
    const raw = await readFile(path.join(moduleRoot, "manifest.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const validation = validateModuleManifest(parsed);
    return validation.valid ? parsed as ModuleManifest : undefined;
  } catch {
    return undefined;
  }
}

async function previewDataUrl(
  moduleRoot: string,
): Promise<{ previewDataUrl?: string }> {
  const candidates = [
    "preview.webp",
    "preview.png",
    "preview.jpg",
    "preview.jpeg",
    path.join("assets", "preview.webp"),
    path.join("assets", "preview.png"),
    path.join("assets", "preview.jpg"),
  ];
  for (const relative of candidates) {
    const candidate = path.join(moduleRoot, relative);
    try {
      const info = await stat(candidate);
      if (!info.isFile() || info.size > MAX_PREVIEW_BYTES) continue;
      const body = await readFile(candidate);
      const mime = extensionMime(path.extname(candidate));
      return { previewDataUrl: `data:${mime};base64,${body.toString("base64")}` };
    } catch {
      // Continue.
    }
  }
  return {};
}

async function installedVersions(root: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  let directories;
  try {
    directories = await readdir(root, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const manifest = await readManifest(path.join(root, directory.name));
    if (manifest) result.set(manifest.id, manifest.version);
  }
  return result;
}

function emptyState(preferences?: AppPreferences): CommunityCatalogState {
  return {
    repositoryUrl: preferences?.communityRepositoryUrl ?? "",
    branch: preferences?.communityBranch ?? "main",
    gitAvailable: false,
    gitVersion: "",
    lastUpdatedAt: "",
    repositoryCommit: "",
    entries: [],
    error: "",
  };
}

function safeDirectoryName(moduleId: string): string {
  return `community-${moduleId.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;
}

function extensionMime(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".webp": return "image/webp";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    default: return "image/png";
  }
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.split(/[.+-]/).map((item) => Number.parseInt(item, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}
