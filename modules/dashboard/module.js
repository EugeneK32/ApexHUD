(() => {
  "use strict";
  const root = document.getElementById("dash");
  const speed = document.getElementById("speed");
  const speedUnit = document.getElementById("speed-unit");
  const gear = document.getElementById("gear");
  const rpm = document.getElementById("rpm");
  const bar = document.getElementById("rpm-bar");
  const rpmState = document.getElementById("rpm-state");
  const lowLabel = document.getElementById("low-label");
  const shiftLabel = document.getElementById("shift-label");
  let settings = {
    speedUnit: "kmh",
    accent: "#19bfe6",
    warningColor: "#f2c94c",
    shiftColor: "#ef4444",
    downshiftColor: "#54a9d1",
    opacity: .92,
  };
  let vehicle = {};
  let driverAids = {};

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      apply();
      render();
    } else if (message.type === "apex:frame") {
      vehicle = message.payload?.vehicle || {};
      driverAids = message.payload?.driverAids || {};
      render();
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function apply() {
    root.style.setProperty("--accent", String(settings.accent || "#19bfe6"));
    root.style.setProperty("--warning", String(settings.warningColor || "#f2c94c"));
    root.style.setProperty("--shift", String(settings.shiftColor || "#ef4444"));
    root.style.setProperty("--downshift", String(settings.downshiftColor || "#54a9d1"));
    root.style.setProperty("--opacity", String(num(settings.opacity, .92)));
  }

  function render() {
    const mps = Math.max(0, num(vehicle.speedMetersPerSecond, 0));
    const isMph = settings.speedUnit === "mph";
    speed.textContent = String(Math.round(mps * (isMph ? 2.236936 : 3.6)));
    speedUnit.textContent = isMph ? "MPH" : "KM/H";

    const currentGear = Math.round(num(vehicle.gear, 0));
    const currentRpm = Math.max(0, num(vehicle.rpm, 0));
    const legacyShiftRpm = Math.max(1000, num(vehicle.shiftRpm, 0));
    const firstRpm = positiveThreshold(vehicle.shiftLightFirstRpm, legacyShiftRpm * .82);
    const shiftRpm = positiveThreshold(vehicle.shiftRpm, firstRpm * 1.16);
    const lastRpm = positiveThreshold(vehicle.shiftLightLastRpm, Math.max(shiftRpm, shiftRpm * 1.035));
    const blinkRpm = positiveThreshold(vehicle.shiftLightBlinkRpm, Math.max(lastRpm, shiftRpm));
    const scaleRpm = Math.max(blinkRpm, lastRpm, shiftRpm, 1000);
    const rpmRatio = Math.max(0, Math.min(1.08, currentRpm / scaleRpm));
    const exactIndicator = optionalUnit(vehicle.shiftIndicatorPercent);
    const ratio = exactIndicator ?? rpmRatio;
    const driveGear = currentGear > 0;

    // Prefer iRacing's live shift-indicator percentage. It follows the car's
    // own dashboard behavior more closely than an RPM-only approximation.
    // Car-specific RPM thresholds remain a fallback when the variable is not
    // available for a vehicle.
    const nearShift = driveGear && (exactIndicator !== null
      ? exactIndicator >= .58
      : currentRpm >= firstRpm);
    const almostShift = driveGear && (exactIndicator !== null
      ? exactIndicator >= .84
      : currentRpm >= shiftRpm);
    const shiftNow = driveGear && (driverAids.revLimiterActive === true
      || (exactIndicator !== null
        ? exactIndicator >= .985
        : currentRpm >= blinkRpm * .995));

    // iRacing does not expose a car-specific downshift command. This is a calm
    // low-RPM suggestion only, gated by driver input so it does not light up
    // while coasting through a corner.
    const downshiftThreshold = Math.max(1800, firstRpm * .54);
    const lowRpm = currentGear > 1
      && mps > 8
      && currentRpm < downshiftThreshold
      && (num(vehicle.throttle, 0) > .18 || num(vehicle.brake, 0) > .12);
    gear.textContent = currentGear < 0 ? "R" : currentGear === 0 ? "N" : String(currentGear);
    rpm.textContent = String(Math.round(currentRpm));
    bar.style.width = `${Math.max(0, (1 - Math.min(1, ratio))) * 100}%`;

    root.classList.toggle("pre-shift", nearShift && !almostShift && !lowRpm);
    root.classList.toggle("almost-shift", almostShift && !shiftNow && !lowRpm);
    root.classList.toggle("shifting", shiftNow && !lowRpm);
    root.classList.toggle("downshift", lowRpm);

    rpmState.textContent = lowRpm ? "LOW RPM" : shiftNow ? "SHIFT NOW" : almostShift ? "READY" : nearShift ? "BUILDING" : "RPM";
    lowLabel.textContent = lowRpm ? "↓ GEAR" : "LOW";
    shiftLabel.textContent = shiftNow ? "NOW" : "SHIFT";
  }

  function optionalUnit(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
  }

  function positiveThreshold(value, fallback) {
    const parsed = num(value, 0);
    return parsed > 0 ? parsed : Math.max(1000, fallback);
  }

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  apply();
  render();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.dashboard" }, "*");
})();
