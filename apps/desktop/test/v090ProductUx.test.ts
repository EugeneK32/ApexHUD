import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

async function source(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

describe("0.9 product UX", () => {
  it("turns Modules into a read-only installed library", async () => {
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(control).toContain('title: "moduleLibrary"');
    expect(control).toContain('id="library-edit-overlay"');
    expect(control).toContain('id="module-origin"');
    expect(control).toContain("previewUrl");
    expect(control).not.toContain("private async addInstance(");
    expect(control).not.toContain('class="button secondary small">${escapeHtml(this.t("add"))}');
  });

  it("distinguishes built-in, community and local modules", async () => {
    const protocol = await source("packages/protocol/src/index.ts");
    const catalog = await source("apps/desktop/src/main/moduleCatalog.ts");
    const community = await source("apps/desktop/src/main/communityModuleService.ts");
    expect(protocol).toContain('"built-in" | "local" | "community"');
    expect(catalog).toContain('.apexhud-community.json');
    expect(catalog).toContain("previewUrl");
    expect(community).toContain('.apexhud-community.json');
  });

  it("uses the ApexHUD icon in native windows, tray and Control Center", async () => {
    const main = await source("apps/desktop/src/main/index.ts");
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(main).toContain('app.setAppUserModelId("com.apexhud.desktop")');
    expect(main).toContain("icon: appIconPath()");
    expect(main).toContain("brandImagePath()");
    expect(control).toContain('app-icon.png');
  });
});
