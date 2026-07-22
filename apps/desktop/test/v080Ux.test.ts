import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scenarioLabel, SUPPORTED_LOCALES, translate } from "../src/renderer/shared/i18n";

const root = path.resolve(import.meta.dirname, "../../..");

describe("0.8 Control Center and editor UX", () => {
  it("ships the main interface languages including Russian", () => {
    expect(SUPPORTED_LOCALES.map((item) => item.value)).toEqual(
      expect.arrayContaining(["en", "ru", "de", "fr", "es", "it", "pt-BR", "pl", "zh-CN", "ja"]),
    );
    expect(translate("ru", "layouts")).toBe("Раскладки");
    expect(scenarioLabel("ru", "test-drive")).toBe("Тестовый заезд");
  });

  it("guides users from layout set to Base Layout and session layouts", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/control/index.ts"),
      "utf8",
    );
    expect(source).toContain("layout-journey");
    expect(source).toContain("chooseLayoutSet");
    expect(source).toContain("chooseSessionLayout");
    expect(source).toContain("base-layout-card");
    expect(source).not.toContain("MODULES IN LAYER");
    expect(source).not.toContain('id="instance-list"');
  });

  it("uses in-window dropdowns and a custom color picker", async () => {
    const source = await readFile(
      path.join(root, "apps/desktop/src/renderer/overlay/index.ts"),
      "utf8",
    );
    expect(source).toContain("editorDropdown(");
    expect(source).toContain("settingDropdown(");
    expect(source).toContain("colorPicker(");
    expect(source).toContain("color-sv-area");
    expect(source).not.toContain('document.createElement("select")');
    expect(source).not.toContain('input.type = "color"');
  });
});
