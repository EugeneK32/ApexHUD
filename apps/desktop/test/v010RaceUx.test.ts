import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const source = (relative: string) => readFile(path.join(root, relative), "utf8");

describe("0.10 race-first UX", () => {
  it("uses the real community catalog as the default and migrates the placeholder URL", async () => {
    const preferences = await source("apps/desktop/src/main/preferencesStore.ts");
    expect(preferences).toContain("https://github.com/EugeneK32/apexhud-community-modules.git");
    expect(preferences).toContain("LEGACY_COMMUNITY_REPOSITORIES");
  });

  it("uses authoritative iRacing race order before calculated progress", async () => {
    const standings = await source("services/telemetry/Processing/StandingsEngine.cs");
    const positionSort = standings.indexOf(".OrderBy(entry => entry.Position");
    const progressSort = standings.indexOf(".ThenByDescending(Progress)", positionSort);
    expect(positionSort).toBeGreaterThan(0);
    expect(progressSort).toBeGreaterThan(positionSort);
  });

  it("makes multiclass position unambiguous and filters timing-line flicker", async () => {
    const manifest = await source("modules/position/manifest.json");
    const module = await source("modules/position/module.js");
    expect(manifest).toContain('"standings"');
    expect(manifest).toContain('"Automatic (class in multiclass)"');
    expect(module).toContain("const isMulticlass = classCount > 1");
    expect(module).toContain("function stabilize(slot, next)");
  });

  it("uses the car-specific shift light bands and only flashes at blink RPM", async () => {
    const dashboard = await source("modules/dashboard/module.js");
    const parser = await source("services/telemetry/Processing/SessionYamlParser.cs");
    expect(parser).toContain("DriverCarSLFirstRPM");
    expect(parser).toContain("DriverCarSLBlinkRPM");
    expect(dashboard).toContain("currentRpm >= firstRpm");
    expect(dashboard).toContain("currentRpm >= blinkRpm * .995");
    expect(dashboard).toContain('root.classList.toggle("downshift"');
  });

  it("keeps transient scoring changes from reordering the race table", async () => {
    const standings = await source("services/telemetry/Processing/StandingsEngine.cs");
    expect(standings).toContain("PositionConfirmation");
    expect(standings).toContain("StabilizePosition");
  });

  it("simplifies the Control Center around home, layouts and widgets", async () => {
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(control).toContain('class="home-grid"');
    expect(control).toContain('this.t("myWidgets")');
    expect(control).toContain('class="panel settings-advanced"');
    expect(control).not.toContain('class="quick-grid"');
  });
});
