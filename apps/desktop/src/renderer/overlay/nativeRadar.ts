import type {
  RadarContact,
  RadarState,
  SettingValue,
} from "@apexhud/protocol";

interface RadarSettings {
  scale: number;
  approachDistance: number;
  accent: string;
  nearby: string;
  danger: string;
  opacity: number;
}

const DEFAULT_SETTINGS: RadarSettings = {
  scale: 1,
  approachDistance: 16,
  accent: "#f4f4f4",
  nearby: "#f0b429",
  danger: "#ef3340",
  opacity: 0.96,
};

/**
 * Radar is rendered in the overlay host instead of an iframe.
 * Chromium can occasionally give transparent out-of-process iframes an opaque
 * backing surface on Windows. A host-native renderer guarantees that the
 * radar contains only the car rectangles and never a panel/background.
 */
export class NativeRadarRenderer {
  private readonly root = document.createElement("div");
  private readonly contacts = document.createElement("div");
  private readonly player = document.createElement("div");
  private readonly contactElements = new Map<string, HTMLDivElement>();
  private settings: RadarSettings = { ...DEFAULT_SETTINGS };
  private latest: RadarState | undefined;
  private visible = false;
  private editMode = false;

  public constructor(host: HTMLElement) {
    this.root.className = "native-radar";
    this.contacts.className = "native-radar-contacts";
    this.player.className = "native-radar-player";
    this.root.append(this.contacts, this.player);
    host.append(this.root);
    this.applySettings();
    this.render();
  }

  public setSettings(values: Record<string, SettingValue>): void {
    this.settings = {
      ...this.settings,
      scale: finite(values.scale, this.settings.scale),
      approachDistance: finite(
        values.approachDistance,
        this.settings.approachDistance,
      ),
      accent: color(values.accent, this.settings.accent),
      nearby: color(values.nearby, this.settings.nearby),
      danger: color(values.danger, this.settings.danger),
      opacity: finite(values.opacity, this.settings.opacity),
    };
    this.applySettings();
    this.render();
  }

  public setVisibility(visible: boolean, editMode: boolean): void {
    this.visible = visible;
    this.editMode = editMode;
    this.root.classList.toggle("editing", editMode);
    this.render();
  }

  public setRadar(radar: RadarState | undefined): void {
    this.latest = radar;
    this.render();
  }

  public destroy(): void {
    this.root.remove();
    this.contactElements.clear();
  }

  private applySettings(): void {
    this.root.style.setProperty("--radar-scale", String(clamp(this.settings.scale, 0.6, 1.5)));
    this.root.style.setProperty("--radar-player", this.settings.accent);
    this.root.style.setProperty("--radar-nearby", this.settings.nearby);
    this.root.style.setProperty("--radar-danger", this.settings.danger);
    this.root.style.setProperty("--radar-opacity", String(clamp(this.settings.opacity, 0.2, 1)));
  }

  private render(): void {
    const realContacts = Array.isArray(this.latest?.contacts)
      ? this.latest!.contacts.filter(isSideContact)
      : [];
    const contacts = this.editMode && realContacts.length === 0
      ? previewContacts()
      : realContacts;
    const active = contacts.length > 0;

    this.root.classList.toggle("active", (this.visible || this.editMode) && (active || this.editMode));
    this.root.classList.toggle("has-left", contacts.some((item) => item.side === "left"));
    this.root.classList.toggle("has-right", contacts.some((item) => item.side === "right"));

    const keys = new Set<string>();
    const sideSlots = { left: 0, right: 0 };
    const range = Math.max(4, this.settings.approachDistance);

    for (const contact of contacts) {
      const side = contact.side as "left" | "right";
      const slot = sideSlots[side]++;
      const key = `${side}:${contact.carIndex}:${slot}`;
      keys.add(key);

      let element = this.contactElements.get(key);
      if (!element) {
        element = document.createElement("div");
        element.className = "native-radar-contact";
        this.contacts.append(element);
        this.contactElements.set(key, element);
      }

      const longitudinal = clamp(finite(contact.longitudinalMeters, 0), -range, range);
      const overlap = clamp(finite(contact.overlap, 0.55), 0, 1);
      const confidence = clamp(finite(contact.confidence, 0.75), 0, 1);
      const top = clamp(50 - (longitudinal / range) * 34, 13, 87);
      const height = 25 + overlap * 12;
      const offset = slot * 13;

      element.dataset.side = side;
      element.dataset.threat = String(contact.threat || "nearby");
      element.style.top = `${top}%`;
      element.style.height = `${height}%`;
      element.style.opacity = String(0.72 + confidence * 0.28);
      element.style.setProperty("--radar-slot-offset", `${offset}%`);
    }

    for (const [key, element] of this.contactElements) {
      if (keys.has(key)) continue;
      element.remove();
      this.contactElements.delete(key);
    }
  }
}

function isSideContact(contact: RadarContact): boolean {
  return contact.side === "left" || contact.side === "right";
}

function previewContacts(): RadarContact[] {
  return [
    {
      carIndex: -101,
      side: "left",
      longitudinalMeters: -1.1,
      closingSpeedMetersPerSecond: 0,
      overlap: 0.72,
      threat: "nearby",
      confidence: 1,
      isApproaching: false,
    },
    {
      carIndex: -102,
      side: "right",
      longitudinalMeters: 2.2,
      closingSpeedMetersPerSecond: 0,
      overlap: 0.5,
      threat: "warning",
      confidence: 1,
      isApproaching: false,
    },
  ];
}

function finite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
