import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppLocale,
  AppPreferences,
  OverlayAutoHideMode,
} from "@apexhud/protocol";

export const DEFAULT_COMMUNITY_REPOSITORY =
  "https://github.com/EugeneK32/apexhud-community-modules.git";

const LEGACY_COMMUNITY_REPOSITORIES = new Set([
  "https://github.com/apexhud/community-modules.git",
  "https://github.com/apexhud/community-modules",
]);

const DEFAULTS: AppPreferences = {
  schemaVersion: 3,
  locale: "en",
  overlayAutoHideMode: "not-foreground",
  communityRepositoryUrl: DEFAULT_COMMUNITY_REPOSITORY,
  communityBranch: "main",
  autoCheckCommunityUpdates: true,
};

export class PreferencesStore {
  private cached: AppPreferences | undefined;

  public async get(): Promise<AppPreferences> {
    if (this.cached) return structuredClone(this.cached);

    try {
      const raw = await readFile(this.path(), "utf8");
      const parsed = JSON.parse(raw) as Partial<AppPreferences>;
      const sanitized = sanitize(parsed);
      const unchanged = parsed.schemaVersion === sanitized.schemaVersion
        && parsed.locale === sanitized.locale
        && parsed.overlayAutoHideMode === sanitized.overlayAutoHideMode
        && parsed.communityRepositoryUrl === sanitized.communityRepositoryUrl
        && parsed.communityBranch === sanitized.communityBranch
        && parsed.autoCheckCommunityUpdates === sanitized.autoCheckCommunityUpdates;
      this.cached = unchanged ? sanitized : await this.save(sanitized);
    } catch {
      const defaults = structuredClone(DEFAULTS);
      defaults.locale = sanitizeLocale(undefined);
      this.cached = await this.save(defaults);
    }

    return structuredClone(this.cached ?? DEFAULTS);
  }

  public async save(preferences: AppPreferences): Promise<AppPreferences> {
    const sanitized = sanitize(preferences);
    const destination = this.path();
    const temporary = `${destination}.tmp`;
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(temporary, JSON.stringify(sanitized, null, 2), "utf8");
    await rename(temporary, destination);
    this.cached = sanitized;
    return structuredClone(sanitized);
  }

  private path(): string {
    return path.join(app.getPath("userData"), "preferences.json");
  }
}

function sanitize(value: Partial<AppPreferences>): AppPreferences {
  const allowed = new Set<OverlayAutoHideMode>([
    "not-foreground",
    "minimized",
    "never",
  ]);

  return {
    schemaVersion: 3,
    locale: sanitizeLocale(value.locale),
    overlayAutoHideMode: allowed.has(value?.overlayAutoHideMode as OverlayAutoHideMode)
      ? value.overlayAutoHideMode as OverlayAutoHideMode
      : DEFAULTS.overlayAutoHideMode,
    communityRepositoryUrl: sanitizeRepository(value.communityRepositoryUrl),
    communityBranch: sanitizeBranch(value.communityBranch),
    autoCheckCommunityUpdates:
      typeof value.autoCheckCommunityUpdates === "boolean"
        ? value.autoCheckCommunityUpdates
        : DEFAULTS.autoCheckCommunityUpdates,
  };
}

function sanitizeRepository(value: unknown): string {
  if (typeof value !== "string") return DEFAULTS.communityRepositoryUrl;
  const trimmed = value.trim().slice(0, 500);
  if (LEGACY_COMMUNITY_REPOSITORIES.has(trimmed)) {
    return DEFAULTS.communityRepositoryUrl;
  }
  if (!/^https:\/\//i.test(trimmed) && !/^git@/i.test(trimmed)) {
    return DEFAULTS.communityRepositoryUrl;
  }
  return trimmed;
}

function sanitizeBranch(value: unknown): string {
  if (typeof value !== "string") return DEFAULTS.communityBranch;
  const trimmed = value.trim().replace(/[^a-zA-Z0-9._/-]/g, "").slice(0, 120);
  return trimmed || DEFAULTS.communityBranch;
}


function sanitizeLocale(value: unknown): AppLocale {
  const supported = new Set<AppLocale>([
    "en", "ru", "de", "fr", "es", "it", "pt-BR", "pl", "zh-CN", "ja",
  ]);
  if (supported.has(value as AppLocale)) return value as AppLocale;

  const system = app.getLocale().toLowerCase();
  if (system.startsWith("ru")) return "ru";
  if (system.startsWith("de")) return "de";
  if (system.startsWith("fr")) return "fr";
  if (system.startsWith("es")) return "es";
  if (system.startsWith("it")) return "it";
  if (system.startsWith("pt")) return "pt-BR";
  if (system.startsWith("pl")) return "pl";
  if (system.startsWith("zh")) return "zh-CN";
  if (system.startsWith("ja")) return "ja";
  return DEFAULTS.locale;
}
