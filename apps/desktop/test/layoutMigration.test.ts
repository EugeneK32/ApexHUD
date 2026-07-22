import { describe, expect, it } from "vitest";
import type { ModuleInstance } from "@apexhud/protocol";
import { migrateModuleInstance } from "../src/main/layoutMigration";

function moduleInstance(
  moduleId: string,
  bounds: ModuleInstance["bounds"],
  settings: ModuleInstance["settings"],
): ModuleInstance {
  return {
    instanceId: `${moduleId}-main`,
    moduleId,
    enabled: true,
    zIndex: 10,
    bounds,
    settings,
  };
}

describe("layout migration", () => {
  it("shrinks the untouched v0.3 radar and applies broadcast defaults", () => {
    const migrated = migrateModuleInstance(
      moduleInstance(
        "com.apexhud.radar",
        { x: 0.43, y: 0.69, width: 0.14, height: 0.18 },
        {
          accent: "#8bf7ff",
          danger: "#ff4868",
          opacity: 0.86,
          showApproach: true,
        },
      ),
    );

    expect(migrated.bounds).toEqual({
      x: 0.46,
      y: 0.74,
      width: 0.08,
      height: 0.1,
    });
    expect(migrated.settings).toMatchObject({
      accent: "#e5e7eb",
      nearby: "#f2c94c",
      danger: "#ef4444",
      opacity: 0.94,
      showApproach: false,
    });
  });

  it("also upgrades the original large radar bounds", () => {
    const migrated = migrateModuleInstance(
      moduleInstance(
        "com.apexhud.radar",
        { x: 0.405, y: 0.635, width: 0.19, height: 0.3 },
        { opacity: 0.94 },
      ),
    );

    expect(migrated.bounds).toEqual({
      x: 0.46,
      y: 0.74,
      width: 0.08,
      height: 0.1,
    });
  });


  it("shrinks the untouched v0.5 radar to the transparent compact footprint", () => {
    const migrated = migrateModuleInstance(
      moduleInstance(
        "com.apexhud.radar",
        { x: 0.445, y: 0.72, width: 0.11, height: 0.14 },
        { opacity: 0.94 },
      ),
    );

    expect(migrated.bounds).toEqual({
      x: 0.46,
      y: 0.74,
      width: 0.08,
      height: 0.1,
    });
  });

  it("preserves user-customized bounds and colors", () => {
    const customized = moduleInstance(
      "com.apexhud.radar",
      { x: 0.51, y: 0.72, width: 0.11, height: 0.16 },
      {
        accent: "#ffffff",
        nearby: "#ff8800",
        danger: "#cc0000",
        opacity: 0.72,
        showApproach: true,
      },
    );

    expect(migrateModuleInstance(customized)).toBe(customized);
  });

  it("replaces only untouched stock visual settings", () => {
    const migrated = migrateModuleInstance(
      moduleInstance(
        "com.apexhud.standings",
        { x: 0.02, y: 0.1, width: 0.3, height: 0.6 },
        { accent: "#8bf7ff", opacity: 0.72 },
      ),
    );

    expect(migrated.settings).toEqual({
      accent: "#f2c94c",
      opacity: 0.72,
    });
  });
});

it("upgrades untouched pedal bars to the wider trace graph", () => {
  const migrated = migrateModuleInstance(
    moduleInstance(
      "com.apexhud.inputs",
      { x: 0.315, y: 0.79, width: 0.11, height: 0.17 },
      {
        throttleColor: "#36c96b",
        brakeColor: "#ef4444",
        opacity: 0.82,
      },
    ),
  );

  expect(migrated.bounds).toEqual({
    x: 0.16,
    y: 0.79,
    width: 0.19,
    height: 0.17,
  });
  expect(migrated.settings).toMatchObject({
    historySeconds: 4,
    lineWidth: 1.8,
    showClutch: true,
  });
});


it("moves the untouched first trace layout away from the dashboard", () => {
  const migrated = migrateModuleInstance(
    moduleInstance(
      "com.apexhud.inputs",
      { x: 0.3, y: 0.79, width: 0.19, height: 0.17 },
      { historySeconds: 4, lineWidth: 1.8 },
    ),
  );

  expect(migrated.bounds).toEqual({
    x: 0.16,
    y: 0.79,
    width: 0.19,
    height: 0.17,
  });
});
