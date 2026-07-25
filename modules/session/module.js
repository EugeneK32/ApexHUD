(() => {
  "use strict";
  const root = document.getElementById("session");
  const type = document.getElementById("type");
  const time = document.getElementById("time");
  const track = document.getElementById("track");
  const laps = document.getElementById("laps");
  const lapSuffix = document.getElementById("lap-suffix");
  let settings = { showTrack: true, accent: "#d64b7f", opacity: .92 };

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      root.style.setProperty("--accent", String(settings.accent || "#d64b7f"));
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
      root.classList.toggle("hide-track", !settings.showTrack);
    } else if (message.type === "apex:frame") {
      render(message.payload || {});
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function render(payload) {
    const session = payload.session || {};
    type.textContent = session.isReplayPlaying
      ? "REPLAY"
      : String(session.sessionName || session.sessionType || "SESSION").toUpperCase();
    time.textContent = session.hasTimeLimit === false ? "OPEN" : duration(session.timeRemainingSeconds);
    track.textContent = session.trackName || payload.connection?.status || "Waiting for iRacing";

    if (session.hasLapLimit) {
      laps.textContent = String(Math.max(0, Math.round(number(session.lapsRemaining, 0))));
      const total = Math.round(number(session.lapLimit ?? session.totalLaps, 0));
      lapSuffix.textContent = total > 0 ? `/ ${total}` : "";
    } else {
      laps.textContent = "∞";
      lapSuffix.textContent = "";
    }

    root.classList.remove("yellow", "blue", "white", "red", "green", "checkered");
    const flags = Math.trunc(number(session.flags, 0));
    if (flags & 0x1) root.classList.add("checkered");
    else if (flags & 0x2) root.classList.add("white");
    else if (flags & 0x4) root.classList.add("green");
    else if (flags & 0x8) root.classList.add("yellow");
    else if (flags & 0x20) root.classList.add("blue");
    else if (flags & 0x10) root.classList.add("red");
  }

  function duration(value) {
    value = number(value, 0);
    if (value <= 0 || value >= 604799) return "--:--";
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.session" }, "*");
})();
