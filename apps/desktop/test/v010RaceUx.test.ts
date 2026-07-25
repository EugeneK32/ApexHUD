import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runClassicWidget } from "./helpers/widgetHarness";

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

  it("makes overall and class position unambiguous in multiclass sessions", async () => {
    const manifest = JSON.parse(await source("modules/position/manifest.json")) as {
      scopes: string[];
      settings: Array<{
        key: string;
        default: unknown;
        options?: Array<{ label: string; value: string }>;
      }>;
    };
    const moduleSource = await source("modules/position/module.js");
    const primary = manifest.settings.find((setting) => setting.key === "primaryPosition");
    const gapMode = manifest.settings.find((setting) => setting.key === "gapMode");
    const showBoth = manifest.settings.find((setting) => setting.key === "showBothPositions");

    expect(manifest.scopes).toEqual(expect.arrayContaining(["player", "standings"]));
    expect(primary?.options?.map((option) => option.value)).toEqual(["overall", "class"]);
    expect(gapMode?.options?.map((option) => option.value)).toEqual(
      expect.arrayContaining(["sameAsPrimary", "overall", "class"]),
    );
    expect(showBoth?.default).toBe(true);

    const harness = runClassicWidget(moduleSource);
    const payload = {
      player: {
        carIndex: 8,
        name: "Istvan Fodor",
        carNumber: "4",
        carClassId: 12,
        carClassName: "GT3",
        iRating: 2_816,
        position: 6,
        classPosition: 4,
      },
      standings: {
        entries: [
          { carIndex: 2, position: 3, classPosition: 2, carClassId: 12, intervalSeconds: 1.4 },
          { carIndex: 4, position: 4, classPosition: 1, carClassId: 5, intervalSeconds: 0.8 },
          { carIndex: 5, position: 5, classPosition: 3, carClassId: 12, intervalSeconds: 2.0 },
          { carIndex: 8, position: 6, classPosition: 4, carClassId: 12, intervalSeconds: 2.2, isPlayer: true },
          { carIndex: 11, position: 7, classPosition: 2, carClassId: 5, intervalSeconds: 2.6 },
        ],
      },
    };

    const overallSettings = { ...harness.definition.defaults, primaryPosition: "overall" };
    harness.definition.applySettings(overallSettings);
    harness.definition.render(payload, { settings: overallSettings, hasFrame: true });
    expect(harness.elements.get("primary-position")?.textContent).toBe("6");
    expect(harness.elements.get("field-size")?.textContent).toBe("/ 5");
    expect(harness.elements.get("secondary-position")?.textContent).toBe("CLASS P4");

    const classSettings = { ...overallSettings, primaryPosition: "class" };
    harness.definition.applySettings(classSettings);
    harness.definition.render(payload, { settings: classSettings, hasFrame: true });
    expect(harness.elements.get("primary-position")?.textContent).toBe("4");
    expect(harness.elements.get("field-size")?.textContent).toBe("/ 3");
    expect(harness.elements.get("secondary-position")?.textContent).toBe("OVERALL P6");
  });

  it("prefers normalized v6 shift data and keeps RPM thresholds as a fallback", async () => {
    const dashboardSource = await source("modules/dashboard/module.js");
    const parser = await source("services/telemetry/Processing/SessionYamlParser.cs");
    expect(parser).toContain("DriverCarSLFirstRPM");
    expect(parser).toContain("DriverCarSLBlinkRPM");

    const harness = runClassicWidget(dashboardSource);
    const settings = { ...harness.definition.defaults };
    harness.definition.applySettings(settings);

    const render = (vehicle: Record<string, unknown>, driverAids: Record<string, unknown> = {}) => {
      harness.definition.render(
        { vehicle: { gear: 4, speedMetersPerSecond: 50, rpm: 6_000, ...vehicle }, driverAids },
        { settings, hasFrame: true },
      );
    };

    render({ shiftIndicatorPercent: 0.7, shiftLightBlinkRpm: 7_200 });
    expect(harness.elements.get("dashboard")?.classList.contains("near-shift")).toBe(true);
    expect(harness.elements.get("dashboard")?.classList.contains("shift-now")).toBe(false);
    expect(harness.elements.get("shift-state")?.textContent).toBe("BUILDING");

    render({ shiftIndicatorPercent: 0.99, shiftLightBlinkRpm: 7_200 });
    expect(harness.elements.get("dashboard")?.classList.contains("shift-now")).toBe(true);
    expect(harness.elements.get("shift-state")?.textContent).toBe("SHIFT NOW");

    render({ rpm: 7_056, shiftIndicatorPercent: undefined, shiftLightBlinkRpm: 7_200 });
    expect(harness.elements.get("dashboard")?.classList.contains("near-shift")).toBe(true);
    expect(harness.elements.get("dashboard")?.classList.contains("shift-now")).toBe(false);

    render({ rpm: 7_128, shiftIndicatorPercent: undefined, shiftLightBlinkRpm: 7_200 });
    expect(harness.elements.get("dashboard")?.classList.contains("shift-now")).toBe(true);

    render({ shiftIndicatorPercent: 0.4, shiftLightBlinkRpm: 7_200 }, { revLimiterActive: true });
    expect(harness.elements.get("dashboard")?.classList.contains("shift-now")).toBe(true);
    expect(harness.elements.get("dashboard")?.classList.contains("limiter")).toBe(true);
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
