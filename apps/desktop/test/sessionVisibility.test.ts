import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, type TelemetrySnapshot } from "@apexhud/protocol";
import { isRaceOverlayActive } from "../src/renderer/overlay/sessionVisibility";

function frame(
  source: string,
  connected: boolean,
  window: Partial<TelemetrySnapshot["connection"]["simulatorWindow"]> = {},
): TelemetrySnapshot {
  return {
    protocolVersion: PROTOCOL_VERSION,
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
      trackLengthMeters: 1_000,
      sessionTimeSeconds: 10,
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
      teamName: "ApexHUD",
      carClassId: 10,
      carClassName: "GT3",
      iRating: 2_500,
      license: "A 3.50",
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
      rpm: 4_000,
      shiftRpm: 7_000,
      throttle: 0.5,
      brake: 0,
      clutch: 0,
      steeringWheelAngleRadians: 0,
      onPitRoad: false,
      trackSurface: 3,
      trackSurfaceMaterial: 0,
    },
    driverAids: {
      absAvailable: false,
      absActive: false,
      tractionControlAvailable: false,
      tractionControlEnabled: false,
      brakeBiasAvailable: false,
      pitLimiterAvailable: false,
      pitLimiterActive: false,
      revLimiterActive: false,
      engineWarningsAvailable: false,
      engineWarnings: 0,
      waterTemperatureWarning: false,
      fuelPressureWarning: false,
      oilPressureWarning: false,
      oilTemperatureWarning: false,
      engineStalled: false,
    },
    pit: { dataAvailable: false, inPitStall: false, pitstopActive: false },
    environment: { dataAvailable: false },
    motion: { dataAvailable: false },
    timing: {
      currentLap: 1,
      completedLaps: 0,
      currentLapSeconds: 10,
      lastLapSeconds: 0,
      bestLapSeconds: 0,
      deltaToBestSeconds: 0,
      deltaAvailable: false,
      deltaToOptimalLapSeconds: 0,
      deltaToOptimalLapAvailable: false,
      deltaToSessionBestLapSeconds: 0,
      deltaToSessionBestLapAvailable: false,
      deltaToSessionOptimalLapSeconds: 0,
      deltaToSessionOptimalLapAvailable: false,
      deltaToLastLapSeconds: 0,
      deltaToLastLapAvailable: false,
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
    expect(isRaceOverlayActive(frame("iracing", true, { isMinimized: true }))).toBe(false);
  });

  it("supports foreground, minimized-only and never auto-hide modes", () => {
    const background = frame("iracing", true, { isForeground: false });
    expect(isRaceOverlayActive(background, "not-foreground")).toBe(false);
    expect(isRaceOverlayActive(background, "minimized")).toBe(true);
    expect(isRaceOverlayActive(background, "never")).toBe(true);
  });
});
