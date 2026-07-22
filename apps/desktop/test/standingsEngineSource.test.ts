import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("standings telemetry policy", () => {
  it("filters spectators and compacts the race order after stale cars are removed", async () => {
    const source = await readFile(
      path.join(root, "services/telemetry/Processing/StandingsEngine.cs"),
      "utf8",
    );
    expect(source).toContain("driver?.IsSpectator == true");
    expect(source).toContain("!hasLiveEvidence && !hasSessionResult");
    expect(source).toContain("Position = index + 1");
    expect(source).toContain("ClassPosition = nextClassPosition");
  });
});
