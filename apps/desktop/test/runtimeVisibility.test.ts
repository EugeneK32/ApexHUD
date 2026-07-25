import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  type DiscoveredModule,
  type TelemetrySnapshot,
} from "@apexhud/protocol";
import { shouldHideModuleAtRuntime } from "../src/renderer/overlay/runtimeVisibility.js";

function moduleWithId(id: string): DiscoveredModule {
  return {
    source: "built-in",
    url: `apex-module://${id}/index.html`,
    manifest: {
      schemaVersion: 1,
      id,
      name: "Widget",
      description: "Widget",
      version: "1.0.0",
      author: "Eugene Konovalov",
      entry: "index.html",
      scopes: ["radar"],
      defaultBounds: { x: 0, y: 0, width: 0.1, height: 0.1 },
      settings: [],
    },
  };
}

function snapshot(contacts: TelemetrySnapshot["radar"]["contacts"]): TelemetrySnapshot {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sequence: 1,
    timestamp: new Date(0).toISOString(),
    source: "iracing",
    connection: {
      connected: true,
      status: "live",
      tickRate: 60,
      framesDropped: 0,
      simulatorWindow: {
        processRunning: true,
        windowFound: true,
        isVisible: true,
        isMinimized: false,
        isForeground: true,
      },
    },
    session: {
      sessionNumber: 0,
      state: 4,
      sessionType: "Race",
      sessionName: "Race",
      eventType: "Race",
      trackName: "Track",
      trackLengthMeters: 5_000,
      sessionTimeSeconds: 120,
      timeRemainingSeconds: 1_000,
      hasTimeLimit: true,
      lapsRemaining: 10,
      hasLapLimit: true,
      flags: 0,
      isReplayPlaying: false,
      isInGarage: false,
    },
    player: {
      carIndex: 1,
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
      lapDistancePercent: 0.1,
      speedMetersPerSecond: 20,
      fuelLiters: 10,
      lastLapSeconds: 0,
      bestLapSeconds: 0,
      incidentCount: 0,
      onPitRoad: false,
      isOnTrack: true,
    },
    vehicle: {
      speedMetersPerSecond: 20,
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
      currentLapValid: true,
      validity: "valid",
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
    radar: { spotterState: "clear", active: contacts.length > 0, contacts },
    relative: { entries: [] },
    standings: { mode: "overall", entries: [] },
  };
}

describe("runtime module visibility", () => {
  const radar = moduleWithId("com.apexhud.radar");

  it("hides the radar host while no side car exists", () => {
    expect(shouldHideModuleAtRuntime(radar, snapshot([]), false)).toBe(true);
    expect(
      shouldHideModuleAtRuntime(
        radar,
        snapshot([{
          carIndex: 2,
          side: "unknown",
          longitudinalMeters: -8,
          closingSpeedMetersPerSecond: 2,
          overlap: 0,
          threat: "fast-approach",
          confidence: 0.4,
          isApproaching: true,
        }]),
        false,
      ),
    ).toBe(true);
  });

  it("shows the radar for left or right contacts and in edit mode", () => {
    expect(
      shouldHideModuleAtRuntime(
        radar,
        snapshot([{
          carIndex: 2,
          side: "left",
          longitudinalMeters: 0,
          closingSpeedMetersPerSecond: 0,
          overlap: 0.8,
          threat: "critical",
          confidence: 1,
          isApproaching: false,
        }]),
        false,
      ),
    ).toBe(false);
    expect(shouldHideModuleAtRuntime(radar, snapshot([]), true)).toBe(false);
  });

  it("does not affect other modules", () => {
    expect(
      shouldHideModuleAtRuntime(moduleWithId("com.apexhud.standings"), snapshot([]), false),
    ).toBe(false);
  });
});
