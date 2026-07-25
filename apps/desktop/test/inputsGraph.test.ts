import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

type MessageListener = (event: { source: unknown; data: unknown }) => void;

type FakeElement = {
  attributes: Map<string, string>;
  classList: { toggle: () => void };
  style: Record<string, unknown> & { setProperty: (name: string, value: string) => void };
  textContent: string;
  setAttribute: (name: string, value: string) => void;
};

function createElement(): FakeElement {
  const style: FakeElement["style"] = {
    setProperty(name, value) {
      style[name] = value;
    },
  };
  const attributes = new Map<string, string>();

  return {
    attributes,
    classList: { toggle: () => undefined },
    style,
    textContent: "",
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
}

function coordinates(points: string): Array<[number, number]> {
  return points.split(" ").filter(Boolean).map((point) => {
    const [x, y] = point.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid SVG point: ${point}`);
    }
    return [x, y];
  });
}

describe("driver input graph", () => {
  it("keeps 0% and 100% traces inside the SVG viewBox", async () => {
    const js = await readFile(path.join(root, "modules/inputs/module.js"), "utf8");
    const css = await readFile(path.join(root, "modules/inputs/style.css"), "utf8");
    const elements = new Map<string, FakeElement>();
    const documentElement = createElement();
    const parentWindow = { postMessage: () => undefined };
    let messageListener: MessageListener | undefined;

    runInNewContext(js, {
      addEventListener(type: string, listener: MessageListener) {
        if (type === "message") messageListener = listener;
      },
      document: {
        documentElement,
        getElementById(id: string) {
          if (!elements.has(id)) elements.set(id, createElement());
          return elements.get(id);
        },
      },
      parent: parentWindow,
    });

    expect(messageListener).toBeTypeOf("function");

    const sendFrame = (throttle: number, brake: number, clutch: number) => {
      messageListener?.({
        source: parentWindow,
        data: {
          type: "apex:frame",
          payload: { vehicle: { throttle, brake, clutch } },
        },
      });
    };

    sendFrame(0, 1, -1);
    sendFrame(1, 0, 2);

    expect(elements.get("throttle-line")?.attributes.get("points")).toBe("1,97 99,3");
    expect(elements.get("brake-line")?.attributes.get("points")).toBe("1,3 99,97");
    expect(elements.get("clutch-line")?.attributes.get("points")).toBe("1,97 99,3");

    for (const id of ["throttle-line", "brake-line", "clutch-line"]) {
      const points = elements.get(id)?.attributes.get("points") ?? "";
      for (const [x, y] of coordinates(points)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }

    expect(css).toMatch(/svg\s*\{[^}]*overflow:\s*hidden/si);
  });
});
