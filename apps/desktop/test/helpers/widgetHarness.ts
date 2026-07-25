import { runInNewContext } from "node:vm";

export class FakeClassList implements Iterable<string> {
  private readonly values = new Set<string>();

  add(...names: string[]): void {
    for (const name of names) this.values.add(name);
  }

  remove(...names: string[]): void {
    for (const name of names) this.values.delete(name);
  }

  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(name);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name: string): boolean {
    return this.values.has(name);
  }

  replaceFrom(value: string): void {
    this.values.clear();
    for (const name of value.split(/\s+/).filter(Boolean)) this.values.add(name);
  }

  [Symbol.iterator](): Iterator<string> {
    return this.values[Symbol.iterator]();
  }
}

export class FakeElement {
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string | ((name: string, value: string) => void)>;
  textContent = "";
  title = "";
  private classValue = "";

  constructor(
    readonly id = "",
    private readonly rect = { width: 100, height: 100 },
  ) {
    const style: FakeElement["style"] = {
      setProperty(name: string, value: string) {
        style[name] = value;
      },
    };
    this.style = style;
  }

  get className(): string {
    return this.classValue;
  }

  set className(value: string) {
    this.classValue = value;
    this.classList.replaceFrom(value);
  }

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  appendChild(node: FakeElement): FakeElement {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getBoundingClientRect(): {
    width: number;
    height: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
    x: number;
    y: number;
    toJSON: () => object;
  } {
    return {
      ...this.rect,
      left: 0,
      top: 0,
      right: this.rect.width,
      bottom: this.rect.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  }
}

export interface WidgetDefinition {
  moduleId: string;
  rootId: string;
  defaults: Record<string, unknown>;
  demo?: Record<string, unknown>;
  applySettings: (settings: Record<string, any>) => void;
  render: (
    payload: Record<string, any>,
    context: {
      settings: Record<string, any>;
      hasFrame: boolean;
      editMode?: boolean;
      preview?: boolean;
    },
  ) => void;
}

interface HarnessOptions {
  elementFactory?: (id: string) => FakeElement;
  globals?: Record<string, unknown>;
  windowProperties?: Record<string, unknown>;
}

function formatDuration(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function runClassicWidget(source: string, options: HarnessOptions = {}): {
  definition: WidgetDefinition;
  elements: Map<string, FakeElement>;
  windowObject: Record<string, any>;
} {
  const elements = new Map<string, FakeElement>();
  const documentElement = new FakeElement("documentElement");
  let definition: WidgetDefinition | undefined;

  const runtime = {
    start(value: WidgetDefinition) {
      definition = value;
    },
    number(value: unknown, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    positive(value: unknown, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    },
    clamp(value: number, minimum: number, maximum: number) {
      return Math.min(maximum, Math.max(minimum, value));
    },
    hexToRgba(color: unknown, alpha: unknown) {
      const value = String(color || "#000000").replace("#", "");
      const normalized = value.length === 3
        ? value.split("").map((character) => character + character).join("")
        : value.padEnd(6, "0").slice(0, 6);
      const red = Number.parseInt(normalized.slice(0, 2), 16) || 0;
      const green = Number.parseInt(normalized.slice(2, 4), 16) || 0;
      const blue = Number.parseInt(normalized.slice(4, 6), 16) || 0;
      return `rgba(${red}, ${green}, ${blue}, ${Number(alpha)})`;
    },
    formatDuration,
    formatLap(value: unknown) {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds <= 0) return "—";
      const minutes = Math.floor(seconds / 60);
      return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
    },
  };

  const documentObject = {
    documentElement,
    getElementById(id: string): FakeElement {
      let element = elements.get(id);
      if (!element) {
        element = options.elementFactory?.(id) ?? new FakeElement(id);
        elements.set(id, element);
      }
      return element;
    },
    createElement(): FakeElement {
      return new FakeElement();
    },
  };

  const windowObject: Record<string, any> = {
    ApexRuntime: runtime,
    parent: { postMessage: () => undefined },
    devicePixelRatio: 1,
    ...options.windowProperties,
  };
  windowObject.window = windowObject;

  runInNewContext(source, {
    window: windowObject,
    document: documentObject,
    location: { search: "" },
    URLSearchParams,
    performance: { now: () => 0 },
    ResizeObserver: class {
      constructor(_callback: () => void) {}
      observe(): void {}
      disconnect(): void {}
    },
    console,
    ...options.globals,
  });

  if (!definition) throw new Error("Widget did not register through ApexRuntime.start");
  return { definition, elements, windowObject };
}
