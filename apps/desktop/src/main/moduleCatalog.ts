import { app, protocol } from "electron";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  validateModuleManifest,
  type DiscoveredModule,
  type ModuleManifest,
  type ModuleSource,
} from "@apexhud/protocol";

interface ModuleRoot {
  root: string;
  source: "built-in" | "user";
}

const PREVIEW_CANDIDATES = [
  "preview.webp",
  "preview.png",
  "preview.jpg",
  "preview.jpeg",
  path.join("assets", "preview.webp"),
  path.join("assets", "preview.png"),
  path.join("assets", "preview.jpg"),
  path.join("assets", "preview.jpeg"),
];

export class ModuleCatalog {
  private readonly moduleRoots = new Map<string, string>();
  private modules: DiscoveredModule[] = [];

  public get userModulesPath(): string {
    return path.join(app.getPath("userData"), "modules");
  }

  public async reload(): Promise<DiscoveredModule[]> {
    this.moduleRoots.clear();
    await mkdir(this.userModulesPath, { recursive: true });

    const roots: ModuleRoot[] = [
      { root: this.builtInModulesPath(), source: "built-in" },
      { root: this.userModulesPath, source: "user" },
    ];

    const discovered = new Map<string, DiscoveredModule>();

    for (const root of roots) {
      for (const module of await this.scanRoot(root)) {
        if (discovered.has(module.manifest.id)) {
          console.warn(
            `[modules] duplicate module id "${module.manifest.id}" ignored from ${module.source}`,
          );
          continue;
        }

        discovered.set(module.manifest.id, module);
      }
    }

    this.modules = [...discovered.values()].sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );

    return this.list();
  }

  public list(): DiscoveredModule[] {
    return structuredClone(this.modules);
  }

  public registerProtocolHandler(): void {
    protocol.handle("apex-module", async (request) => {
      try {
        const url = new URL(request.url);
        const moduleId = url.hostname;
        const root = this.moduleRoots.get(moduleId);
        if (!root) {
          return new Response("Module not found", { status: 404 });
        }

        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        const candidate = path.resolve(root, relative);
        const normalizedRoot = path.resolve(root) + path.sep;

        if (
          candidate !== path.resolve(root) &&
          !candidate.startsWith(normalizedRoot)
        ) {
          return new Response("Invalid module path", { status: 403 });
        }

        const file = await stat(candidate);
        if (!file.isFile()) {
          return new Response("Module asset not found", { status: 404 });
        }

        const body = new Uint8Array(await readFile(candidate));
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType(candidate),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        console.error("[modules] protocol error", error);
        return new Response("Module load error", { status: 500 });
      }
    });
  }

  private async scanRoot(root: ModuleRoot): Promise<DiscoveredModule[]> {
    let directories;
    try {
      directories = await readdir(root.root, { withFileTypes: true });
    } catch {
      return [];
    }

    const result: DiscoveredModule[] = [];
    for (const directory of directories) {
      if (!directory.isDirectory() || directory.name.startsWith("_")) {
        continue;
      }

      const moduleRoot = path.join(root.root, directory.name);
      const manifest = await this.readManifest(moduleRoot);
      if (!manifest) {
        continue;
      }

      const entryPath = path.join(moduleRoot, manifest.entry);
      try {
        const entry = await stat(entryPath);
        if (!entry.isFile()) {
          throw new Error("entry is not a file");
        }
      } catch {
        console.warn(
          `[modules] ${manifest.id} skipped: entry "${manifest.entry}" is missing`,
        );
        continue;
      }

      this.moduleRoots.set(manifest.id, moduleRoot);
      const previewRelative = await findPreview(moduleRoot);
      result.push({
        manifest,
        url: moduleAssetUrl(manifest.id, manifest.entry),
        source: await this.moduleSource(root, moduleRoot, directory.name),
        ...(previewRelative
          ? { previewUrl: moduleAssetUrl(manifest.id, previewRelative) }
          : {}),
      });
    }

    return result;
  }

  private async moduleSource(
    root: ModuleRoot,
    moduleRoot: string,
    directoryName: string,
  ): Promise<ModuleSource> {
    if (root.source === "built-in") return "built-in";
    if (directoryName.startsWith("community-")) return "community";
    try {
      const marker = await stat(path.join(moduleRoot, ".apexhud-community.json"));
      if (marker.isFile()) return "community";
    } catch {
      // A manually copied module has no community marker.
    }
    return "local";
  }

  private async readManifest(
    moduleRoot: string,
  ): Promise<ModuleManifest | undefined> {
    try {
      const raw = await readFile(path.join(moduleRoot, "manifest.json"), "utf8");
      const parsed: unknown = JSON.parse(raw);
      const validation = validateModuleManifest(parsed);
      if (!validation.valid) {
        console.warn(
          `[modules] invalid manifest in ${moduleRoot}: ${validation.errors.join("; ")}`,
        );
        return undefined;
      }

      return parsed as ModuleManifest;
    } catch (error) {
      console.warn(`[modules] cannot read manifest in ${moduleRoot}`, error);
      return undefined;
    }
  }

  private builtInModulesPath(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, "modules")
      : path.resolve(app.getAppPath(), "../../modules");
  }
}

async function findPreview(moduleRoot: string): Promise<string | undefined> {
  for (const relative of PREVIEW_CANDIDATES) {
    try {
      const candidate = path.join(moduleRoot, relative);
      const info = await stat(candidate);
      if (info.isFile()) return relative.replaceAll(path.sep, "/");
    } catch {
      // Try the next supported preview name.
    }
  }
  return undefined;
}

function moduleAssetUrl(moduleId: string, relative: string): string {
  const encoded = relative
    .replaceAll("\\", "/")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `apex-module://${moduleId}/${encoded}`;
}

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}
