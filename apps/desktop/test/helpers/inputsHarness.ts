import { FakeElement, runClassicWidget, type WidgetDefinition } from "./widgetHarness";

export interface StrokePath {
  strokeStyle: string;
  globalAlpha: number;
  points: Array<[number, number]>;
}

export class RecordingCanvasContext {
  strokeStyle = "";
  fillStyle = "";
  lineWidth = 1;
  globalAlpha = 1;
  lineCap = "butt";
  lineJoin = "miter";
  readonly strokes: StrokePath[] = [];
  private path: Array<[number, number]> = [];

  beginPath(): void {
    this.path = [];
  }

  moveTo(x: number, y: number): void {
    this.path.push([x, y]);
  }

  lineTo(x: number, y: number): void {
    this.path.push([x, y]);
  }

  stroke(): void {
    this.strokes.push({
      strokeStyle: String(this.strokeStyle),
      globalAlpha: this.globalAlpha,
      points: this.path.map(([x, y]) => [x, y]),
    });
  }

  clearRect(): void {}
  setTransform(): void {}
  setLineDash(): void {}
}

class FakeCanvasElement extends FakeElement {
  width = 100;
  height = 100;

  constructor(id: string, private readonly context: RecordingCanvasContext) {
    super(id, { width: 100, height: 100 });
  }

  getContext(): RecordingCanvasContext {
    return this.context;
  }
}

export function createInputsHarness(source: string): {
  definition: WidgetDefinition;
  elements: Map<string, FakeElement>;
  context: RecordingCanvasContext;
  setNow: (value: number) => void;
} {
  const context = new RecordingCanvasContext();
  let now = 0;
  const harness = runClassicWidget(source, {
    elementFactory(id) {
      return id === "input-graph"
        ? new FakeCanvasElement(id, context)
        : new FakeElement(id);
    },
    globals: {
      performance: { now: () => now },
      ResizeObserver: class {
        constructor(_callback: () => void) {}
        observe(): void {}
        disconnect(): void {}
      },
    },
  });

  return {
    ...harness,
    context,
    setNow(value: number) {
      now = value;
    },
  };
}
