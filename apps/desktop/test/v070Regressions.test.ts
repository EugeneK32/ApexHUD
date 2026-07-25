import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("0.7 regressions", () => {
  it("renders steering with the corrected direction", async () => {
    const source = await readFile(path.join(root, "modules/inputs/module.js"), "utf8");
    expect(source).toContain("displayRadians = -steeringRadians");
  });

  it("saves before leaving edit mode and keeps the active session latched", async () => {
    const overlay = await readFile(
      path.join(root, "apps/desktop/src/renderer/overlay/index.ts"),
      "utf8",
    );
    const main = await readFile(path.join(root, "apps/desktop/src/main/index.ts"), "utf8");
    expect(overlay).toMatch(/await this\.saveLayout\(\);\s*await window\.apexDesktop\.setEditMode\(false\)/s);
    expect(main).toContain("if (editMode && !active) return;");
    expect(main).toContain("overlayWindow?.blur();");
  });

  it("ships a real multi-size Windows icon", async () => {
    const icon = path.join(root, "apps/desktop/assets/app-icon.ico");
    const body = await readFile(icon);
    const info = await stat(icon);
    expect(info.size).toBeGreaterThan(10_000);
    expect(body[0]).toBe(0);
    expect(body[1]).toBe(0);
    expect(body[2]).toBe(1);
    expect(body[3]).toBe(0);
    expect(body.readUInt16LE(4)).toBeGreaterThanOrEqual(5);
  });

  it("does not destroy node_modules during a normal build", async () => {
    const source = await readFile(path.join(root, "scripts/build.ps1"), "utf8");
    expect(source).toContain("[switch]$InstallDependencies");
    expect(source).toContain("$MissingTools.Count -gt 0");
    expect(source).not.toMatch(/Write-Host '\[1\/4\][^']*'[^\n]*\nnpm ci/);
  });

  it("persists the schema-v3 migration instead of repeating it every launch", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/main/layoutStore.ts"),
      "utf8",
    );
    expect(source).toContain("requiresSchemaUpgrade");
    expect(source).toContain("this.cached = await this.save(this.cached)");
  });

  it("supports Git catalogs, submodules, previews and portable Git", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/main/communityModuleService.ts"),
      "utf8",
    );
    expect(source).toContain("--recurse-submodules");
    expect(source).toContain("submodule");
    expect(source).toContain("previewDataUrl");
    expect(source).toContain('bin", "git", "cmd", "git.exe"');
  });
});
