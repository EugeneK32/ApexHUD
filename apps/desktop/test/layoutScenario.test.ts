import { describe, expect, it } from "vitest";
import type { TelemetrySnapshot } from "@apexhud/protocol";
import { scenarioFromTelemetry } from "../src/renderer/shared/layoutScenario";

function session(
  sessionType: string,
  sessionName = sessionType,
  eventType = sessionType,
  replay = false,
): TelemetrySnapshot {
  return {
    source: "iracing",
    session: {
      sessionType,
      sessionName,
      eventType,
      isReplayPlaying: replay,
    },
  } as TelemetrySnapshot;
}

describe("layout scenario detection", () => {
  it("maps live session metadata to automatic profiles", () => {
    expect(scenarioFromTelemetry(session("Practice"))).toBe("practice");
    expect(scenarioFromTelemetry(session("Practice", "Practice", "Race"))).toBe("practice");
    expect(scenarioFromTelemetry(session("Lone Qualify", "Time Trial", "Time Trial"))).toBe("time-trial");
    expect(scenarioFromTelemetry(session("Lone Qualify", "TimeTrial", "TimeTrial"))).toBe("time-trial");
    expect(scenarioFromTelemetry(session("Open Qualify"))).toBe("qualifying");
    expect(scenarioFromTelemetry(session("Race"))).toBe("race");
    expect(scenarioFromTelemetry(session("Practice", "Test Drive", "Test"))).toBe("test-drive");
    expect(scenarioFromTelemetry(session("Race", "Race", "Race", true))).toBe("replay");
  });
});
