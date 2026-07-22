import type {
  LayoutDocument,
  LayoutScenario,
} from "@apexhud/protocol";

const ENABLED_BY_SCENARIO: Partial<Record<LayoutScenario, ReadonlySet<string>>> = {
  "test-drive": new Set([
    "com.apexhud.radar",
    "com.apexhud.delta",
    "com.apexhud.dashboard",
    "com.apexhud.inputs",
    "com.apexhud.fuel",
    "com.apexhud.session",
    "com.apexhud.position",
    "com.apexhud.incidents",
    "com.apexhud.lap-times",
  ]),
  practice: new Set([
    "com.apexhud.radar",
    "com.apexhud.standings",
    "com.apexhud.delta",
    "com.apexhud.dashboard",
    "com.apexhud.inputs",
    "com.apexhud.fuel",
    "com.apexhud.relative",
    "com.apexhud.session",
    "com.apexhud.position",
    "com.apexhud.incidents",
    "com.apexhud.lap-times",
  ]),
  qualifying: new Set([
    "com.apexhud.radar",
    "com.apexhud.standings",
    "com.apexhud.delta",
    "com.apexhud.dashboard",
    "com.apexhud.inputs",
    "com.apexhud.fuel",
    "com.apexhud.session",
    "com.apexhud.position",
    "com.apexhud.incidents",
    "com.apexhud.race-control",
    "com.apexhud.lap-times",
  ]),
  race: new Set([
    "com.apexhud.radar",
    "com.apexhud.standings",
    "com.apexhud.dashboard",
    "com.apexhud.fuel",
    "com.apexhud.relative",
    "com.apexhud.session",
    "com.apexhud.position",
    "com.apexhud.incidents",
    "com.apexhud.race-control",
  ]),
  replay: new Set([
    "com.apexhud.standings",
    "com.apexhud.relative",
    "com.apexhud.session",
    "com.apexhud.position",
    "com.apexhud.race-control",
  ]),
};

/**
 * Factory profiles are deliberately different. Existing pre-0.5 layouts are
 * copied unchanged into every profile during migration, so an upgrade never
 * silently removes widgets that the user already placed.
 */
export function factoryLayoutForScenario(
  source: LayoutDocument,
  scenario: LayoutScenario,
): LayoutDocument {
  const layout = structuredClone(source);
  const enabled = ENABLED_BY_SCENARIO[scenario];
  if (!enabled) return layout;

  for (const instance of layout.instances) {
    instance.enabled = enabled.has(instance.moduleId);

    if (instance.moduleId === "com.apexhud.standings") {
      if (scenario === "practice") instance.settings.rows = 12;
      if (scenario === "qualifying") instance.settings.rows = 10;
      if (scenario === "race") instance.settings.rows = 16;
    }
  }

  return layout;
}
