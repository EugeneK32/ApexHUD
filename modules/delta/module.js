(() => {
  "use strict";
  const root = document.getElementById("delta");
  const value = document.getElementById("value");
  const validity = document.getElementById("validity");
  const validityLabel = document.getElementById("validity-label");
  const meter = document.querySelector(".meter");
  const meterMarker = document.getElementById("meter-marker");
  const current = document.getElementById("current");
  const best = document.getElementById("best");
  let settings = { showTimes: true, decimals: 3, gainColor: "#36c96b", lossColor: "#ef4444", opacity: .92 };
  let latest;

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      applySettings();
      render();
    } else if (message.type === "apex:frame") {
      latest = message.payload?.timing;
      render();
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function applySettings() {
    root.style.setProperty("--gain", String(settings.gainColor || "#36c96b"));
    root.style.setProperty("--loss", String(settings.lossColor || "#ef4444"));
    root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
    root.classList.toggle("hide-times", !settings.showTimes);
  }

  function render() {
    const timing = latest || {};
    const status = String(timing.validity || "unavailable");
    const available = Boolean(timing.deltaAvailable);
    const delta = number(timing.deltaToBestSeconds, 0);
    const digits = Math.max(2, Math.min(4, Math.round(number(settings.decimals, 3))));

    value.className = "";
    meter.className = "meter";
    if (available) {
      const state = delta <= 0 ? "gain" : "loss";
      value.classList.add(state);
      meter.classList.add(state);
      value.textContent = `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(digits)}`;
      const normalized = Math.max(-1, Math.min(1, delta));
      meterMarker.style.top = `${50 - normalized * 30}%`;
    } else if (status === "invalid") {
      value.classList.add("loss", "invalid-copy");
      value.textContent = "INVALID";
      meter.classList.add("loss");
      meterMarker.style.top = "20%";
    } else {
      value.textContent = "--.---";
      meterMarker.style.top = "50%";
    }

    validity.className = `validity ${status}`;
    validityLabel.textContent = status === "valid" ? "VALID" : status === "invalid" ? "INVALID" : "NO DATA";
    current.textContent = lapTime(timing.currentLapSeconds);
    best.textContent = lapTime(timing.bestLapSeconds);
  }

  function lapTime(raw) {
    const secondsValue = number(raw, 0);
    if (secondsValue <= 0) return "—";
    const minutes = Math.floor(secondsValue / 60);
    const seconds = secondsValue - minutes * 60;
    return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
  }

  function number(raw, fallback) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  applySettings();
  render();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.delta" }, "*");
})();
