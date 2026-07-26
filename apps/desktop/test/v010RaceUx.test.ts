import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const source = (relative: string) => readFile(path.join(root, relative), "utf8");

type PositionManifest = {
  scopes?: string[];
  settings?: Array<{
    key?: string;
    default?: unknown;
    options?: Array<{ label?: string; value?: string }>;
  }>;
};

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

  it("keeps overall and class position explicit and stabilizes scoring changes", async () => {
    const manifest = JSON.parse(
      await source("modules/position/manifest.json"),
    ) as PositionManifest;
    const standings = await source("services/telemetry/Processing/StandingsEngine.cs");

    expect(manifest.scopes).toContain("standings");

    const primaryPosition = manifest.settings?.find(
      (setting) => setting.key === "primaryPosition",
    );
    expect(primaryPosition?.options?.map((option) => option.value)).toEqual(
      expect.arrayContaining(["overall", "class"]),
    );

    const showBothPositions = manifest.settings?.find(
      (setting) => setting.key === "showBothPositions",
    );
    expect(showBothPositions?.default).toBe(true);

    const gapMode = manifest.settings?.find(
      (setting) => setting.key === "gapMode",
    );
    expect(gapMode?.options?.map((option) => option.value)).toContain("class");

    expect(standings).toContain("PositionConfirmation");
    expect(standings).toContain("StabilizePosition");
  });

  it("uses car-specific shift telemetry and flashes only at the final threshold", async () => {
    const dashboard = await source("modules/dashboard/module.js");
    const parser = await source("services/telemetry/Processing/SessionYamlParser.cs");

    expect(parser).toContain("DriverCarSLFirstRPM");
    expect(parser).toContain("DriverCarSLBlinkRPM");
    expect(dashboard).toContain("shiftLightFirstRpm");
    expect(dashboard).toContain("shiftLightBlinkRpm");
    expect(dashboard).toContain("shiftIndicatorPercent");
    expect(dashboard).toMatch(/ratio\s*>=\s*\.985/);
    expect(dashboard).toContain('root.classList.toggle("shift-now"');
  });

  it("keeps transient scoring changes from reordering the race table", async () => {
    const standings = await source("services/telemetry/Processing/StandingsEngine.cs");
    expect(standings).toContain("PositionConfirmation");
    expect(standings).toContain("StabilizePosition");
  });

  it("simplifies the Control Center around home, layouts and widgets", async () => {
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(control).toContain('class="home-rework"');
    expect(control).toContain('class="home-rework-hero panel"');
    expect(control).toContain('this.t("myWidgets")');
    expect(control).toContain('class="settings-workspace"');
    expect(control).not.toContain('class="quick-grid"');
    expect(control).not.toContain('class="overlay-preview"');
    expect(control).not.toContain('class="track-mark"');
  });
});
