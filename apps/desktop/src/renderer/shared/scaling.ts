import type { AppPreferences, HudScale, InterfaceScale } from "@apexhud/protocol";

export const INTERFACE_SCALE_OPTIONS: ReadonlyArray<InterfaceScale> = [
  "auto",
  1,
  1.25,
  1.5,
  1.75,
  2,
];

export const HUD_SCALE_OPTIONS: ReadonlyArray<HudScale> = [
  0.75,
  1,
  1.25,
  1.5,
  1.75,
  2,
];

export interface ScaleEnvironment {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}

export function resolveInterfaceScale(
  preference: AppPreferences["interfaceScale"],
  environment: ScaleEnvironment = currentScaleEnvironment(),
): number {
  if (preference !== "auto") return clampScale(preference, 1, 2);

  const dpr = clampScale(environment.devicePixelRatio, 1, 4);
  const physicalLongEdge = Math.max(environment.cssWidth, environment.cssHeight) * dpr;
  const cssLongEdge = Math.max(environment.cssWidth, environment.cssHeight);

  // Windows already enlarges CSS pixels when display scaling is enabled.
  // Add extra scale only when the effective UI would otherwise remain small.
  if (dpr >= 1.45) return 1;
  if (physicalLongEdge >= 3600) return 1.5;
  if (physicalLongEdge >= 2500 || cssLongEdge >= 2500) return 1.25;
  return 1;
}

export function resolveHudScale(value: AppPreferences["hudScale"]): number {
  return clampScale(Number(value), 0.75, 2);
}

export function applyInterfaceScale(preferences: AppPreferences): number {
  const resolved = resolveInterfaceScale(preferences.interfaceScale);
  document.documentElement.style.setProperty("--interface-scale", String(resolved));
  document.documentElement.dataset.interfaceScale = String(resolved);
  return resolved;
}

export function currentScaleEnvironment(): ScaleEnvironment {
  return {
    cssWidth: Math.max(1, window.screen?.width ?? window.innerWidth),
    cssHeight: Math.max(1, window.screen?.height ?? window.innerHeight),
    devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
  };
}

export function formatScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

function clampScale(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
