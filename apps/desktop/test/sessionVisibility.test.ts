import { describe, expect, it } from "vitest";
import type { TelemetrySnapshot } from "@apexhud/protocol";
import { isRaceOverlayActive } from "../src/renderer/overlay/sessionVisibility";

function frame(
  source: string,
  connected: boolean,
  window: Partial<TelemetrySnapshot["connection"]["simulatorWindow"]> = {},
): TelemetrySnapshot {
  return {
    protocolVersion: 3,
    sequence: 1,
    timestamp: new Date(0).toISOString(),
    source,
    connection: {
      connected,
      status: "",
      tickRate: 60,
      framesDropped: 0,
      simulatorWindow: {
        processRunning: true,
        windowFound: true,
        isVisible: true,
        isMinimized: false,
        isForeground: true,
        ...window,
      },
    },
    session: {
      sessionNumber: 0,
      state: 1,
      sessionType: "Practice",
      sessionName: "Practice",
      eventType: "Practice",
      trackName: "Test",
      trackLengthMeters: 1000,
      timeRemainingSeconds: 100,
      hasTimeLimit: true,
      lapsRemaining: 1,
      hasLapLimit: true,
      flags: 0,
      isReplayPlaying: false,
      isInGarage: false,
    },
    player: {
      carIndex: 0,
      name: "Player",
      carNumber: "1",
      position: 1,
      classPosition: 1,
      lap: 1,
      lapDistancePercent: 0.5,
      speedMetersPerSecond: 10,
      fuelLiters: 10,
      lastLapSeconds: 0,
      bestLapSeconds: 0,
      incidentCount: 0,
      onPitRoad: false,
      isOnTrack: true,
    },
    vehicle: {
      speedMetersPerSecond: 10,
      gear: 2,
      rpm: 4000,
      shiftRpm: 7000,
      throttle: 0.5,
      brake: 0,
      clutch: 0,
      steeringWheelAngleRadians: 0,
      onPitRoad: false,
      trackSurface: 3,
    },
    timing: {
      currentLap: 1,
      completedLaps: 0,
      currentLapSeconds: 10,
      lastLapSeconds: 0,
      bestLapSeconds: 0,
      deltaToBestSeconds: 0,
      deltaAvailable: false,
      currentLapValid: false,
      validity: "unavailable",
    },
    fuel: {
      levelLiters: 10,
      usePerHourLiters: 0,
      estimatedPerLapLiters: 0,
      estimatedLapsRemaining: 0,
      requiredToFinishLiters: 0,
      addToFinishLiters: 0,
      samples: 0,
      estimateReady: false,
    },
    radar: { spotterState: "clear", active: false, contacts: [] },
    relative: { entries: [] },
    standings: { mode: "overall", entries: [] },
  };
}

describe("race overlay visibility", () => {
  it("requires live iRacing telemetry", () => {
    expect(isRaceOverlayActive(frame("iracing", true))).toBe(true);
    expect(isRaceOverlayActive(frame("iracing", false))).toBe(false);
    expect(isRaceOverlayActive(frame("mock", true))).toBe(false);
  });

  it("hides when iRacing is minimized", () => {
    expect(
      isRaceOverlayActive(frame("iracing", true, { isMinimized: true })),
    ).toBe(false);
  });

  it("supports foreground, minimized-only and never auto-hide modes", () => {
    const background = frame("iracing", true, { isForeground: false });
    expect(isRaceOverlayActive(background, "not-foreground")).toBe(false);
    expect(isRaceOverlayActive(background, "minimized")).toBe(true);
    expect(isRaceOverlayActive(background, "never")).toBe(true);
  });
});
