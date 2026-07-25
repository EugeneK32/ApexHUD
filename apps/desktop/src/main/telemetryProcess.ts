import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export class TelemetryProcess {
  private child: ChildProcess | undefined;

  public async start(): Promise<void> {
    if (
      process.platform !== "win32" ||
      process.env.APEXHUD_SKIP_TELEMETRY === "1" ||
      (await this.isAlreadyRunning())
    ) {
      return;
    }

    if (app.isPackaged) {
      const executable = path.join(
        process.resourcesPath,
        "telemetry",
        "ApexHUD.Telemetry.exe",
      );
      this.child = spawn(executable, [], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      const project = path.resolve(
        app.getAppPath(),
        "../../services/telemetry/ApexHUD.Telemetry.csproj",
      );
      this.child = spawn(
        "dotnet",
        ["run", "--project", project, "--no-launch-profile"],
        {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    }

    this.child.stdout?.on("data", (value: Buffer) => {
      console.log(`[telemetry] ${value.toString().trimEnd()}`);
    });
    this.child.stderr?.on("data", (value: Buffer) => {
      console.error(`[telemetry] ${value.toString().trimEnd()}`);
    });
    this.child.on("exit", (code) => {
      if (code && code !== 0) {
        console.error(`[telemetry] process exited with code ${code}`);
      }
      this.child = undefined;
    });
    this.child.on("error", (error) => {
      console.error("[telemetry] cannot start service", error);
      this.child = undefined;
    });
  }

  public stop(): void {
    this.child?.kill();
    this.child = undefined;
  }

  private async isAlreadyRunning(): Promise<boolean> {
    try {
      const response = await fetch("http://127.0.0.1:47931/health", {
        signal: AbortSignal.timeout(500),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
