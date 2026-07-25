import { app } from "electron";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DisplayCompatibilityState {
  found: boolean;
  path: string;
  fullScreenExclusive: boolean;
  borderless: boolean;
  message: string;
}

export class IRacingDisplayManager {
  public async getState(): Promise<DisplayCompatibilityState> {
    const filePath = this.configPath();
    try {
      const raw = await readFile(filePath, "utf8");
      const fullScreen = readIniValue(raw, "Display", "fullScreen") === "1";
      const border = readIniValue(raw, "Display", "border") !== "0";
      return {
        found: true,
        path: filePath,
        fullScreenExclusive: fullScreen,
        borderless: !fullScreen && !border,
        message: fullScreen
          ? "Exclusive fullscreen blocks external overlay windows. Switch to borderless fullscreen."
          : !border
            ? "Borderless fullscreen is configured."
            : "Windowed mode is configured, but the window border is enabled.",
      };
    } catch {
      return {
        found: false,
        path: filePath,
        fullScreenExclusive: false,
        borderless: false,
        message: "rendererDX11Monitor.ini was not found. Launch iRacing on a monitor once first.",
      };
    }
  }

  public async enableBorderless(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<DisplayCompatibilityState> {
    const filePath = this.configPath();
    const raw = await readFile(filePath, "utf8");
    const backupPath = `${filePath}.apexhud-backup`;
    try {
      await copyFile(filePath, backupPath);
    } catch {
      // A previous backup is still useful; configuration update can continue.
    }

    let updated = raw;
    updated = setIniValue(updated, "Display", "fullScreen", "0");
    updated = setIniValue(updated, "Display", "border", "0");
    updated = setIniValue(updated, "Display", "windowedMaximized", "0");
    updated = setIniValue(updated, "Display", "windowedAlignment", "0");
    updated = setIniValue(updated, "Display", "windowedXPos", String(bounds.x));
    updated = setIniValue(updated, "Display", "windowedYPos", String(bounds.y));
    updated = setIniValue(updated, "Display", "windowedWidth", String(bounds.width));
    updated = setIniValue(updated, "Display", "windowedHeight", String(bounds.height));
    await writeFile(filePath, updated, "utf8");

    return {
      found: true,
      path: filePath,
      fullScreenExclusive: false,
      borderless: true,
      message: "Borderless fullscreen configured. Restart the iRacing simulator.",
    };
  }

  private configPath(): string {
    return path.join(app.getPath("documents"), "iRacing", "rendererDX11Monitor.ini");
  }
}

function readIniValue(content: string, section: string, key: string): string | undefined {
  const block = sectionBlock(content, section);
  if (!block) return undefined;
  const match = block.body.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*([^;\\r\\n]*)`, "im"));
  return match?.[1]?.trim();
}

function setIniValue(content: string, section: string, key: string, value: string): string {
  const block = sectionBlock(content, section);
  if (!block) {
    return `${content.trimEnd()}\r\n\r\n[${section}]\r\n${key}=${value}\r\n`;
  }

  const linePattern = new RegExp(`^(\\s*${escapeRegExp(key)}\\s*=)[^;\\r\\n]*(.*)$`, "im");
  if (linePattern.test(block.body)) {
    const nextBody = block.body.replace(linePattern, `$1${value}$2`);
    return content.slice(0, block.start) + nextBody + content.slice(block.end);
  }

  const nextBody = `${block.body.trimEnd()}\r\n${key}=${value}\r\n`;
  return content.slice(0, block.start) + nextBody + content.slice(block.end);
}

function sectionBlock(content: string, section: string): { start: number; end: number; body: string } | undefined {
  const header = new RegExp(`^\\s*\\[${escapeRegExp(section)}\\]\\s*$`, "im").exec(content);
  if (!header || header.index === undefined) return undefined;
  const bodyStart = header.index + header[0].length;
  const rest = content.slice(bodyStart);
  const next = /^\s*\[[^\]]+\]\s*$/m.exec(rest);
  const end = next?.index === undefined ? content.length : bodyStart + next.index;
  return { start: bodyStart, end, body: content.slice(bodyStart, end) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
