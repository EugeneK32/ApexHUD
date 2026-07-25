import type { DiscoveredModule, TelemetrySnapshot } from "@apexhud/protocol";

export function shouldHideModuleAtRuntime(
  module: DiscoveredModule,
  snapshot: TelemetrySnapshot | undefined,
  editMode: boolean,
): boolean {
  if (editMode) return false;
  if (module.manifest.id !== "com.apexhud.radar") return false;
  if (!snapshot) return true;

  return !snapshot.radar.contacts.some(
    (contact) => contact.side === "left" || contact.side === "right",
  );
}
