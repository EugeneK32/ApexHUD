import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const source = (relative: string) => readFile(path.join(root, relative), "utf8");

describe("0.12 desktop UX", () => {
  it("shows startup feedback and keeps one application instance", async () => {
    const main = await source("apps/desktop/src/main/index.ts");
    const vite = await source("apps/desktop/vite.config.ts");
    expect(main).toContain("requestSingleInstanceLock");
    expect(main).toContain("createSplashWindow");
    expect(main).toContain('"splash.html"');
    expect(vite).toMatch(/splash\s*:\s*resolve\([^)]*["']splash\.html["']\)/);
  });

  it("makes editor chrome compact and movable", async () => {
    const overlay = await source("apps/desktop/src/renderer/overlay/index.ts");
    const css = await source("apps/desktop/src/renderer/overlay/overlay.css");
    expect(overlay).toContain("apexhud.editor.toolbar-position");
    expect(overlay).toContain("apexhud.editor.inspector-position");
    expect(overlay).toContain("bindFloatingPanelDrag");
    expect(css).toContain("toolbar-drag-handle");
    expect(css).toContain("inspector-drag-handle");
  });

  it("supports assignable global shortcuts", async () => {
    const protocol = await source("packages/protocol/src/index.ts");
    const main = await source("apps/desktop/src/main/index.ts");
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(protocol).toContain("HOTKEY_ACTIONS");
    expect(main).toContain("registerHotkeys(preferences.hotkeys)");
    expect(main).toContain('"hotkeys:begin-capture"');
    expect(main).toContain('"hotkeys:end-capture"');
    expect(control).toContain("data-hotkey-action");
    expect(control).toContain("acceleratorFromEvent");
    expect(control).toContain('event.code.startsWith("Key")');
  });

  it("keeps home actions neutral and free of decorative navigation glyphs", async () => {
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    const css = await source("apps/desktop/src/renderer/control/control.css");
    expect(control).not.toMatch(/class="action-panel"[^>]*>\s*<span/);
    expect(control).not.toMatch(/class="action-panel"[\s\S]*?<i>→<\/i>/);
    expect(css).not.toContain("border-radius: 50%;\n  background: #1c232b");
  });

  it("adds a dedicated Time Trial layout before qualifying", async () => {
    const protocol = await source("packages/protocol/src/index.ts");
    const detector = await source("apps/desktop/src/renderer/shared/layoutScenario.ts");
    expect(protocol).toContain('"time-trial"');
    expect(detector.indexOf('return "time-trial"')).toBeLessThan(detector.indexOf('return "qualifying"'));
  });
});
