import type {
  LayoutScenario,
  TelemetrySnapshot,
} from "@apexhud/protocol";

export function scenarioFromTelemetry(
  frame: TelemetrySnapshot | undefined,
): LayoutScenario {
  if (!frame || frame.source !== "iracing") return "default";
  if (frame.session.isReplayPlaying) return "replay";

  const eventType = String(frame.session.eventType ?? "").toLowerCase();
  const sessionText = [frame.session.sessionName, frame.session.sessionType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const compactEventType = eventType.replace(/[\s_-]+/g, "");
  const compactSessionText = sessionText.replace(/[\s_-]+/g, "");

  // Test Drive is normally exposed as a practice session inside a Test event.
  if (eventType.includes("test") || sessionText.includes("test drive")) {
    return "test-drive";
  }

  // iRacing commonly reports Time Trial as a Lone Qualify session. Detect the
  // event before the generic qualifying branch or it will select the wrong HUD.
  if (
    compactEventType.includes("timetrial") ||
    compactSessionText.includes("timetrial")
  ) {
    return "time-trial";
  }

  if (sessionText.includes("qual")) return "qualifying";
  if (sessionText.includes("race")) return "race";
  if (sessionText.includes("practice") || sessionText.includes("warmup")) {
    return "practice";
  }

  return "default";
}

export const SCENARIO_LABELS: Record<LayoutScenario, string> = {
  default: "Base Layout",
  "test-drive": "Test drive",
  practice: "Practice",
  "time-trial": "Time trial",
  qualifying: "Qualifying",
  race: "Race",
  replay: "Replay",
};
