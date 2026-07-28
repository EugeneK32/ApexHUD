import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  HOTKEY_ACTIONS,
  type AppLocale,
  type AppPreferences,
  type HotkeyAction,
  type HotkeyMap,
  type HudScale,
  type InterfaceScale,
  type OverlayAutoHideMode,
} from "@apexhud/protocol";

export const DEFAULT_COMMUNITY_REPOSITORY =
  "https://github.com/EugeneK32/apexhud-community-modules.git";

export const DEFAULT_HOTKEYS: HotkeyMap = {
  editLayout: "CommandOrControl+Shift+F10",
  toggleOverlay: "CommandOrControl+Shift+F11",
  openControlCenter: "CommandOrControl+Shift+F12",
};

const LEGACY_COMMUNITY_REPOSITORIES = new Set([
  "https://github.com/apexhud/community-modules.git",
  "https://github.com/apexhud/community-modules",
]);

const DEFAULTS: AppPreferences = {
  schemaVersion: 5,
  locale: "en",
  interfaceScale: "auto",
  hudScale: "interface",
  overlayAutoHideMode: "not-foreground",
  communityRepositoryUrl: DEFAULT_COMMUNITY_REPOSITORY,
  communityBranch: "main",
  autoCheckCommunityUpdates: true,
  hotkeys: structuredClone(DEFAULT_HOTKEYS),
};

export class PreferencesStore {
  private cached: AppPreferences | undefined;

  public async get(): Promise<AppPreferences> {
    if (this.cached) return structuredClone(this.cached);

    try {
      const raw = await readFile(this.path(), "utf8");
      const parsed = JSON.parse(raw) as Partial<AppPreferences>;
      const sanitized = sanitizePreferences(parsed);
      const unchanged = JSON.stringify(parsed) === JSON.stringify(sanitized);
      this.cached = unchanged ? sanitized : await this.save(sanitized);
    } catch {
      const defaults = structuredClone(DEFAULTS);
      defaults.locale = sanitizeLocale(undefined);
      this.cached = await this.save(defaults);
    }

    return structuredClone(this.cached ?? DEFAULTS);
  }

  public async save(preferences: AppPreferences): Promise<AppPreferences> {
    const sanitized = sanitizePreferences(preferences);
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

export function sanitizePreferences(value: Partial<AppPreferences>): AppPreferences {
  const allowed = new Set<OverlayAutoHideMode>([
    "not-foreground",
    "minimized",
    "never",
  ]);

  return {
    schemaVersion: 5,
    locale: sanitizeLocale(value.locale),
    interfaceScale: sanitizeInterfaceScale(value.interfaceScale),
    hudScale: sanitizeHudScale(value.hudScale),
    overlayAutoHideMode: allowed.has(value?.overlayAutoHideMode as OverlayAutoHideMode)
      ? value.overlayAutoHideMode as OverlayAutoHideMode
      : DEFAULTS.overlayAutoHideMode,
    communityRepositoryUrl: sanitizeRepository(value.communityRepositoryUrl),
    communityBranch: sanitizeBranch(value.communityBranch),
    autoCheckCommunityUpdates:
      typeof value.autoCheckCommunityUpdates === "boolean"
        ? value.autoCheckCommunityUpdates
        : DEFAULTS.autoCheckCommunityUpdates,
    hotkeys: sanitizeHotkeys(value.hotkeys),
  };
}


function sanitizeInterfaceScale(value: unknown): InterfaceScale {
  if (value === "auto") return value;
  return [1, 1.25, 1.5, 1.75, 2].includes(value as number)
    ? value as InterfaceScale
    : DEFAULTS.interfaceScale;
}

function sanitizeHudScale(value: unknown): HudScale {
  if (value === "interface") return value;
  return [0.75, 1, 1.25, 1.5, 1.75, 2].includes(value as number)
    ? value as HudScale
    : DEFAULTS.hudScale;
}

function sanitizeHotkeys(value: unknown): HotkeyMap {
  const source = value && typeof value === "object"
    ? value as Partial<Record<HotkeyAction, unknown>>
    : {};
  const used = new Set<string>();
  const result = {} as HotkeyMap;

  for (const action of HOTKEY_ACTIONS) {
    const preferred = sanitizeAccelerator(source[action]);
    const candidate = preferred && !used.has(preferred.toLowerCase())
      ? preferred
      : firstAvailableDefault(action, used);
    result[action] = candidate;
    used.add(candidate.toLowerCase());
  }

  return result;
}


function firstAvailableDefault(
  action: HotkeyAction,
  used: ReadonlySet<string>,
): string {
  const candidates = [
    DEFAULT_HOTKEYS[action],
    ...HOTKEY_ACTIONS.map((candidate) => DEFAULT_HOTKEYS[candidate]),
  ];
  return candidates.find((candidate) => !used.has(candidate.toLowerCase()))
    ?? DEFAULT_HOTKEYS[action];
}

function sanitizeAccelerator(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 80);
  if (!trimmed || !/^[a-zA-Z0-9+_-]+$/.test(trimmed)) return undefined;
  const parts = trimmed.split("+").filter(Boolean);
  if (parts.length === 0) return undefined;
  const hasModifier = parts.some((part) =>
    ["commandorcontrol", "command", "control", "ctrl", "alt", "option", "shift", "super", "meta"]
      .includes(part.toLowerCase()),
  );
  const finalKey = parts.at(-1) ?? "";
  const standaloneFunctionKey = /^f(?:[1-9]|1[0-9]|2[0-4])$/i.test(finalKey);
  return hasModifier || standaloneFunctionKey ? trimmed : undefined;
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
