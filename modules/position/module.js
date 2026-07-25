(() => {
  "use strict";
  const root = document.getElementById("position");
  const carNumber = document.getElementById("car-number");
  const context = document.getElementById("context");
  const primaryLabel = document.getElementById("primary-label");
  const primary = document.getElementById("primary");
  const className = document.getElementById("class-name");
  const secondaryLabel = document.getElementById("secondary-label");
  const secondary = document.getElementById("secondary");
  const lap = document.getElementById("lap");
  const driver = document.getElementById("driver");
  const status = document.getElementById("status");

  let settings = { mode: "auto", accent: "#19bfe6", opacity: .92, showDriver: true };
  const stable = {
    overall: { value: 0, pending: 0, since: 0 },
    class: { value: 0, pending: 0, since: 0 },
  };

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      root.style.setProperty("--accent", String(settings.accent || "#19bfe6"));
      root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
      root.classList.toggle("hide-driver", !settings.showDriver);
    } else if (message.type === "apex:frame") {
      render(message.payload || {});
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      root.classList.toggle("editing", Boolean(message.editMode));
    }
  });

  function render(payload) {
    const player = payload.player || {};
    const session = payload.session || {};
    const entries = Array.isArray(payload.standings?.entries) ? payload.standings.entries : [];
    const playerEntry = findPlayer(entries, player);
    const classCount = new Set(entries.map((entry) => Number(entry?.carClassId) || 0)).size;
    const isMulticlass = classCount > 1;
    const overallPosition = positiveNumber(playerEntry?.position ?? player.position);
    const classPosition = positiveNumber(playerEntry?.classPosition ?? player.classPosition);
    const displayedOverall = stabilize(stable.overall, overallPosition);
    const displayedClass = stabilize(stable.class, classPosition);
    const configuredMode = String(settings.mode || "auto");
    const showClass = configuredMode === "class" || (configuredMode === "auto" && isMulticlass);

    carNumber.textContent = `#${player.carNumber || "--"}`;
    context.textContent = session.isReplayPlaying ? "REPLAY POSITION" : showClass ? "CLASS POSITION" : "RACE POSITION";
    primaryLabel.textContent = showClass ? "IN CLASS" : "OVERALL";
    primary.textContent = positive(showClass ? displayedClass : displayedOverall);
    className.textContent = playerEntry?.carClassName || (isMulticlass ? "PLAYER CLASS" : `${entries.length || "—"} CARS`);

    if (showClass) {
      secondaryLabel.textContent = "OVERALL";
      secondary.textContent = positive(displayedOverall);
    } else {
      secondaryLabel.textContent = "FIELD";
      secondary.textContent = entries.length > 0 ? String(entries.length) : "—";
    }

    lap.textContent = positive(player.lap);
    driver.textContent = player.name || "Player";
    status.textContent = session.isReplayPlaying ? "REPLAY" : player.onPitRoad ? "PIT" : player.isOnTrack ? "LIVE" : "GARAGE";
    root.classList.toggle("pit", Boolean(player.onPitRoad));
    root.classList.toggle("multiclass", isMulticlass);
  }

  function findPlayer(entries, player) {
    const carIndex = Math.trunc(number(player.carIndex, -1));
    return entries.find((entry) => Math.trunc(number(entry?.carIndex, -2)) === carIndex)
      || entries.find((entry) => Boolean(entry?.isPlayer));
  }

  // iRacing updates the lap counter, lap percentage and scoring position on
  // slightly different ticks at the timing line. Requiring a new position to
  // survive a few frames removes distracting P2 -> P4 -> P2 flashes while a
  // genuine pass still appears in under half a second.
  function stabilize(slot, next) {
    if (next <= 0) return slot.value;
    if (slot.value <= 0) {
      slot.value = next;
      slot.pending = next;
      return next;
    }
    if (next === slot.value) {
      slot.pending = next;
      slot.since = 0;
      return slot.value;
    }
    const now = performance.now();
    if (slot.pending !== next) {
      slot.pending = next;
      slot.since = now;
      return slot.value;
    }
    if (now - slot.since >= 420) {
      slot.value = next;
      slot.since = 0;
    }
    return slot.value;
  }

  function positive(value) {
    const parsed = Math.trunc(number(value, 0));
    return parsed > 0 ? String(parsed) : "—";
  }
  function positiveNumber(value) {
    const parsed = Math.trunc(number(value, 0));
    return parsed > 0 ? parsed : 0;
  }
  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.position" }, "*");
})();
