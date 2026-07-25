(() => {
  "use strict";

  const PROTOCOL_VERSION = 6;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function positive(value, fallback = 0) {
    const parsed = number(value, fallback);
    return parsed > 0 ? parsed : fallback;
  }

  function formatLap(seconds, decimals = 3) {
    const value = number(seconds, 0);
    if (value <= 0) return "—";
    const minutes = Math.floor(value / 60);
    const remainder = value - minutes * 60;
    return `${minutes}:${remainder.toFixed(decimals).padStart(3 + decimals, "0")}`;
  }

  function formatDuration(seconds, showHours = true) {
    const value = number(seconds, 0);
    if (value < 0 || value >= 604799) return "—";
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (showHours && hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes + hours * 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || "#000000").replace("#", "").trim();
    const normalized = value.length === 3
      ? value.split("").map((part) => part + part).join("")
      : value.slice(0, 6).padEnd(6, "0");
    const parsed = Number.parseInt(normalized, 16);
    const red = (parsed >> 16) & 255;
    const green = (parsed >> 8) & 255;
    const blue = parsed & 255;
    return `rgba(${red}, ${green}, ${blue}, ${clamp(number(alpha, 1), 0, 1)})`;
  }

  function start(config) {
    const root = document.getElementById(config.rootId);
    const preview = new URLSearchParams(location.search).has("preview");
    if (preview) document.documentElement.classList.add("preview");

    let settings = { ...(config.defaults || {}) };
    let payload = {};
    let source = "none";
    let visible = true;
    let editMode = preview;
    let hasFrame = false;
    let protocolOk = true;
    let receivedProtocol = PROTOCOL_VERSION;
    let lastSequence = -1;

    function draw() {
      document.documentElement.classList.toggle("module-hidden", !visible);
      root?.classList.toggle("is-editing", editMode);
      root?.classList.toggle("is-preview", preview);
      root?.classList.toggle("is-unavailable", !hasFrame && !editMode && !preview);
      root?.classList.toggle("is-protocol-error", !protocolOk);

      if (typeof config.applySettings === "function") {
        config.applySettings(settings, root);
      }

      const demoEnabled = settings.showDemoInEditor !== false;
      const useDemo = preview || (editMode && demoEnabled);
      const data = useDemo ? (config.demo || {}) : payload;

      if (!protocolOk && root) {
        const errorNode = root.querySelector("[data-protocol-error]");
        if (errorNode) errorNode.textContent = `Protocol v${PROTOCOL_VERSION} required · received v${receivedProtocol}`;
      }

      if (typeof config.render === "function") {
        config.render(data || {}, {
          settings,
          editMode,
          preview,
          source: useDemo ? "mock" : source,
          hasFrame: hasFrame || useDemo,
          protocolOk,
          root,
        });
      }
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || typeof message.type !== "string") return;

      if (message.type === "apex:init") {
        receivedProtocol = number(message.protocolVersion, 0);
        protocolOk = receivedProtocol === PROTOCOL_VERSION;
        source = String(message.source || "none");
        settings = { ...settings, ...(message.settings || {}) };
        draw();
        return;
      }

      if (message.type === "apex:settings") {
        settings = { ...settings, ...(message.settings || {}) };
        draw();
        return;
      }

      if (message.type === "apex:visibility") {
        visible = Boolean(message.visible);
        editMode = Boolean(message.editMode);
        draw();
        return;
      }

      if (message.type === "apex:frame") {
        receivedProtocol = number(message.protocolVersion, 0);
        protocolOk = receivedProtocol === PROTOCOL_VERSION;
        if (!protocolOk) {
          draw();
          return;
        }
        const sequence = number(message.sequence, -1);
        if (sequence === lastSequence) return;
        lastSequence = sequence;
        payload = message.payload || {};
        source = String(payload.source || source || "none");
        hasFrame = true;
        draw();
      }
    });

    draw();
    window.parent.postMessage({ type: "apex:ready", moduleId: config.moduleId }, "*");
    return { redraw: draw };
  }

  window.ApexRuntime = {
    PROTOCOL_VERSION,
    start,
    number,
    positive,
    clamp,
    formatLap,
    formatDuration,
    hexToRgba,
  };
})();
