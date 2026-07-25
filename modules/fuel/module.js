(() => {
  "use strict";
  const root = document.getElementById("fuel");
  const level = document.getElementById("level");
  const perLap = document.getElementById("per-lap");
  const laps = document.getElementById("laps");
  const add = document.getElementById("add");
  const status = document.getElementById("status");
  const sampleBar = document.getElementById("sample-bar");
  let settings = { safetyMargin: .2, accent: "#f2c94c", opacity: .92 };

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      root.style.setProperty("--accent", String(settings.accent || "#f2c94c"));
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
    } else if (message.type === "apex:frame") {
      render(message.payload?.fuel || {});
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function render(fuel) {
    const ready = Boolean(fuel.estimateReady);
    const samples = Math.max(0, Math.round(number(fuel.samples, 0)));
    level.textContent = number(fuel.levelLiters, 0).toFixed(1);
    perLap.textContent = ready ? number(fuel.estimatedPerLapLiters, 0).toFixed(2) : "—";
    laps.textContent = ready ? number(fuel.estimatedLapsRemaining, 0).toFixed(1) : "—";
    add.textContent = ready
      ? `${Math.max(0, number(fuel.addToFinishLiters, 0) + number(settings.safetyMargin, .2)).toFixed(1)} L`
      : "—";
    status.textContent = ready ? `${Math.max(1, samples)} SAMPLE${samples === 1 ? "" : "S"}` : "LEARNING";
    sampleBar.style.width = `${Math.min(100, samples / 8 * 100)}%`;
    root.classList.toggle("learning", !ready);
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.fuel" }, "*");
})();
