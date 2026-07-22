function selectVisibleStandings(entries, requestedRows, playerCarIndex = -1, positionKey = "position") {
  const rows = clampRows(requestedRows);
  if (!Array.isArray(entries) || entries.length <= rows) return Array.isArray(entries) ? entries : [];
  const playerIndex = findPlayerIndex(entries, playerCarIndex);
  if (playerIndex < 0 || playerIndex < rows) return entries.slice(0, rows);

  const result = entries.slice(0, Math.max(1, rows - 2));
  const player = entries[playerIndex];
  const following = entries[playerIndex + 1];
  const preceding = entries[playerIndex - 1];
  if (!following && preceding && !containsCar(result, preceding)) result.push(preceding);
  if (player && !containsCar(result, player)) result.push(player);
  if (following && !containsCar(result, following)) result.push(following);
  return result
    .sort((a, b) => normalizedPosition(a?.[positionKey]) - normalizedPosition(b?.[positionKey]))
    .slice(0, rows);
}

function selectGroupedStandings(entries, requestedRows, playerCarIndex = -1) {
  const rows = clampRows(requestedRows);
  const groups = groupByClass(entries);
  const ordered = [...groups.values()].sort((a, b) =>
    Math.min(...a.entries.map((entry) => normalizedPosition(entry.position))) -
    Math.min(...b.entries.map((entry) => normalizedPosition(entry.position))),
  );
  const allocations = allocateRows(ordered, rows, playerCarIndex);
  return ordered.map((group, index) => ({
    ...group,
    totalCount: group.entries.length,
    allEntries: group.entries,
    entries: selectVisibleStandings(
      [...group.entries].sort((a, b) => normalizedPosition(a.classPosition) - normalizedPosition(b.classPosition)),
      allocations[index],
      playerCarIndex,
      "classPosition",
    ),
  })).filter((group) => group.entries.length > 0);
}

function identifyPlayerEntries(entries, player = {}) {
  if (!Array.isArray(entries)) return [];
  const playerCarIndex = normalizedCarIndex(player?.carIndex);
  let matchedIndex = playerCarIndex >= 0
    ? entries.findIndex((entry) => normalizedCarIndex(entry?.carIndex) === playerCarIndex)
    : -1;
  if (matchedIndex < 0) {
    const carNumber = String(player?.carNumber || "").trim();
    const matches = entries.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => carNumber && String(entry?.carNumber || "").trim() === carNumber);
    if (matches.length === 1) matchedIndex = matches[0].index;
  }
  if (matchedIndex < 0) {
    const name = String(player?.name || "").trim().toLocaleLowerCase();
    const matches = entries.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => name && String(entry?.driverName || "").trim().toLocaleLowerCase() === name);
    if (matches.length === 1) matchedIndex = matches[0].index;
  }
  return entries.map((entry, index) => ({
    ...entry,
    isPlayer: matchedIndex >= 0 ? index === matchedIndex : Boolean(entry?.isPlayer),
  }));
}

function groupByClass(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const carClassId = number(entry?.carClassId, 0);
    if (!groups.has(carClassId)) {
      groups.set(carClassId, {
        carClassId,
        carClassName: String(entry?.carClassName || "Class"),
        entries: [],
      });
    }
    groups.get(carClassId).entries.push(entry);
  }
  return groups;
}

function allocateRows(groups, rows, playerCarIndex) {
  if (groups.length <= 1) return [rows];
  const minimum = rows >= groups.length * 3 ? 3 : Math.max(1, Math.floor(rows / groups.length));
  const allocations = groups.map(() => minimum);
  let remaining = Math.max(0, rows - minimum * groups.length);
  const playerGroup = groups.findIndex((group) => group.entries.some((entry) => isPlayerStanding(entry, playerCarIndex)));
  const order = [];
  if (playerGroup >= 0) order.push(playerGroup);
  groups.forEach((_, index) => { if (index !== playerGroup) order.push(index); });
  let cursor = 0;
  while (remaining > 0 && order.length > 0) {
    const index = order[cursor % order.length];
    if (allocations[index] < groups[index].entries.length) {
      allocations[index] += 1;
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > rows * groups.length * 2) break;
  }
  return allocations;
}

function findPlayerIndex(entries, playerCarIndex) {
  const normalized = normalizedCarIndex(playerCarIndex);
  let index = normalized >= 0
    ? entries.findIndex((entry) => normalizedCarIndex(entry?.carIndex) === normalized)
    : -1;
  if (index < 0) index = entries.findIndex((entry) => Boolean(entry?.isPlayer));
  return index;
}

function isPlayerStanding(entry, playerCarIndex) {
  const normalized = normalizedCarIndex(playerCarIndex);
  return Boolean(entry?.isPlayer) || (normalized >= 0 && normalizedCarIndex(entry?.carIndex) === normalized);
}
function containsCar(entries, candidate) { return entries.some((entry) => entry?.carIndex === candidate?.carIndex); }
function normalizedPosition(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER; }
function normalizedCarIndex(value) { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : -1; }
function clampRows(value) { return Math.max(5, Math.min(30, Math.round(Number(value) || 16))); }

(() => {
  "use strict";

  const root = document.getElementById("standings");
  const rowsHost = document.getElementById("rows");
  const sessionMark = document.getElementById("session-mark");
  const trackName = document.getElementById("track-name");
  const sourceBadge = document.getElementById("source-badge");
  const timeRemaining = document.getElementById("time-remaining");
  const lapsRemaining = document.getElementById("laps-remaining");
  const fieldSummary = document.getElementById("field-summary");
  const modeLabel = document.getElementById("mode-label");
  const sofLabel = document.getElementById("sof-label");

  let latestPayload;
  let renderTimer;
  let lastRenderAt = 0;
  let settings = {
    rows: 16,
    mode: "auto",
    showIRating: true,
    showLicense: true,
    showLastLap: true,
    compact: false,
    accent: "#f2c94c",
    opacity: 0.92,
  };

  addEventListener("message", (event) => {
    if (event.source !== parent || !event.data) return;
    const message = event.data;
    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = { ...settings, ...(message.settings || {}) };
      applySettings();
      if (latestPayload) scheduleRender(true);
    } else if (message.type === "apex:frame") {
      latestPayload = message.payload || {};
      scheduleRender(false);
    } else if (message.type === "apex:visibility") {
      document.documentElement.classList.toggle("module-hidden", !message.visible);
    }
  });

  function scheduleRender(immediate) {
    if (!latestPayload) return;
    if (renderTimer !== undefined) {
      if (!immediate) return;
      clearTimeout(renderTimer);
    }
    const delay = immediate ? 0 : Math.max(0, 100 - (performance.now() - lastRenderAt));
    renderTimer = setTimeout(() => {
      renderTimer = undefined;
      lastRenderAt = performance.now();
      render(latestPayload);
    }, delay);
  }

  function applySettings() {
    root.style.setProperty("--accent", String(settings.accent || "#f2c94c"));
    root.style.setProperty("--panel-opacity", String(number(settings.opacity, 0.92)));
    root.classList.toggle("hide-license", !settings.showLicense);
    root.classList.toggle("hide-irating", !settings.showIRating);
    root.classList.toggle("hide-last-lap", !settings.showLastLap);
    root.classList.toggle("compact", Boolean(settings.compact));
  }

  function render(payload) {
    const session = payload.session || {};
    const player = payload.player || {};
    const source = payload.source || "none";
    const rawEntries = Array.isArray(payload.standings?.entries) ? payload.standings.entries : [];
    const entries = identifyPlayerEntries(rawEntries, player);
    const classIds = new Set(entries.map((entry) => number(entry.carClassId, 0)));
    const classCount = classIds.size;
    const configuredMode = String(settings.mode || "auto");
    const mode = configuredMode === "auto" ? (classCount > 1 ? "grouped" : "overall") : configuredMode;

    root.classList.toggle("grouped", mode === "grouped");
    sessionMark.textContent = sessionMarkFor(session.sessionType);
    trackName.textContent = session.trackName || "Waiting for session";
    timeRemaining.textContent = session.hasTimeLimit ? formatDuration(session.timeRemainingSeconds) : "OPEN";
    lapsRemaining.textContent = session.hasLapLimit
      ? `${Math.max(0, Math.round(number(session.lapsRemaining, 0)))} LAPS`
      : session.hasTimeLimit ? formatSessionLength(session) : "∞ LAPS";
    fieldSummary.textContent = String(entries.length);
    sourceBadge.textContent = source === "iracing" ? "LIVE" : "DEMO";
    sourceBadge.classList.toggle("live", source === "iracing");

    if (entries.length === 0) {
      root.classList.remove("grouped");
      modeLabel.textContent = "OVERALL";
      sofLabel.textContent = "SoF —";
      const empty = document.createElement("div");
      empty.className = "standings-empty";
      empty.innerHTML = source === "iracing"
        ? "<b>WAITING FOR SESSION ROSTER</b><span>Driver data will appear when iRacing publishes SessionInfo.</span>"
        : "<b>NO FIELD DATA</b><span>Start the simulator or enable demo data.</span>";
      rowsHost.replaceChildren(empty);
      return;
    }

    const playerEntry = entries.find((entry) => entry.isPlayer);
    if (mode === "grouped") {
      const groups = selectGroupedStandings(entries, settings.rows, player.carIndex);
      rowsHost.replaceChildren(...renderGroups(groups, player));
      return;
    }

    const filtered = mode === "class" && playerEntry
      ? entries.filter((entry) => number(entry.carClassId, 0) === number(playerEntry.carClassId, 0))
      : entries;
    const positionKey = mode === "class" ? "classPosition" : "position";
    const sorted = [...filtered].sort((a, b) => normalizedPosition(a[positionKey]) - normalizedPosition(b[positionKey]));
    const visible = selectVisibleStandings(sorted, settings.rows, player.carIndex, positionKey);

    const singleClassName = classCount === 1 ? String(entries[0]?.carClassName || "CLASS") : "OVERALL";
    modeLabel.textContent = mode === "class"
      ? String(playerEntry?.carClassName || "PLAYER CLASS").toUpperCase()
      : singleClassName.toUpperCase();
    sofLabel.textContent = `SoF ${formatSof(filtered)}`;
    rowsHost.replaceChildren(...renderRows(visible, positionKey, player));
  }

  function renderGroups(groups, player) {
    const nodes = [];
    for (const group of groups) {
      const header = document.createElement("div");
      header.className = "class-header";
      header.style.setProperty("--class-color", classColor(group.carClassId));
      header.innerHTML = `
        <div class="class-title"><b>${escape(group.carClassName)}</b><span class="class-sof">SoF ${formatSof(group.allEntries || group.entries)}</span></div>
        <div class="class-meta"><span class="class-count">${group.totalCount || group.entries.length}</span></div>`;
      nodes.push(header, ...renderRows(group.entries, "classPosition", player));
    }
    return nodes;
  }

  function renderRows(items, positionKey, player) {
    const nodes = [];
    let previous = 0;
    for (const entry of items) {
      const position = number(entry[positionKey], 0);
      if (previous && position - previous > 1) {
        const separator = document.createElement("div");
        separator.className = "separator";
        separator.textContent = "•••";
        nodes.push(separator);
      }
      nodes.push(createRow(entry, positionKey, player));
      previous = position;
    }
    return nodes;
  }

  function createRow(entry, positionKey, player) {
    const row = document.createElement("div");
    const position = number(entry[positionKey], 0);
    const bestLap = number(entry.bestLapSeconds, 0);
    const lastLap = number(entry.lastLapSeconds, 0);
    const gap = number(entry.gapToLeaderSeconds, 0);
    row.className = `row${entry.isPlayer ? " player" : ""}`;
    row.style.setProperty("--class-color", classColor(number(entry.carClassId, 0)));

    const status = entry.status === "pit" || entry.onPitRoad
      ? '<span class="pit-badge">PIT</span>'
      : entry.status === "out" ? '<span class="out-badge">OUT</span>' : "";

    const license = shortLicense(entry.license);
    const licenseLetter = license === "—" ? "" : license.charAt(0);
    row.innerHTML = `
      <span class="position">${position > 0 ? position : "—"}</span>
      <span class="car-number">${escape(entry.carNumber || "--")}</span>
      <span class="driver"><span class="driver-name">${escape(entry.driverName || "Unknown")}</span>${status}</span>
      <span class="rating-cell"><span class="license ${licenseGrade(entry.license)}">${escape(licenseLetter)}</span><span class="irating">${formatIRating(entry.iRating)}</span></span>
      <span class="gap ${position === 1 ? "leader" : ""}">${position === 1 ? "—" : entry.isPlayer && gap <= 0 ? "YOU" : gap > 0 ? gap.toFixed(gap >= 100 ? 0 : 1) : "—"}</span>
      <span class="last-lap ${bestLap > 0 && lastLap <= bestLap + 0.02 ? "personal-best" : ""}">${formatLap(lastLap)}</span>`;

    if (entry.isPlayer) row.title = `${player.name || "Player"} · lap ${entry.lap || 0}`;
    return row;
  }

  function classColor(classId) {
    const palette = ["#d33f73", "#d0a50c", "#169fc4", "#4b7fd2", "#4d9c5b", "#d96f2d"];
    return palette[Math.abs(classId) % palette.length];
  }

  function sessionMarkFor(value) {
    const sessionType = String(value || "RACE").trim().toUpperCase();
    if (sessionType.startsWith("Q")) return "Q";
    if (sessionType.startsWith("P")) return "P";
    if (sessionType.startsWith("W")) return "W";
    return "R";
  }

  function formatSof(entries) {
    const values = entries
      .map((entry) => number(entry?.iRating, 0))
      .filter((value) => value > 0);
    if (values.length === 0) return "—";
    return String(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
  }

  function formatSessionLength(session) {
    const total = number(session.sessionDurationSeconds, 0);
    if (total <= 0) return "TIMED";
    const minutes = Math.round(total / 60);
    return `${minutes}m`;
  }

  function licenseGrade(value) { return String(value || "r").trim().charAt(0).toLowerCase(); }
  function shortLicense(value) {
    const text = String(value || "—").trim();
    const match = text.match(/^([A-Za-z])/);
    return match ? match[1].toUpperCase() : "—";
  }
  function formatIRating(value) {
    const rating = number(value, 0);
    return rating <= 0 ? "—" : rating >= 1000 ? `${(rating / 1000).toFixed(1)}k` : String(rating);
  }
  function formatDuration(value) {
    const seconds = number(value, 0);
    if (seconds <= 0) return "--:--";
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${minutes}:${String(secs).padStart(2, "0")}`;
  }
  function formatLap(value) {
    const seconds = number(value, 0);
    if (seconds <= 0) return "—";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
  }
  function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function escape(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  applySettings();
  parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.standings" }, "*");
})();
