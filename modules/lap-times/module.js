(() => {
  "use strict";
  const root = document.getElementById("times");
  const current = document.getElementById("current");
  const last = document.getElementById("last");
  const best = document.getElementById("best");
  const lap = document.getElementById("lap");
  const delta = document.getElementById("delta");
  const validity = document.getElementById("validity");
  const validityLabel = document.getElementById("validity-label");
  let settings = { decimals: 3, opacity: .92 };

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
    } else if (message.type === "apex:frame") {
      render(message.payload?.timing || {});
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function render(timing) {
    current.textContent = time(timing.currentLapSeconds);
    last.textContent = time(timing.lastLapSeconds);
    best.textContent = time(timing.bestLapSeconds);
    lap.textContent = `LAP ${positive(timing.currentLap)}`;
    const available = Boolean(timing.deltaAvailable);
    const value = number(timing.deltaToBestSeconds, 0);
    const digits = Math.max(2, Math.min(4, Math.trunc(number(settings.decimals, 3))));
    delta.textContent = available ? `${value <= 0 ? "−" : "+"}${Math.abs(value).toFixed(digits)}s` : "NO REFERENCE";
    delta.className = available ? (value <= 0 ? "gain" : "loss") : "";
    const state = String(timing.validity || "unavailable");
    validity.className = state;
    validityLabel.textContent = state === "valid" ? "VALID" : state === "invalid" ? "INVALID" : "NO DATA";
    root.classList.toggle("invalid", state === "invalid");
  }

  function time(value) {
    const secondsValue = number(value, 0);
    if (secondsValue <= 0) return "—";
    const minutes = Math.floor(secondsValue / 60);
    const seconds = secondsValue - minutes * 60;
    return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
  }

  function positive(value) {
    const parsed = Math.trunc(number(value, 0));
    return parsed > 0 ? String(parsed) : "—";
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.lap-times" }, "*");
})();
