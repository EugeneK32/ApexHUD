import {
  isTelemetrySnapshot,
  type TelemetrySnapshot,
} from "@apexhud/protocol";

export type TelemetryStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "invalid";

export class TelemetryClient {
  private socket: WebSocket | undefined;
  private reconnectTimer: number | undefined;
  private reconnectAttempt = 0;
  private closed = false;

  public constructor(
    private readonly url: string,
    private readonly onFrame: (frame: TelemetrySnapshot) => void,
    private readonly onStatus: (status: TelemetryStatus) => void,
  ) {}

  public start(): void {
    this.closed = false;
    this.connect();
  }

  public stop(): void {
    this.closed = true;
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.socket?.close();
    this.socket = undefined;
  }

  private connect(): void {
    if (this.closed) return;

    this.onStatus("connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.onStatus("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (!isTelemetrySnapshot(parsed)) {
          this.onStatus("invalid");
          return;
        }

        this.onFrame(parsed);
      } catch {
        this.onStatus("invalid");
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket === socket) {
        this.socket = undefined;
      }
      this.onStatus("disconnected");
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== undefined) return;

    const delay = Math.min(5000, 350 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt = Math.min(6, this.reconnectAttempt + 1);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }
}
