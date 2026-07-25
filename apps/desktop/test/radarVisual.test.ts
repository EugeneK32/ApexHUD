import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("minimal radar visual", () => {
  it("renders the built-in radar in the transparent overlay host, not an iframe", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/overlay/index.ts"),
      "utf8",
    );
    expect(source).toContain('module.manifest.id === "com.apexhud.radar"');
    expect(source).toContain("new NativeRadarRenderer");
  });

  it("has no panel or player fill behind the car rectangles", async () => {
    const css = await readFile(
      path.join(root, "apps/desktop/src/renderer/overlay/overlay.css"),
      "utf8",
    );
    expect(css).toMatch(/module-frame\[data-module-id="com\.apexhud\.radar"\][\s\S]*?background:\s*transparent\s*!important/si);
    expect(css).toMatch(/\.native-radar-player\s*\{[^}]*background:\s*transparent\s*!important/si);
  });

  it("uses a compact but still readable factory footprint", async () => {
    const manifest = JSON.parse(
      await readFile(path.join(root, "modules/radar/manifest.json"), "utf8"),
    ) as {
      defaultBounds: { width: number; height: number };
      minimumSize: { width: number; height: number };
    };

    expect(manifest.defaultBounds.width).toBeLessThanOrEqual(0.12);
    expect(manifest.defaultBounds.height).toBeLessThanOrEqual(0.22);
    expect(manifest.defaultBounds.width * manifest.defaultBounds.height).toBeLessThanOrEqual(0.025);
    expect(manifest.minimumSize.width).toBeLessThanOrEqual(140);
    expect(manifest.minimumSize.height).toBeLessThanOrEqual(160);
    expect(manifest.minimumSize.width).toBeGreaterThanOrEqual(80);
    expect(manifest.minimumSize.height).toBeGreaterThanOrEqual(100);
  });
});
