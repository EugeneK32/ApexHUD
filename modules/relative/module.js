(() => {
  "use strict";
  const root = document.getElementById("relative");
  const rows = document.getElementById("rows");
  const track = document.getElementById("track");
  let settings = { rows: 8, showNames: true, hideWhenEmpty: true, accent: "#d64b7f", opacity: .92 };
  let payload = {};
  let editMode = false;

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      apply();
      render();
    } else if (message.type === "apex:frame") {
      payload = message.payload || {};
      render();
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
      editMode = Boolean(message.editMode);
      root.classList.toggle("editing", editMode);
      render();
    }
  });

  function apply() {
    root.style.setProperty("--accent", String(settings.accent || "#d64b7f"));
    root.style.setProperty("--opacity", String(number(settings.opacity, .92)));
    root.classList.toggle("hide-names", !settings.showNames);
  }

  function render() {
    track.textContent = payload.session?.trackName || "WAITING";
    const entries = Array.isArray(payload.relative?.entries) ? payload.relative.entries : [];
    const count = Math.max(4, Math.min(12, Math.round(number(settings.rows, 8))));
    const sideSlots = Math.max(1, Math.floor((count - 1) / 2));
    const ahead = entries.filter((entry) => entry.relation === "ahead").sort(byDistance).slice(0, sideSlots).reverse();
    const behind = entries.filter((entry) => entry.relation === "behind").sort(byDistance).slice(0, count - ahead.length - 1);

    if (!entries.length) {
      root.hidden = Boolean(settings.hideWhenEmpty) && !editMode;
      rows.innerHTML = '<div class="empty">NO NEARBY CARS</div>';
      return;
    }

    root.hidden = false;
    const player = payload.player || {};
    const selected = [...ahead, { relation: "player", ...player }, ...behind];
    rows.replaceChildren(...selected.map(createRow));
  }

  function createRow(entry) {
    if (entry.relation === "player") return createPlayerRow(entry);
    const element = document.createElement("div");
    element.className = `row ${entry.relation}${entry.onPitRoad ? " pit" : ""}`;
    element.style.setProperty("--class-color", classColor(entry.carClassName));
    const gap = Math.abs(number(entry.estimatedGapSeconds, 0));
    const sign = entry.relation === "ahead" ? "−" : "+";
    element.innerHTML = `
      <span class="position">${positive(entry.position)}</span>
      <span class="number">${escapeHtml(entry.carNumber || "--")}</span>
      <span class="name">${escapeHtml(entry.driverName || `Car ${entry.carIndex}`)}<small>${escapeHtml(entry.carClassName || "")}${entry.onPitRoad ? " · PIT" : ""}</small></span>
      <span class="gap">${sign}${gap.toFixed(1)}</span>`;
    return element;
  }

  function createPlayerRow(player) {
    const element = document.createElement("div");
    element.className = `row player${player.onPitRoad ? " pit" : ""}`;
    element.style.setProperty("--class-color", classColor(player.carClassName));
    element.innerHTML = `
      <span class="position">${positive(player.position)}</span>
      <span class="number">${escapeHtml(player.carNumber || "YOU")}</span>
      <span class="name">${escapeHtml(player.name || "YOU")}<small>${escapeHtml(player.carClassName || "YOUR CAR")}${player.onPitRoad ? " · PIT" : ""}</small></span>
      <span class="gap">0.0</span>`;
    return element;
  }

  function byDistance(left, right) { return Math.abs(number(left.distanceMeters, 0)) - Math.abs(number(right.distanceMeters, 0)); }
  function positive(value) { const parsed = Math.trunc(number(value, 0)); return parsed > 0 ? parsed : "—"; }
  function classColor(value) {
    const palette = ["#d43f73", "#caa20a", "#179fc4", "#477fd1", "#4f9b58", "#d96f2d"];
    let hash = 0;
    for (const char of String(value || "Class")) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }
  function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
  function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

  apply();
  render();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.relative" }, "*");
})();
