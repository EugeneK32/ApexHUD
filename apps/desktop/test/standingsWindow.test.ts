import { describe, expect, it } from "vitest";
import { identifyPlayerEntries, selectGroupedStandings, selectVisibleStandings } from "../../../modules/standings/windowing.js";

function field(size: number, playerPosition: number) {
  return Array.from({ length: size }, (_, index) => ({
    carIndex: index,
    position: index + 1,
    isPlayer: index + 1 === playerPosition,
  }));
}

describe("standings visible window", () => {
  it("keeps the normal top rows when the player is already visible", () => {
    const visible = selectVisibleStandings(field(30, 8), 12);
    expect(visible.map((entry) => entry.position)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  it("pins the player and the next car after the leaders", () => {
    const visible = selectVisibleStandings(field(30, 20), 12);
    expect(visible.map((entry) => entry.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21,
    ]);
  });

  it("pins the preceding car when the player is last", () => {
    const visible = selectVisibleStandings(field(20, 20), 12);
    expect(visible.map((entry) => entry.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20,
    ]);
  });


  it("pins the player by car index when the backend flag is missing", () => {
    const entries = field(30, -1);
    const visible = selectVisibleStandings(entries, 12, 19);
    expect(visible.map((entry) => entry.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21,
    ]);
  });

  it("restores the player marker from the player snapshot", () => {
    const entries = field(20, -1);
    const identified = identifyPlayerEntries(entries, { carIndex: 11 });
    expect(identified.filter((entry) => entry.isPlayer).map((entry) => entry.position)).toEqual([12]);
  });


  it("prefers the live player car index over a stale backend marker", () => {
    const entries = field(30, 4);
    const identified = identifyPlayerEntries(entries, { carIndex: 19 });
    expect(identified.filter((entry) => entry.isPlayer).map((entry) => entry.position)).toEqual([20]);
    expect(selectVisibleStandings(identified, 12, 19).map((entry) => entry.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21,
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

    const groups = selectGroupedStandings(entries, 12, 17);
    expect(groups).toHaveLength(2);
    expect(groups.flatMap((group) => group.entries).some((entry) => entry.carIndex === 17)).toBe(true);
    expect(groups.every((group) => group.entries.length > 0)).toBe(true);
  });
});
