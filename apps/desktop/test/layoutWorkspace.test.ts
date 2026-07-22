import { describe, expect, it } from "vitest";
import type { LayoutDocument, LayoutWorkspace, ModuleInstance } from "@apexhud/protocol";
import {
  activeLayoutGroup,
  commitLayoutForScenario,
  copyLayoutBetweenTargets,
  createLayoutGroup,
  duplicateLayoutGroup,
  layoutForScenario,
  resetCurrentProfileToBase,
} from "../src/renderer/shared/layoutWorkspace";

const empty: LayoutDocument = {
  schemaVersion: 1,
  display: "primary",
  snapGrid: 8,
  instances: [],
};

function widget(instanceId: string, moduleId = "com.example.widget"): ModuleInstance {
  return {
    instanceId,
    moduleId,
    enabled: true,
    zIndex: 1,
    bounds: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    settings: { opacity: 0.8, rows: 12 },
  };
}

describe("Base Layout inheritance", () => {
  it("propagates Base changes while preserving child overrides", () => {
    const group = createLayoutGroup("Racing", empty);
    group.profiles.default.layout.instances.push(widget("base-widget"));

    const workspace: LayoutWorkspace = {
      schemaVersion: 3,
      activeGroupId: group.id,
      groups: [group],
    };

    const race = layoutForScenario(workspace, "race");
    race.instances[0]!.bounds.x = 0.55;
    commitLayoutForScenario(workspace, "race", race);

    group.profiles.default.layout.instances[0]!.settings.opacity = 0.35;
    group.profiles.default.layout.instances[0]!.settings.rows = 20;

    const resolved = layoutForScenario(workspace, "race");
    expect(resolved.instances[0]!.bounds.x).toBe(0.55);
    expect(resolved.instances[0]!.settings.opacity).toBe(0.35);
    expect(resolved.instances[0]!.settings.rows).toBe(20);
  });

  it("keeps a removed inherited module hidden and inherits newly added modules", () => {
    const group = createLayoutGroup("Racing", empty);
    group.profiles.default.layout.instances.push(widget("removed-later"));
    const workspace: LayoutWorkspace = {
      schemaVersion: 3,
      activeGroupId: group.id,
      groups: [group],
    };

    const race = layoutForScenario(workspace, "race");
    race.instances = [];
    commitLayoutForScenario(workspace, "race", race);

    group.profiles.default.layout.instances.push(widget("new-from-base", "com.example.new"));
    const resolved = layoutForScenario(workspace, "race");

    expect(resolved.instances.some((item) => item.instanceId === "removed-later")).toBe(false);
    expect(resolved.instances.some((item) => item.instanceId === "new-from-base")).toBe(true);
  });

  it("resets a child to pure Base inheritance", () => {
    const group = createLayoutGroup("Racing", empty);
    group.profiles.default.layout.instances.push(widget("base-widget"));
    const workspace: LayoutWorkspace = {
      schemaVersion: 3,
      activeGroupId: group.id,
      groups: [group],
    };
    const race = layoutForScenario(workspace, "race");
    race.instances[0]!.enabled = false;
    race.instances.push(widget("race-local", "com.example.local"));
    commitLayoutForScenario(workspace, "race", race);

    resetCurrentProfileToBase(group, "race");
    const reset = layoutForScenario(workspace, "race");
    expect(reset.instances).toHaveLength(1);
    expect(reset.instances[0]!.instanceId).toBe("base-widget");
    expect(reset.instances[0]!.enabled).toBe(true);
  });
});

describe("layout groups and cross-target copy", () => {
  it("selects groups manually", () => {
    const first = createLayoutGroup("First", empty);
    const second = duplicateLayoutGroup(first, "Second");
    const workspace: LayoutWorkspace = {
      schemaVersion: 3,
      activeGroupId: second.id,
      groups: [first, second],
    };
    expect(activeLayoutGroup(workspace).name).toBe("Second");
  });

  it("copies any resolved layer to another group and layer", () => {
    const source = createLayoutGroup("Source", empty);
    source.profiles.default.layout.instances.push(widget("source-widget"));
    const target = createLayoutGroup("Target", empty);
    target.profiles.default.layout.instances.push(widget("target-base", "com.example.target"));
    const workspace: LayoutWorkspace = {
      schemaVersion: 3,
      activeGroupId: source.id,
      groups: [source, target],
    };

    copyLayoutBetweenTargets(
      workspace,
      { groupId: source.id, scenario: "default" },
      { groupId: target.id, scenario: "qualifying" },
    );

    const copied = layoutForScenario(
      { ...workspace, activeGroupId: target.id },
      "qualifying",
    );
    expect(copied.instances.map((item) => item.instanceId)).toEqual(["source-widget"]);
    expect(target.profiles.qualifying.hiddenBaseInstanceIds).toContain("target-base");
  });
});
