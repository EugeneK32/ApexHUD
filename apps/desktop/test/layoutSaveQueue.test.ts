import { describe, expect, it } from "vitest";
import { SerializedLayoutWriter } from "../src/renderer/overlay/layoutSaveQueue";

interface Layout {
  a: number;
  b: number;
}

describe("SerializedLayoutWriter", () => {
  it("persists a newer complete snapshot after an older save resolves", async () => {
    let live: Layout = { a: 0, b: 0 };
    const persisted: Layout[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const writer = new SerializedLayoutWriter(
      () => structuredClone(live),
      async (snapshot) => {
        persisted.push(structuredClone(snapshot));
        if (persisted.length === 1) await firstGate;
        return snapshot;
      },
      JSON.stringify,
      () => undefined,
    );

    live.a = 10;
    writer.markDirty();
    const firstFlush = writer.flush();

    await Promise.resolve();
    live.b = 20;
    writer.markDirty();
    await writer.flush();

    releaseFirst();
    await firstFlush;

    expect(persisted).toEqual([
      { a: 10, b: 0 },
      { a: 10, b: 20 },
    ]);
    expect(writer.hasPendingChanges).toBe(false);
  });
});
