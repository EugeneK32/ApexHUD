import { describe, expect, it } from "vitest";
import type { DiscoveredModule, TelemetrySnapshot } from "@apexhud/protocol";
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
      author: "ApexHUD",
      entry: "index.html",
      scopes: ["radar"],
      defaultBounds: { x: 0, y: 0, width: 0.1, height: 0.1 },
      settings: [],
    },
  };
}

function snapshot(contacts: TelemetrySnapshot["radar"]["contacts"]): TelemetrySnapshot {
  return {
    protocolVersion: 1,
    sequence: 1,
    timestamp: new Date(0).toISOString(),
    source: "iracing",
    connection: {
      connected: true,
      status: "live",
      tickRate: 60,
      framesDropped: 0,
      simulatorWindow: { processRunning: true, windowFound: true, isVisible: true, isMinimized: false, isForeground: true },
    },
    session: { sessionNumber: 0, state: 4, sessionType: "Race", sessionName: "Race", eventType: "Race", trackName: "Track", trackLengthMeters: 5000, timeRemainingSeconds: 1000, hasTimeLimit: true, lapsRemaining: 10, hasLapLimit: true, flags: 0, isReplayPlaying: false, isInGarage: false },
    player: { carIndex: 1, name: "Player", carNumber: "1", position: 1, classPosition: 1, lap: 1, lapDistancePercent: 0.1, speedMetersPerSecond: 20, fuelLiters: 10, lastLapSeconds: 0, bestLapSeconds: 0, incidentCount: 0, onPitRoad: false, isOnTrack: true },
    vehicle: { speedMetersPerSecond: 20, gear: 2, rpm: 4000, shiftRpm: 7000, throttle: 0.5, brake: 0, clutch: 0, steeringWheelAngleRadians: 0, onPitRoad: false, trackSurface: 3 },
    timing: { currentLap: 1, completedLaps: 0, currentLapSeconds: 10, lastLapSeconds: 0, bestLapSeconds: 0, deltaToBestSeconds: 0, deltaAvailable: false, currentLapValid: true, validity: "valid" },
    fuel: { levelLiters: 10, usePerHourLiters: 0, estimatedPerLapLiters: 0, estimatedLapsRemaining: 0, requiredToFinishLiters: 0, addToFinishLiters: 0, samples: 0, estimateReady: false },
    radar: { spotterState: "clear", active: contacts.length > 0, contacts },
    relative: { entries: [] },
    standings: { mode: "overall", entries: [] },
  };
}

describe("runtime module visibility", () => {
  const radar = moduleWithId("com.apexhud.radar");

  it("hides the radar host while no side car exists", () => {
    expect(shouldHideModuleAtRuntime(radar, snapshot([]), false)).toBe(true);
    expect(shouldHideModuleAtRuntime(radar, snapshot([{ carIndex: 2, side: "unknown", longitudinalMeters: -8, closingSpeedMetersPerSecond: 2, overlap: 0, threat: "fast-approach", confidence: 0.4, isApproaching: true }]), false)).toBe(true);
  });

  it("shows the radar for left or right contacts and in edit mode", () => {
    expect(shouldHideModuleAtRuntime(radar, snapshot([{ carIndex: 2, side: "left", longitudinalMeters: 0, closingSpeedMetersPerSecond: 0, overlap: 0.8, threat: "critical", confidence: 1, isApproaching: false }]), false)).toBe(false);
    expect(shouldHideModuleAtRuntime(radar, snapshot([]), true)).toBe(false);
  });

  it("does not affect other modules", () => {
    expect(shouldHideModuleAtRuntime(moduleWithId("com.apexhud.standings"), snapshot([]), false)).toBe(false);
  });
});
