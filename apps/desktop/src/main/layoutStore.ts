import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LAYOUT_SCENARIOS,
  resetProfileToBase,
  sanitizeBounds,
  writeResolvedLayoutToGroup,
  type LayoutDocument,
  type LayoutGroup,
  type LayoutProfile,
  type LayoutScenario,
  type LayoutWorkspace,
  type ModuleInstance,
  type ModuleInstanceOverride,
  type SettingValue,
} from "@apexhud/protocol";
import { migrateModuleInstance } from "./layoutMigration.js";
import { factoryLayoutForScenario } from "./layoutProfiles.js";

const CURRENT_LAYOUT_MIGRATION = 11;
const DEFAULT_GROUP_ID = "default";

const PROFILE_NAMES: Record<LayoutScenario, string> = {
  default: "Base Layout",
  "test-drive": "Test drive",
  practice: "Practice",
  "time-trial": "Time trial",
  qualifying: "Qualifying",
  race: "Race",
  replay: "Replay",
};

export class LayoutStore {
  private cached: LayoutWorkspace | undefined;

  public async get(): Promise<LayoutWorkspace> {
    if (this.cached) return structuredClone(this.cached);

    try {
      const raw = await readFile(this.workspacePath(), "utf8");
      const parsed = JSON.parse(raw) as LayoutWorkspace;
      const requiresSchemaUpgrade = Number(parsed.schemaVersion ?? 0) < 3;
      this.cached = await this.applyDefaultMigrations(
        this.sanitizeWorkspace(parsed),
      );
      if (requiresSchemaUpgrade) {
        this.cached = await this.save(this.cached);
      }
    } catch {
      this.cached = await this.migrateLegacyOrDefault();
      await this.save(this.cached);
    }

    return structuredClone(this.cached);
  }

  public async save(workspace: LayoutWorkspace): Promise<LayoutWorkspace> {
    const sanitized = this.sanitizeWorkspace(workspace);
    const destination = this.workspacePath();
    const temporary = `${destination}.tmp`;

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(temporary, JSON.stringify(sanitized, null, 2), "utf8");
    await rename(temporary, destination);

    this.cached = sanitized;
    return structuredClone(sanitized);
  }

  public async resetProfile(
    groupId: string,
    scenario: LayoutScenario,
  ): Promise<LayoutWorkspace> {
    const workspace = await this.get();
    const group = workspace.groups.find((candidate) => candidate.id === groupId);
    if (!group) return workspace;

    if (scenario === "default") {
      group.profiles.default.layout = await this.readDefaultLayout();
    } else {
      resetProfileToBase(group, scenario);
    }
    return this.save(workspace);
  }

  private async migrateLegacyOrDefault(): Promise<LayoutWorkspace> {
    let workspace: LayoutWorkspace;
    try {
      const raw = await readFile(this.legacyLayoutPath(), "utf8");
      const legacy = this.sanitizeLayout(JSON.parse(raw) as LayoutDocument);
      workspace = this.workspaceFromLayout(legacy, false);
    } catch {
      const factory = await this.readDefaultLayout();
      workspace = this.workspaceFromLayout(factory, true);
    }

    workspace.migrationVersion = 0;
    return this.applyDefaultMigrations(workspace);
  }

  private async applyDefaultMigrations(
    workspace: LayoutWorkspace,
  ): Promise<LayoutWorkspace> {
    if ((workspace.migrationVersion ?? 0) >= CURRENT_LAYOUT_MIGRATION) {
      return workspace;
    }

    const defaults = await this.readDefaultLayout();
    for (const group of workspace.groups) {
      const base = group.profiles.default.layout;
      const presentModules = new Set(base.instances.map((instance) => instance.moduleId));
      const additions = defaults.instances
        .filter((instance) => !presentModules.has(instance.moduleId))
        .map((instance) => structuredClone(instance));

      group.profiles.default.layout = this.sanitizeLayout({
        ...base,
        migrationVersion: CURRENT_LAYOUT_MIGRATION,
        instances: [...base.instances, ...additions],
      });
    }

    workspace.migrationVersion = CURRENT_LAYOUT_MIGRATION;
    return this.save(workspace);
  }

  private async readDefaultLayout(): Promise<LayoutDocument> {
    const defaultPath = app.isPackaged
      ? path.join(process.resourcesPath, "config", "default-layout.json")
      : path.resolve(app.getAppPath(), "../../config/default-layout.json");

    const raw = await readFile(defaultPath, "utf8");
    return this.sanitizeLayout(JSON.parse(raw) as LayoutDocument);
  }

  private workspaceFromLayout(
    layout: LayoutDocument,
    useScenarioDefaults = false,
  ): LayoutWorkspace {
    const group = this.emptyGroup(DEFAULT_GROUP_ID, "Main", layout);

    for (const scenario of LAYOUT_SCENARIOS) {
      if (scenario === "default") continue;
      const resolved = useScenarioDefaults
        ? factoryLayoutForScenario(layout, scenario)
        : layout;
      writeResolvedLayoutToGroup(group, scenario, resolved);
    }

    return {
      schemaVersion: 3,
      migrationVersion: 0,
      activeGroupId: group.id,
      groups: [group],
    };
  }

  private sanitizeWorkspace(workspace: LayoutWorkspace): LayoutWorkspace {
    const rawGroups = Array.isArray(workspace?.groups) ? workspace.groups : [];
    const legacySchema = Number(workspace?.schemaVersion ?? 0) < 3;
    const seen = new Set<string>();

    const groups = rawGroups
      .filter((group): group is LayoutGroup => Boolean(group && typeof group === "object"))
      .map((rawGroup, index) => {
        let id = safeId(rawGroup.id, `group-${index + 1}`);
        while (seen.has(id)) id = `${id}-${index + 1}`;
        seen.add(id);

        const rawDefault = rawGroup.profiles?.default?.layout ?? emptyLayout();
        const base = this.sanitizeLayout(rawDefault);
        const group = this.emptyGroup(id, safeName(rawGroup.name, `Group ${index + 1}`), base);

        for (const scenario of LAYOUT_SCENARIOS) {
          if (scenario === "default") continue;
          const candidate = rawGroup.profiles?.[scenario];
          if (legacySchema) {
            const resolved = this.sanitizeLayout(
              candidate?.layout ?? rawGroup.profiles?.default?.layout ?? base,
            );
            writeResolvedLayoutToGroup(group, scenario, resolved);
            group.profiles[scenario].name = safeName(
              candidate?.name,
              PROFILE_NAMES[scenario],
            );
            continue;
          }

          group.profiles[scenario] = {
            scenario,
            name: safeName(candidate?.name, PROFILE_NAMES[scenario]),
            layout: this.sanitizeLayout(candidate?.layout ?? emptyLocalLayout(base)),
            hiddenBaseInstanceIds: sanitizeIds(candidate?.hiddenBaseInstanceIds),
            baseOverrides: sanitizeOverrides(candidate?.baseOverrides),
          };
        }

        return group;
      });

    if (groups.length === 0) {
      return this.workspaceFromLayout(emptyLayout());
    }

    const activeGroupId = groups.some((group) => group.id === workspace.activeGroupId)
      ? workspace.activeGroupId
      : groups[0]!.id;

    return {
      schemaVersion: 3,
      migrationVersion:
        Number.isFinite(workspace.migrationVersion) && Number(workspace.migrationVersion) >= 0
          ? Number(workspace.migrationVersion)
          : 0,
      activeGroupId,
      groups,
    };
  }

  private emptyGroup(id: string, name: string, base: LayoutDocument): LayoutGroup {
    return {
      id,
      name,
      profiles: Object.fromEntries(
        LAYOUT_SCENARIOS.map((scenario) => [
          scenario,
          scenario === "default"
            ? {
                scenario,
                name: PROFILE_NAMES[scenario],
                layout: structuredClone(base),
                hiddenBaseInstanceIds: [],
                baseOverrides: {},
              } satisfies LayoutProfile
            : {
                scenario,
                name: PROFILE_NAMES[scenario],
                layout: emptyLocalLayout(base),
                hiddenBaseInstanceIds: [],
                baseOverrides: {},
              } satisfies LayoutProfile,
        ]),
      ) as unknown as Record<LayoutScenario, LayoutProfile>,
    };
  }

  private sanitizeLayout(layout: LayoutDocument): LayoutDocument {
    const instances = Array.isArray(layout?.instances)
      ? layout.instances
          .filter((instance): instance is ModuleInstance =>
            Boolean(
              instance &&
                typeof instance.instanceId === "string" &&
                typeof instance.moduleId === "string" &&
                instance.bounds,
            ),
          )
          .map((instance, index) =>
            migrateModuleInstance({
              ...instance,
              enabled: instance.enabled !== false,
              zIndex: Number.isFinite(instance.zIndex) ? instance.zIndex : index + 1,
              bounds: sanitizeBounds(instance.bounds),
              settings:
                instance.settings && typeof instance.settings === "object"
                  ? instance.settings
                  : {},
            }),
          )
      : [];

    return {
      schemaVersion: 1,
      ...(Number.isFinite(layout?.migrationVersion) && Number(layout.migrationVersion) >= 0
        ? { migrationVersion: Number(layout.migrationVersion) }
        : {}),
      display: typeof layout?.display === "string" ? layout.display : "primary",
      snapGrid:
        Number.isFinite(layout?.snapGrid) && layout.snapGrid > 0
          ? Math.min(64, Math.max(1, layout.snapGrid))
          : 8,
      instances,
    };
  }

  private workspacePath(): string {
    return path.join(app.getPath("userData"), "layouts.json");
  }

  private legacyLayoutPath(): string {
    return path.join(app.getPath("userData"), "layout.json");
  }
}

function emptyLayout(): LayoutDocument {
  return {
    schemaVersion: 1,
    migrationVersion: 0,
    display: "primary",
    snapGrid: 8,
    instances: [],
  };
}

function emptyLocalLayout(base: LayoutDocument): LayoutDocument {
  return {
    schemaVersion: 1,
    ...(base.migrationVersion === undefined ? {} : { migrationVersion: base.migrationVersion }),
    display: base.display,
    snapGrid: base.snapGrid,
    instances: [],
  };
}

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function sanitizeOverrides(value: unknown): Record<string, ModuleInstanceOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, ModuleInstanceOverride> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as Record<string, unknown>;
    const override: ModuleInstanceOverride = {};
    if (typeof candidate.enabled === "boolean") override.enabled = candidate.enabled;
    if (Number.isFinite(candidate.zIndex)) override.zIndex = Number(candidate.zIndex);
    if (candidate.bounds && typeof candidate.bounds === "object") {
      override.bounds = sanitizeBounds(candidate.bounds as ModuleInstance["bounds"]);
    }
    if (candidate.settings && typeof candidate.settings === "object" && !Array.isArray(candidate.settings)) {
      const settings: Record<string, SettingValue> = {};
      for (const [key, setting] of Object.entries(candidate.settings)) {
        if (["string", "number", "boolean"].includes(typeof setting)) {
          settings[key] = setting as SettingValue;
        }
      }
      if (Object.keys(settings).length > 0) override.settings = settings;
    }
    if (Object.keys(override).length > 0) result[id] = override;
  }
  return result;
}

function safeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, 60);
  return trimmed || fallback;
}

function safeId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return normalized || fallback;
}
