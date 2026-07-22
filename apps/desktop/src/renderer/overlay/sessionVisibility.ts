import type {
  OverlayAutoHideMode,
  TelemetrySnapshot,
} from "@apexhud/protocol";

/**
 * IRSDK exists while the simulator is running. Runtime visibility additionally
 * follows the actual simulator window so the HUD never floats over unrelated
 * desktop applications after iRacing is minimized or alt-tabbed away.
 */
export function isRaceOverlayActive(
  frame: TelemetrySnapshot,
  autoHideMode: OverlayAutoHideMode = "not-foreground",
): boolean {
  if (frame.source !== "iracing" || !frame.connection.connected) return false;

  const windowState = frame.connection.simulatorWindow;
  if (!windowState?.processRunning) return true;
  if (!windowState.windowFound) return true;
  if (!windowState.isVisible || windowState.isMinimized) return false;

  if (autoHideMode === "not-foreground") {
    return windowState.isForeground;
  }

  return true;
}
