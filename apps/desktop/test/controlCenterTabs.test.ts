import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("control center navigation", () => {
  it("keeps the main product navigation focused", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/control/index.ts"),
      "utf8",
    );
    for (const tab of ["overview", "layouts", "widgets", "settings"]) {
      expect(source).toContain(`this.tabButton("${tab}"`);
      expect(source).toContain(`data-panel="${tab}"`);
    }
    expect(source).not.toContain('this.tabButton("community"');
    expect(source).not.toContain('data-panel="community"');
  });

  it("combines installed widgets and community discovery in one place", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/control/index.ts"),
      "utf8",
    );
    expect(source).toContain('data-widget-view="installed"');
    expect(source).toContain('data-widget-view="discover"');
    expect(source).toContain('id="module-search"');
    expect(source).toContain('id="copy-source-group"');
    expect(source).toContain('id="copy-target-group"');
    expect(source).toContain('base-layout-card');
  });

  it("renders the Git catalog with previews and update actions", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/control/index.ts"),
      "utf8",
    );
    expect(source).toContain('previewDataUrl');
    expect(source).toContain('refreshCommunityCatalog');
    expect(source).toContain('installCommunityModule');
  });
});
