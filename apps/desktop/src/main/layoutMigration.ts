import type { ModuleInstance, SettingValue } from "@apexhud/protocol";

const LEGACY_RADAR_BOUNDS = {
  x: 0.405,
  y: 0.635,
  width: 0.19,
  height: 0.3,
};

const PREVIOUS_RADAR_BOUNDS = {
  x: 0.43,
  y: 0.69,
  width: 0.14,
  height: 0.18,
};

const MINIMAL_RADAR_BOUNDS = {
  x: 0.445,
  y: 0.72,
  width: 0.11,
  height: 0.14,
};

const COMPACT_RADAR_BOUNDS = {
  x: 0.46,
  y: 0.74,
  width: 0.08,
  height: 0.10,
};

const LEGACY_INPUTS_BOUNDS = {
  x: 0.315,
  y: 0.79,
  width: 0.11,
  height: 0.17,
};

const TRACE_INPUTS_BOUNDS = {
  x: 0.30,
  y: 0.79,
  width: 0.19,
  height: 0.17,
};

const NON_OVERLAPPING_INPUTS_BOUNDS = {
  x: 0.16,
  y: 0.79,
  width: 0.19,
  height: 0.17,
};

interface SettingMigration {
  key: string;
  from?: SettingValue;
  to: SettingValue;
  addWhenMissing?: boolean;
}

const VISUAL_SETTING_MIGRATIONS: Record<string, SettingMigration[]> = {
  "com.apexhud.radar": [
    { key: "accent", from: "#8bf7ff", to: "#e5e7eb" },
    { key: "danger", from: "#ff4868", to: "#ef4444" },
    { key: "opacity", from: 0.86, to: 0.94 },
    { key: "nearby", to: "#f2c94c", addWhenMissing: true },
  ],
  "com.apexhud.standings": [
    { key: "accent", from: "#8bf7ff", to: "#f2c94c" },
    { key: "mode", from: "overall", to: "auto" },
  ],
  "com.apexhud.relative": [
    { key: "accent", from: "#8bf7ff", to: "#179fc4" },
    { key: "opacity", from: 0.88, to: 0.9 },
    { key: "hideWhenEmpty", to: true, addWhenMissing: true },
  ],
  "com.apexhud.delta": [
    { key: "gainColor", from: "#58f59a", to: "#36c96b" },
    { key: "lossColor", from: "#ff536f", to: "#ef4444" },
  ],
  "com.apexhud.dashboard": [
    { key: "accent", from: "#8bf7ff", to: "#f2f2f2" },
    { key: "warningColor", to: "#f2c94c", addWhenMissing: true },
    { key: "shiftColor", from: "#ff526d", to: "#ef4444" },
    { key: "downshiftColor", to: "#54a9d1", addWhenMissing: true },
    { key: "opacity", from: 0.88, to: 0.9 },
  ],
  "com.apexhud.position": [
    { key: "mode", to: "auto", addWhenMissing: true },
  ],
  "com.apexhud.inputs": [
    { key: "throttleColor", from: "#55e892", to: "#42d36f" },
    { key: "throttleColor", from: "#36c96b", to: "#42d36f" },
    { key: "brakeColor", from: "#ff536f", to: "#ff5252" },
    { key: "brakeColor", from: "#ef4444", to: "#ff5252" },
    { key: "clutchColor", to: "#d8dde5", addWhenMissing: true },
    { key: "showClutch", to: true, addWhenMissing: true },
    { key: "historySeconds", to: 4, addWhenMissing: true },
    { key: "lineWidth", to: 1.8, addWhenMissing: true },
    { key: "opacity", from: 0.76, to: 0.84 },
    { key: "opacity", from: 0.82, to: 0.84 },
  ],
  "com.apexhud.fuel": [
    { key: "accent", from: "#ffbf69", to: "#f2c94c" },
    { key: "opacity", from: 0.88, to: 0.9 },
  ],
  "com.apexhud.session": [
    { key: "accent", from: "#8bf7ff", to: "#179fc4" },
    { key: "opacity", from: 0.86, to: 0.9 },
  ],
};

export function migrateModuleInstance(instance: ModuleInstance): ModuleInstance {
  const shouldResizeRadar =
    instance.moduleId === "com.apexhud.radar" &&
    (sameBounds(instance.bounds, LEGACY_RADAR_BOUNDS) ||
      sameBounds(instance.bounds, PREVIOUS_RADAR_BOUNDS) ||
      sameBounds(instance.bounds, MINIMAL_RADAR_BOUNDS));
  const shouldResizeInputs =
    instance.moduleId === "com.apexhud.inputs" &&
    sameBounds(instance.bounds, LEGACY_INPUTS_BOUNDS);
  const shouldMoveStockInputs =
    instance.moduleId === "com.apexhud.inputs" &&
    sameBounds(instance.bounds, TRACE_INPUTS_BOUNDS);
  const bounds = shouldResizeRadar
    ? { ...COMPACT_RADAR_BOUNDS }
    : shouldResizeInputs || shouldMoveStockInputs
      ? { ...NON_OVERLAPPING_INPUTS_BOUNDS }
      : instance.bounds;

  const migrations = VISUAL_SETTING_MIGRATIONS[instance.moduleId] ?? [];
  const settings = { ...instance.settings };
  let settingsChanged = false;

  // The old factory standings preset was information-dense rather than
  // glanceable. Only migrate the untouched stock combination; individually
  // customised leaderboards keep the user's choices.
  if (
    instance.moduleId === "com.apexhud.standings" &&
    settings.rows === 16 &&
    settings.showIRating === true &&
    settings.showLicense === true &&
    settings.showLastLap === true &&
    settings.compact === false
  ) {
    settings.rows = 12;
    settings.showIRating = false;
    settings.showLicense = false;
    settings.showLastLap = false;
    settingsChanged = true;
  }

  for (const migration of migrations) {
    const current = settings[migration.key];
    if (
      (migration.addWhenMissing && current === undefined) ||
      (migration.from !== undefined && current === migration.from)
    ) {
      settings[migration.key] = migration.to;
      settingsChanged = true;
    }
  }

  if (
    shouldResizeRadar &&
    instance.moduleId === "com.apexhud.radar" &&
    settings.showApproach === true
  ) {
    settings.showApproach = false;
    settingsChanged = true;
  }

  if (!shouldResizeRadar && !shouldResizeInputs && !shouldMoveStockInputs && !settingsChanged) {
    return instance;
  }

  return { ...instance, bounds, settings };
}

function sameBounds(
  left: ModuleInstance["bounds"],
  right: ModuleInstance["bounds"],
): boolean {
  const epsilon = 0.000_001;
  return (
    Math.abs(left.x - right.x) <= epsilon &&
    Math.abs(left.y - right.y) <= epsilon &&
    Math.abs(left.width - right.width) <= epsilon &&
    Math.abs(left.height - right.height) <= epsilon
  );
}
