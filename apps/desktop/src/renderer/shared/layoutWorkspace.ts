import {
  LAYOUT_SCENARIOS,
  copyLayoutTarget,
  resetProfileToBase,
  resolveLayoutProfile,
  writeResolvedLayoutToGroup,
  type LayoutDocument,
  type LayoutGroup,
  type LayoutProfile,
  type LayoutScenario,
  type LayoutTarget,
  type LayoutWorkspace,
} from "@apexhud/protocol";
import { SCENARIO_LABELS } from "./layoutScenario";

export function activeLayoutGroup(workspace: LayoutWorkspace): LayoutGroup {
  return workspace.groups.find((group) => group.id === workspace.activeGroupId)
    ?? workspace.groups[0]!;
}

export function layoutForScenario(
  workspace: LayoutWorkspace,
  scenario: LayoutScenario,
): LayoutDocument {
  return resolveLayoutProfile(activeLayoutGroup(workspace), scenario);
}

export function commitLayoutForScenario(
  workspace: LayoutWorkspace,
  scenario: LayoutScenario,
  resolved: LayoutDocument,
): void {
  writeResolvedLayoutToGroup(activeLayoutGroup(workspace), scenario, resolved);
}

export function createLayoutGroup(
  name: string,
  seed: LayoutDocument,
): LayoutGroup {
  const id = `group-${crypto.randomUUID().slice(0, 8)}`;
  const base = structuredClone(seed);
  return {
    id,
    name: cleanName(name, "New group"),
    profiles: Object.fromEntries(
      LAYOUT_SCENARIOS.map((scenario) => [
        scenario,
        scenario === "default"
          ? {
              scenario,
              name: SCENARIO_LABELS[scenario],
              layout: structuredClone(base),
              hiddenBaseInstanceIds: [],
              baseOverrides: {},
            } satisfies LayoutProfile
          : {
              scenario,
              name: SCENARIO_LABELS[scenario],
              layout: emptyLocalLayout(base),
              hiddenBaseInstanceIds: [],
              baseOverrides: {},
            } satisfies LayoutProfile,
      ]),
    ) as unknown as Record<LayoutScenario, LayoutProfile>,
  };
}

export function duplicateLayoutGroup(
  source: LayoutGroup,
  name = `${source.name} copy`,
): LayoutGroup {
  const copy = structuredClone(source);
  copy.id = `group-${crypto.randomUUID().slice(0, 8)}`;
  copy.name = cleanName(name, "Group copy");
  return copy;
}

export function resetCurrentProfileToBase(
  group: LayoutGroup,
  target: LayoutScenario,
): LayoutDocument {
  return resetProfileToBase(group, target);
}

export function copyLayoutBetweenTargets(
  workspace: LayoutWorkspace,
  source: LayoutTarget,
  target: LayoutTarget,
): LayoutDocument {
  return copyLayoutTarget(workspace, source, target);
}

/** Kept as a compatibility alias for older UI code. */
export function copyDefaultLayoutToScenario(
  group: LayoutGroup,
  target: LayoutScenario,
): LayoutDocument {
  return resetProfileToBase(group, target);
}

export function cleanName(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 60);
  return trimmed || fallback;
}

function emptyLocalLayout(base: LayoutDocument): LayoutDocument {
  return {
    schemaVersion: 1,
    ...(base.migrationVersion === undefined
      ? {}
      : { migrationVersion: base.migrationVersion }),
    display: base.display,
    snapGrid: base.snapGrid,
    instances: [],
  };
}
