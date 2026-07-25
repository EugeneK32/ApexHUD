import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

type Entry = {
  carIndex: number;
  position: number;
  classPosition?: number;
  carClassId?: number;
  carClassName?: string;
  isPlayer?: boolean;
};

type WindowingApi = {
  identifyPlayerEntries: (entries: Entry[], player?: Record<string, unknown>) => Entry[];
  selectGroupedStandings: (
    entries: Entry[],
    rows: number,
    playerCarIndex?: number,
    focusMode?: string,
  ) => Array<{ entries: Entry[]; totalCount: number }>;
  selectVisibleStandings: (
    entries: Entry[],
    rows: number,
    playerCarIndex?: number,
    positionKey?: string,
    focusMode?: string,
  ) => Entry[];
};

let api: WindowingApi;

beforeAll(async () => {
  const source = await readFile(path.join(root, "modules/standings/windowing.js"), "utf8");
  const browserWindow: { StandingsWindowing?: WindowingApi } = {};
  runInNewContext(source, { window: browserWindow });
  if (!browserWindow.StandingsWindowing) {
    throw new Error("standings windowing helper did not expose its classic-script API");
  }
  api = browserWindow.StandingsWindowing;
});

function field(size: number, playerPosition: number): Entry[] {
  return Array.from({ length: size }, (_, index) => ({
    carIndex: index,
    position: index + 1,
    isPlayer: index + 1 === playerPosition,
  }));
}

function positions(entries: Entry[]): number[] {
  return Array.from(entries, (entry) => entry.position);
}

describe("standings visible window", () => {
  it("keeps the normal top rows when the player is already visible", () => {
    expect(positions(api.selectVisibleStandings(field(30, 8), 12))).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  it("keeps leaders plus a three-car battle context around a distant player", () => {
    expect(positions(api.selectVisibleStandings(field(30, 20), 12))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 20, 21,
    ]);
  });

  it("keeps the final three cars when the player is last", () => {
    expect(positions(api.selectVisibleStandings(field(20, 20), 12))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 19, 20,
    ]);
  });

  it("supports leader-only and player-centered focus modes", () => {
    expect(positions(api.selectVisibleStandings(field(30, 20), 12, -1, "position", "leaders")))
      .toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(positions(api.selectVisibleStandings(field(30, 20), 12, -1, "position", "player")))
      .toEqual(Array.from({ length: 12 }, (_, index) => index + 15));
  });

  it("pins the player by car index when the backend flag is missing", () => {
    expect(positions(api.selectVisibleStandings(field(30, -1), 12, 19))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 20, 21,
    ]);
  });

  it("restores the player marker from the player snapshot", () => {
    const identified = api.identifyPlayerEntries(field(20, -1), { carIndex: 11 });
    expect(Array.from(identified).filter((entry) => entry.isPlayer).map((entry) => entry.position))
      .toEqual([12]);
  });

  it("prefers the live player car index over a stale backend marker", () => {
    const identified = api.identifyPlayerEntries(field(30, 4), { carIndex: 19 });
    expect(Array.from(identified).filter((entry) => entry.isPlayer).map((entry) => entry.position))
      .toEqual([20]);
    expect(positions(api.selectVisibleStandings(identified, 12, 19))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 20, 21,
    ]);
  });
});

describe("multiclass standings", () => {
  it("splits rows by class and keeps the player in the player class", () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({
      carIndex: index,
      position: index + 1,
      classPosition: Math.floor(index / 2) + 1,
      carClassId: index % 2,
      carClassName: index % 2 === 0 ? "GT3" : "LMP2",
      isPlayer: index === 17,
    }));

    const groups = api.selectGroupedStandings(entries, 12, 17);
    expect(groups).toHaveLength(2);
    expect(groups.reduce((sum, group) => sum + group.entries.length, 0)).toBeLessThanOrEqual(12);
    expect(groups.flatMap((group) => Array.from(group.entries)).some((entry) => entry.carIndex === 17))
      .toBe(true);
    expect(groups.every((group) => group.entries.length > 0 && group.totalCount === 10)).toBe(true);
  });
});
