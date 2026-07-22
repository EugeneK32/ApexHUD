import { describe, expect, it } from "vitest";
import type { LayoutDocument } from "@apexhud/protocol";
import { factoryLayoutForScenario } from "../src/main/layoutProfiles";

const source: LayoutDocument = {
  schemaVersion: 1,
  display: "primary",
  snapGrid: 8,
  instances: [
    widget("com.apexhud.standings", true),
    widget("com.apexhud.relative", true),
    widget("com.apexhud.delta", true),
    widget("com.apexhud.inputs", true),
    widget("com.apexhud.race-control", false),
  ],
};

function widget(moduleId: string, enabled: boolean) {
  return {
    instanceId: moduleId,
    moduleId,
    enabled,
    zIndex: 1,
    bounds: { x: 0, y: 0, width: 0.2, height: 0.2 },
    settings: { rows: 16 },
  };
}

describe("factory scenario profiles", () => {
  it("keeps test drive focused on driving data", () => {
    const layout = factoryLayoutForScenario(source, "test-drive");
    expect(enabled(layout, "com.apexhud.inputs")).toBe(true);
    expect(enabled(layout, "com.apexhud.delta")).toBe(true);
    expect(enabled(layout, "com.apexhud.standings")).toBe(false);
    expect(enabled(layout, "com.apexhud.relative")).toBe(false);
  });

  it("enables race context and removes coaching traces in race", () => {
    const layout = factoryLayoutForScenario(source, "race");
    expect(enabled(layout, "com.apexhud.standings")).toBe(true);
    expect(enabled(layout, "com.apexhud.relative")).toBe(true);
    expect(enabled(layout, "com.apexhud.race-control")).toBe(true);
    expect(enabled(layout, "com.apexhud.inputs")).toBe(false);
    expect(enabled(layout, "com.apexhud.delta")).toBe(false);
  });

  it("does not mutate the source document", () => {
    factoryLayoutForScenario(source, "replay");
    expect(enabled(source, "com.apexhud.inputs")).toBe(true);
    expect(enabled(source, "com.apexhud.race-control")).toBe(false);
  });
});

function enabled(layout: LayoutDocument, moduleId: string): boolean {
  return layout.instances.find((instance) => instance.moduleId === moduleId)?.enabled ?? false;
}
