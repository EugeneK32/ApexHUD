(() => {
  "use strict";
  const root = document.getElementById("inputs");
  const throttleLine = document.getElementById("throttle-line");
  const brakeLine = document.getElementById("brake-line");
  const clutchLine = document.getElementById("clutch-line");
  const throttleBar = document.getElementById("thr-bar");
  const brakeBar = document.getElementById("brk-bar");
  const clutchBar = document.getElementById("clt-bar");
  const throttleValue = document.getElementById("thr-value");
  const brakeValue = document.getElementById("brk-value");
  const clutchValue = document.getElementById("clt-value");
  const steeringMarker = document.getElementById("steering-marker");
  const steeringValue = document.getElementById("steering-value");

  let settings = {
    throttleColor: "#42d36f",
    brakeColor: "#ff5252",
    clutchColor: "#d8dde5",
    historySeconds: 4,
    lineWidth: 1.8,
    showClutch: true,
    opacity: .9,
  };
  let throttleHistory = [];
  let brakeHistory = [];
  let clutchHistory = [];

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      applySettings();
    } else if (message.type === "apex:frame") {
      render(message.payload?.vehicle || {});
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function applySettings() {
    root.style.setProperty("--thr", String(settings.throttleColor || "#42d36f"));
    root.style.setProperty("--brk", String(settings.brakeColor || "#ff5252"));
    root.style.setProperty("--clt", String(settings.clutchColor || "#d8dde5"));
    root.style.setProperty("--line", `${number(settings.lineWidth, 1.8)}px`);
    root.style.setProperty("--opacity", String(number(settings.opacity, .9)));
    root.classList.toggle("hide-clutch", !settings.showClutch);
    trimHistory();
  }

  function render(vehicle) {
    const throttle = clamp(number(vehicle.throttle, 0));
    const brake = clamp(number(vehicle.brake, 0));
    const clutch = clamp(number(vehicle.clutch, 0));
    const steeringRadians = number(vehicle.steeringWheelAngleRadians, 0);

    throttleHistory.push(throttle);
    brakeHistory.push(brake);
    clutchHistory.push(clutch);
    trimHistory();

    throttleLine.setAttribute("points", points(throttleHistory));
    brakeLine.setAttribute("points", points(brakeHistory));
    clutchLine.setAttribute("points", points(clutchHistory));
    throttleBar.style.height = `${throttle * 100}%`;
    brakeBar.style.height = `${brake * 100}%`;
    clutchBar.style.height = `${clutch * 100}%`;
    throttleValue.textContent = String(Math.round(throttle * 100));
    brakeValue.textContent = String(Math.round(brake * 100));
    clutchValue.textContent = String(Math.round(clutch * 100));

    // iRacing steering angle uses the opposite sign to the visual gauge.
    const displayRadians = -steeringRadians;
    const degrees = displayRadians * 57.2958;
    const normalized = Math.max(-1, Math.min(1, displayRadians / 1.8));
    steeringMarker.style.transform = `translateX(-50%) rotate(${normalized * 210 - 45}deg)`;
    steeringValue.textContent = `${Math.round(degrees)}°`;
  }

  function trimHistory() {
    const maximum = Math.max(30, Math.round(number(settings.historySeconds, 4) * 30));
    if (throttleHistory.length > maximum) throttleHistory = throttleHistory.slice(-maximum);
    if (brakeHistory.length > maximum) brakeHistory = brakeHistory.slice(-maximum);
    if (clutchHistory.length > maximum) clutchHistory = clutchHistory.slice(-maximum);
  }

  function points(values) {
    if (values.length === 0) return "";
    const denominator = Math.max(1, values.length - 1);
    return values.map((value, index) => `${1 + index / denominator * 98},${97 - clamp(value) * 94}`).join(" ");
  }

  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  applySettings();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.inputs" }, "*");
})();
