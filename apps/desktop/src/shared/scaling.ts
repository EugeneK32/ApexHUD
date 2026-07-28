import type { HudScale, InterfaceScale } from "@apexhud/protocol";

export const MANUAL_INTERFACE_SCALES = [1, 1.25, 1.5, 1.75, 2] as const;
export const MANUAL_HUD_SCALES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function resolveInterfaceScale(
  preference: InterfaceScale,
  viewportWidth: number,
  viewportHeight: number,
  deviceScaleFactor: number,
): number {
  if (preference !== "auto") return clampScale(preference, 1, 2);

  // Windows/macOS scaling already makes CSS pixels larger. Only add an
  // automatic ApexHUD multiplier when the display is effectively running at
  // 100% OS scaling and therefore exposes the full high-resolution viewport.
  if (Number.isFinite(deviceScaleFactor) && deviceScaleFactor >= 1.2) return 1;

  const longEdge = Math.max(viewportWidth, viewportHeight);
  const shortEdge = Math.min(viewportWidth, viewportHeight);
  if (longEdge >= 3200 && shortEdge >= 1800) return 1.5;
  if (longEdge >= 2400 && shortEdge >= 1300) return 1.25;
  return 1;
}

export function resolveHudScale(
  preference: HudScale,
  resolvedInterfaceScale: number,
): number {
  return preference === "interface"
    ? clampScale(resolvedInterfaceScale, 0.75, 2)
    : clampScale(preference, 0.75, 2);
}

function clampScale(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(maximum, Math.max(minimum, value));
}
