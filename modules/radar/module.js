(() => {
  "use strict";

  const MODULE_ID = "com.apexhud.radar";
  const root = document.getElementById("radar");
  const leftHost = document.getElementById("left-contacts");
  const rightHost = document.getElementById("right-contacts");
  const contactElements = new Map();

  let latestRadar;
  let hostVisible = false;
  let editMode = false;
  let settings = {
    scale: 1,
    showApproach: false,
    approachDistance: 16,
    accent: "#e5e7eb",
    nearby: "#f2c94c",
    danger: "#ef4444",
    opacity: 0.94,
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      applySettings();
      render(latestRadar);
      return;
    }

    if (message.type === "apex:frame") {
      latestRadar = message.payload?.radar;
      render(latestRadar);
      return;
    }

    if (message.type === "apex:visibility") {
      hostVisible = Boolean(message.visible);
      editMode = Boolean(message.editMode);
      render(latestRadar);
    }
  });

  function applySettings() {
    root.style.setProperty("--scale", String(number(settings.scale, 1)));
    root.style.setProperty("--player", String(settings.accent || "#e5e7eb"));
    root.style.setProperty("--nearby", String(settings.nearby || "#f2c94c"));
    root.style.setProperty("--danger", String(settings.danger || "#ef4444"));
    root.style.setProperty("--opacity", String(number(settings.opacity, 0.94)));
  }

  function render(radar) {
    const incoming = Array.isArray(radar?.contacts) ? radar.contacts : [];
    const visualRange = number(settings.approachDistance, 16);
    const sideContacts = incoming
      .filter((contact) => contact.side === "left" || contact.side === "right")
      .sort(sortContacts);
    const active = sideContacts.length > 0;

    root.classList.toggle("host-hidden", !hostVisible && !editMode);
    root.classList.toggle("editing", editMode);
    root.classList.toggle("active", active);

    updateContacts(sideContacts, visualRange);
  }

  function updateContacts(contacts, visualRange) {
    const activeKeys = new Set();
    const counts = { left: 0, right: 0 };

    for (const contact of contacts) {
      const side = contact.side;
      const slot = counts[side]++;
      const key = `${side}:${contact.carIndex}`;
      activeKeys.add(key);

      let element = contactElements.get(key);
      if (!element) {
        element = document.createElement("div");
        element.className = "contact";
        (side === "left" ? leftHost : rightHost).append(element);
        contactElements.set(key, element);
      }

      updateContactElement(element, contact, visualRange, slot);
    }

    for (const [key, element] of contactElements) {
      if (activeKeys.has(key)) continue;
      contactElements.delete(key);
      element.remove();
    }
  }

  function updateContactElement(element, contact, visualRange, slot) {
    const longitudinal = clamp(
      number(contact.longitudinalMeters, 0),
      -visualRange,
      visualRange,
    );
    const overlap = clamp(number(contact.overlap, 0), 0, 1);
    const confidence = clamp(number(contact.confidence, 0.5), 0, 1);
    const top = clamp(50 - (longitudinal / visualRange) * 36, 10, 90);
    const height = 15 + overlap * 15;
    const threat = String(contact.threat || "nearby");

    element.className = `contact ${threat}${slot > 0 ? " secondary" : ""}`;
    element.style.top = `${top}%`;
    element.style.height = `${height}%`;
    element.style.opacity = String(clamp(0.68 + confidence * 0.32, 0.68, 1));
  }

  function sortContacts(left, right) {
    return Math.abs(number(left.longitudinalMeters, 0)) -
      Math.abs(number(right.longitudinalMeters, 0));
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  applySettings();
  render(undefined);
  window.parent.postMessage({ type: "apex:ready", moduleId: MODULE_ID }, "*");
})();
