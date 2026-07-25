import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

describe("unlimited session sentinels", () => {
  it("renders semantic OPEN/infinity values instead of raw SDK limits", async () => {
    const moduleSource = await readFile(path.join(root, "modules/session/module.js"), "utf8");
    expect(moduleSource).toContain('session.hasTimeLimit === false');
    expect(moduleSource).toContain('session.hasLapLimit');
    expect(moduleSource).toContain('"∞"');
    expect(moduleSource).toContain('value >= 604799');
  });

  it("normalizes sentinel values in the telemetry processor and fuel engine", async () => {
    const processor = await readFile(
      path.join(root, "services/telemetry/Processing/TelemetryProcessor.cs"),
      "utf8",
    );
    const fuel = await readFile(
      path.join(root, "services/telemetry/Processing/FuelEngine.cs"),
      "utf8",
    );
    expect(processor).toContain("rawLapsRemaining is > 0 and < 32767");
    expect(processor).toContain("rawTimeRemaining < 604799");
    expect(fuel).toContain("frame.SessionLapsRemaining is > 0 and < 32767");
    expect(fuel).toContain("frame.SessionTimeRemaining is > 0 and < 604799");
  });
});
