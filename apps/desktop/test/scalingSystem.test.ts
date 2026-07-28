import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveHudScale, resolveInterfaceScale } from "../src/shared/scaling";

const root = path.resolve(import.meta.dirname, "../../..");
const source = (relative: string) => readFile(path.join(root, relative), "utf8");

describe("resolution-independent scaling", () => {
  it("resolves automatic scale only when OS scaling is not already active", () => {
    expect(resolveInterfaceScale("auto", 1920, 1080, 1)).toBe(1);
    expect(resolveInterfaceScale("auto", 2560, 1440, 1)).toBe(1.25);
    expect(resolveInterfaceScale("auto", 3840, 2160, 1)).toBe(1.5);
    expect(resolveInterfaceScale("auto", 2560, 1440, 1.5)).toBe(1);
  });

  it("lets HUD scale follow or override interface scale", () => {
    expect(resolveHudScale("interface", 1.5)).toBe(1.5);
    expect(resolveHudScale(1.25, 1.5)).toBe(1.25);
  });

  it("isolates Control Center browser zoom from the overlay session", async () => {
    const main = await source("apps/desktop/src/main/index.ts");
    expect(main).toContain('partition: "persist:apexhud-control"');
    expect(main).toContain("controlWindow.webContents.setZoomFactor(factor)");
    expect(main).not.toContain("overlayWindow.webContents.setZoomFactor");
  });

  it("registers module previews in the isolated Control Center session", async () => {
    const main = await source("apps/desktop/src/main/index.ts");
    const catalog = await source("apps/desktop/src/main/moduleCatalog.ts");
    expect(main).toContain("modules.registerProtocolHandler(controlWindow.webContents.session)");
    expect(catalog).toContain("targetSession?.protocol ?? protocol");
    expect(catalog).toContain('targetProtocol.handle("apex-module"');
  });

  it("scales module contents without changing module frame bounds", async () => {
    const overlay = await source("apps/desktop/src/renderer/overlay/index.ts");
    const css = await source("apps/desktop/src/renderer/overlay/overlay.css");
    expect(overlay).toContain('scaleStage.className = "module-scale-stage"');
    expect(overlay).toContain("const inverse = 100 / this.resolvedHudScale");
    expect(overlay).toContain("frame.scaleStage.style.transform");
    expect(css).toContain(".module-scale-stage");
    expect(overlay).not.toContain("frame.element.style.transform = `scale(");
  });

  it("exposes both interface and HUD scale controls", async () => {
    const control = await source("apps/desktop/src/renderer/control/index.ts");
    expect(control).toContain('id="interface-scale-select"');
    expect(control).toContain('id="hud-scale-select"');
    expect(control).toContain('value="interface"');
  });
});
