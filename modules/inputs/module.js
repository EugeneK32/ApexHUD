(() => {
  "use strict";
  const R = window.ApexRuntime;
  const root = document.getElementById("inputs");
  const ids = ["throttle", "brake", "clutch", "handbrake"];
  const nodes = Object.fromEntries(ids.map((key) => [key, {
    fill: document.getElementById(`${key}-fill`),
    raw: document.getElementById(`${key}-raw`),
    value: document.getElementById(`${key}-value`),
  }]));
  const graphWrap = document.getElementById("graph-wrap");
  const canvas = document.getElementById("input-graph");
  const ctx = canvas.getContext("2d", { alpha: true });
  const steer = {
    fill: document.getElementById("steer-fill"), marker: document.getElementById("steer-marker"),
    angle: document.getElementById("steer-angle"), torque: document.getElementById("torque"),
    bb: document.getElementById("brake-bias"), aids: document.getElementById("aid-summary"),
  };
  const defaults = {
    pedalData: "both", showClutch: true, showHandbrake: false, showSteering: true,
    showTorque: true, showDriverAids: true, showGraphs: true, graphSeconds: 4,
    graphLineWidth: 1.5, showDemoInEditor: true, panelColor: "#08090b", panelOpacity: .94,
    throttleColor: "#37d67a", brakeColor: "#ff4d5e", clutchColor: "#3f8cf4",
    handbrakeColor: "#f2c94c", steeringColor: "#27c3e8", textColor: "#f7f7f8",
    mutedColor: "#8d9098", borderColor: "#2c2f35", cornerRadius: 4, fontScale: .82,
  };
  let history = [];
  let lastSampleAt = 0;
  let latestSettings = { ...defaults };
  let seededDemo = false;

  function seedDemoHistory() {
    if (seededDemo) return;
    seededDemo = true;
    history = [];
    const now = performance.now();
    for (let index = 100; index >= 0; index -= 1) {
      const x = (100 - index) / 100;
      const throttle = R.clamp(.2 + .72 * Math.max(0, Math.sin(x * Math.PI * 1.7)), 0, 1);
      const brake = R.clamp(.75 * Math.exp(-Math.pow((x - .38) * 8, 2)), 0, 1);
      const clutch = x < .08 ? .7 * (1 - x / .08) : 0;
      history.push({ t: now - index * 40, throttle, brake, clutch, handbrake: 0,
        throttleRaw: R.clamp(throttle + .04, 0, 1), brakeRaw: R.clamp(brake + .05, 0, 1), clutchRaw: clutch, handbrakeRaw: 0 });
    }
  }

  function pushSample(vehicle, editMode) {
    const now = performance.now();
    if (editMode) { seedDemoHistory(); return; }
    if (now - lastSampleAt < 28) return;
    lastSampleAt = now;
    const sample = { t: now };
    for (const key of ids) {
      sample[key] = R.clamp(R.number(vehicle[key], 0), 0, 1);
      sample[`${key}Raw`] = R.clamp(R.number(vehicle[`${key}Raw`], sample[key]), 0, 1);
    }
    history.push(sample);
    const cutoff = now - Math.max(1, R.number(latestSettings.graphSeconds, 4)) * 1000;
    while (history.length > 2 && history[0].t < cutoff) history.shift();
    if (history.length > 420) history.splice(0, history.length - 420);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return rect;
  }

  function drawGraph(settings) {
    if (!settings.showGraphs || !ctx) return;
    const rect = resizeCanvas();
    const width = rect.width, height = rect.height;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const y = Math.round((height * i) / 4) + .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    if (history.length < 2) return;
    const end = history[history.length - 1].t;
    const span = Math.max(1000, R.number(settings.graphSeconds, 4) * 1000);
    const start = end - span;
    const visible = history.filter((sample) => sample.t >= start);
    const keys = ["throttle", "brake", ...(settings.showClutch ? ["clutch"] : []), ...(settings.showHandbrake ? ["handbrake"] : [])];
    const colors = { throttle: settings.throttleColor, brake: settings.brakeColor, clutch: settings.clutchColor, handbrake: settings.handbrakeColor };
    const drawLine = (key, raw) => {
      ctx.beginPath(); let started = false;
      for (const sample of visible) {
        const value = sample[raw ? `${key}Raw` : key];
        if (!Number.isFinite(value)) continue;
        const x = R.clamp((sample.t - start) / span, 0, 1) * width;
        const y = height - R.clamp(value, 0, 1) * (height - 2) - 1;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = raw ? .36 : .96;
      ctx.strokeStyle = colors[key];
      ctx.lineWidth = raw ? Math.max(1, R.number(settings.graphLineWidth, 1.5) * .7) : R.number(settings.graphLineWidth, 1.5);
      ctx.setLineDash(raw ? [3, 3] : []); ctx.stroke();
    };
    for (const key of keys) {
      if (settings.pedalData === "both") drawLine(key, true);
      if (settings.pedalData !== "raw") drawLine(key, false);
      else drawLine(key, true);
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  new ResizeObserver(() => drawGraph(latestSettings)).observe(graphWrap);

  const demo = { vehicle: { throttle: .78, throttleRaw: .84, brake: .28, brakeRaw: .34, clutch: 0,
    handbrake: 0, steeringWheelAngleRadians: -.34, steeringWheelAngleMaxRadians: 7.85 },
    driverAids: { absAvailable: true, absActive: true, tractionControlAvailable: true,
      tractionControlEnabled: true, tractionControlLevel: 4, brakeBiasAvailable: true, brakeBiasPercent: 53.2 },
    motion: { dataAvailable: true, steeringWheelTorqueNm: 5.7 } };

  R.start({ moduleId: "com.apexhud.inputs", rootId: "inputs", defaults, demo,
    applySettings(settings) {
      latestSettings = settings;
      root.style.setProperty("--panel", R.hexToRgba(settings.panelColor, settings.panelOpacity));
      root.style.setProperty("--throttle", settings.throttleColor); root.style.setProperty("--brake", settings.brakeColor);
      root.style.setProperty("--clutch", settings.clutchColor); root.style.setProperty("--handbrake", settings.handbrakeColor);
      root.style.setProperty("--steering", settings.steeringColor); root.style.setProperty("--text", settings.textColor);
      root.style.setProperty("--muted", settings.mutedColor); root.style.setProperty("--border", settings.borderColor);
      root.style.setProperty("--radius", `${R.number(settings.cornerRadius, 4)}px`);
      root.style.setProperty("--font-scale", R.number(settings.fontScale, .82));
      root.classList.toggle("hide-clutch", !settings.showClutch); root.classList.toggle("hide-handbrake", !settings.showHandbrake);
      root.classList.toggle("has-handbrake", settings.showHandbrake); root.classList.toggle("hide-steering", !settings.showSteering);
      root.classList.toggle("hide-torque", !settings.showTorque); root.classList.toggle("hide-aids", !settings.showDriverAids);
      root.classList.toggle("hide-graph", !settings.showGraphs); root.classList.toggle("processed-only", settings.pedalData === "processed");
      root.classList.toggle("raw-only", settings.pedalData === "raw");
    },
    render(payload, context) {
      const vehicle = payload.vehicle || {}, aids = payload.driverAids || {}, motion = payload.motion || {};
      pushSample(vehicle, context.editMode || context.preview);
      for (const key of ids) {
        let processed = R.clamp(R.number(vehicle[key], 0), 0, 1);
        const raw = R.clamp(R.number(vehicle[`${key}Raw`], processed), 0, 1);
        if (context.settings.pedalData === "raw") processed = raw;
        nodes[key].fill.style.height = `${processed * 100}%`; nodes[key].raw.style.bottom = `${raw * 100}%`;
        nodes[key].value.textContent = `${Math.round((context.settings.pedalData === "raw" ? raw : processed) * 100)}%`;
      }
      const angle = R.number(vehicle.steeringWheelAngleRadians, 0);
      const max = Math.max(.1, Math.abs(R.number(vehicle.steeringWheelAngleMaxRadians, Math.PI * 2.5)));
      const ratio = R.clamp(angle / max, -1, 1), left = 50 + ratio * 50;
      steer.marker.style.left = `${left}%`; steer.fill.style.left = ratio < 0 ? `${left}%` : "50%";
      steer.fill.style.width = `${Math.abs(ratio) * 50}%`;
      steer.angle.textContent = `${angle >= 0 ? "+" : ""}${Math.round(angle * 180 / Math.PI)}°`;
      steer.torque.textContent = motion.dataAvailable && Number.isFinite(Number(motion.steeringWheelTorqueNm)) ? `${Number(motion.steeringWheelTorqueNm).toFixed(1)} Nm` : "— Nm";
      steer.bb.textContent = aids.brakeBiasAvailable && Number.isFinite(Number(aids.brakeBiasPercent)) ? `BB ${Number(aids.brakeBiasPercent).toFixed(1)}` : "BB —";
      const parts = [];
      if (aids.absAvailable) parts.push(aids.absActive ? "ABS ACTIVE" : "ABS");
      if (aids.tractionControlAvailable) parts.push(`TC${Number.isFinite(Number(aids.tractionControlLevel)) ? ` ${Math.round(Number(aids.tractionControlLevel))}` : ""}`);
      steer.aids.textContent = parts.join(" · ") || "AIDS —";
      drawGraph(context.settings);
    },
  });
})();
