(() => {
  "use strict";
const {
  identifyPlayerEntries,
  normalizedPosition,
  selectGroupedStandings,
  selectVisibleStandings,
} = window.StandingsWindowing;
const { createDemoPayload } = window.StandingsDemo;

const SUPPORTED_PROTOCOL = 6;
const RENDER_INTERVAL_MS = 110;

const DEFAULTS = {
  rows: 12,
  mode: "auto",
  focusMode: "hybrid",
  gapMode: "interval",
  timingColumn: "last",
  headerStyle: "compact",
  density: "compact",
  classHeaderStyle: "solid",
  playerHighlight: "row",
  nameFormat: "full",
  showCarNumber: true,
  showPositionChange: true,
  showLicense: true,
  showIRating: true,
  showStatus: true,
  showTrack: true,
  showFieldCount: true,
  showSource: false,
  fontScale: 0.82,
  cornerRadius: 4,
  shadowStrength: 0.5,
  backgroundColor: "#050506",
  backgroundOpacity: 0.92,
  headerBackgroundColor: "#020203",
  rowColor: "#151517",
  alternateRowColor: "#29292c",
  playerRowColor: "#3a3a3e",
  separatorColor: "#000000",
  textColor: "#f7f7f8",
  mutedTextColor: "#a4a4ab",
  accent: "#f2c94c",
  positiveColor: "#3ed16f",
  negativeColor: "#ff4b55",
  fastestColor: "#d95cff",
  classPalette: "custom",
  classColor1: "#e6467d",
  classColor2: "#e5b80b",
  classColor3: "#18add1",
  classColor4: "#6b82ef",
  classColor5: "#56b96c",
  classColor6: "#e27a35",
};

const root = document.getElementById("standings");
const rowsHost = document.getElementById("rows");
const sessionMark = document.getElementById("session-mark");
const trackName = document.getElementById("track-name");
const sourceBadge = document.getElementById("source-badge");
const timeRemaining = document.getElementById("time-remaining");
const sessionLimit = document.getElementById("session-limit");
const fieldSummary = document.getElementById("field-summary");
const modeLabel = document.getElementById("mode-label");
const sofLabel = document.getElementById("sof-label");
const gapHeading = document.getElementById("gap-heading");
const timingHeading = document.getElementById("timing-heading");
const classStrip = document.getElementById("class-strip");

let settings = { ...DEFAULTS };
let latestPayload = null;
let visible = true;
let editMode = new URLSearchParams(location.search).has("preview");
let renderTimer;
let lastRenderAt = 0;
let lastSequence = -1;
let lastSessionKey = "";
let initialPositions = new Map();
const demoPayload = createDemoPayload();

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || typeof message.type !== "string") return;

  if (
    (message.type === "apex:init" || message.type === "apex:frame")
    && message.protocolVersion !== SUPPORTED_PROTOCOL
  ) {
    renderProtocolError(message.protocolVersion);
    return;
  }

  switch (message.type) {
    case "apex:init":
    case "apex:settings":
      mergeSettings(message.settings || {});
      applySettings();
      scheduleRender(true);
      break;

    case "apex:visibility":
      visible = Boolean(message.visible);
      editMode = Boolean(message.editMode);
      document.documentElement.classList.toggle("module-hidden", !visible);
      document.documentElement.classList.toggle("module-editing", editMode);
      if (!visible) cancelRender();
      else scheduleRender(true);
      break;

    case "apex:frame":
      if (message.sequence === lastSequence) return;
      lastSequence = message.sequence;
      latestPayload = message.payload || {};
      if (visible && !editMode) scheduleRender(false);
      break;
  }
});

function mergeSettings(incoming) {
  const migrated = { ...incoming };

  if (!("backgroundOpacity" in incoming) && "opacity" in incoming) {
    migrated.backgroundOpacity = incoming.opacity;
  }
  if (!("density" in incoming) && incoming.compact === true) {
    migrated.density = "compact";
  }
  if (!("timingColumn" in incoming) && "showLastLap" in incoming) {
    migrated.timingColumn = incoming.showLastLap ? "last" : "off";
  }

  settings = { ...DEFAULTS, ...settings, ...migrated };
}

function applySettings() {
  const opacity = clamp(number(settings.backgroundOpacity, 0.92), 0.25, 1);
  const fontScale = clamp(number(settings.fontScale, 1), 0.8, 1.25);
  const radius = clamp(number(settings.cornerRadius, 2), 0, 10);
  const shadow = clamp(number(settings.shadowStrength, 0.5), 0, 1);

  setRgbaVariable("--panel-bg", settings.backgroundColor, opacity);
  setRgbaVariable("--header-bg", settings.headerBackgroundColor, opacity);
  setRgbaVariable("--row-bg", settings.rowColor, opacity);
  setRgbaVariable("--row-alt-bg", settings.alternateRowColor, opacity);
  setRgbaVariable("--player-row-bg", settings.playerRowColor, Math.min(1, opacity + 0.04));
  setRgbaVariable("--divider", settings.separatorColor, 0.76);

  root.style.setProperty("--text-primary", safeColor(settings.textColor, DEFAULTS.textColor));
  root.style.setProperty("--text-muted", safeColor(settings.mutedTextColor, DEFAULTS.mutedTextColor));
  root.style.setProperty("--accent", safeColor(settings.accent, DEFAULTS.accent));
  root.style.setProperty("--positive", safeColor(settings.positiveColor, DEFAULTS.positiveColor));
  root.style.setProperty("--negative", safeColor(settings.negativeColor, DEFAULTS.negativeColor));
  root.style.setProperty("--fastest", safeColor(settings.fastestColor, DEFAULTS.fastestColor));
  root.style.setProperty("--font-scale", String(fontScale));
  root.style.setProperty("--corner-radius", `${radius}px`);
  root.style.setProperty("--shadow-alpha", String(shadow * 0.72));

  setExclusiveClass("header-", normalizeChoice(settings.headerStyle, ["full", "compact", "hidden"], "full"));
  setExclusiveClass("density-", normalizeChoice(settings.density, ["compact", "regular", "comfortable"], "regular"));
  setExclusiveClass("class-style-", normalizeChoice(settings.classHeaderStyle, ["solid", "stripe", "minimal"], "solid"));
  setExclusiveClass("player-highlight-", normalizeChoice(settings.playerHighlight, ["row", "accent", "name"], "row"));

  root.classList.toggle("hide-car-number", !Boolean(settings.showCarNumber));
  root.classList.toggle("hide-position-change", !Boolean(settings.showPositionChange));
  root.classList.toggle("hide-license", !Boolean(settings.showLicense));
  root.classList.toggle("hide-irating", !Boolean(settings.showIRating));
  root.classList.toggle("hide-gap", String(settings.gapMode) === "off");
  root.classList.toggle("hide-timing", String(settings.timingColumn) === "off");
  root.classList.toggle("hide-track", !Boolean(settings.showTrack));
  root.classList.toggle("hide-field-count", !Boolean(settings.showFieldCount));
  root.classList.toggle("hide-source", !Boolean(settings.showSource));

  const columns = ["36px"];
  if (settings.showPositionChange) columns.push("34px");
  if (settings.showCarNumber) columns.push("50px");
  columns.push("minmax(120px, 1fr)");
  if (settings.showLicense) columns.push("24px");
  if (settings.showIRating) columns.push("58px");
  if (String(settings.gapMode) !== "off") columns.push("66px");
  if (String(settings.timingColumn) !== "off") columns.push("82px");
  root.style.setProperty("--row-grid", columns.join(" "));

  gapHeading.textContent = String(settings.gapMode) === "leader" ? "LEAD" : "INT";
  timingHeading.textContent = String(settings.timingColumn) === "best" ? "BEST" : "LAST";
}

function setExclusiveClass(prefix, value) {
  for (const className of [...root.classList]) {
    if (className.startsWith(prefix)) root.classList.remove(className);
  }
  root.classList.add(`${prefix}${value}`);
}

function scheduleRender(immediate) {
  if (!visible) return;
  if (renderTimer !== undefined) {
    if (!immediate) return;
    clearTimeout(renderTimer);
  }

  const delay = immediate ? 0 : Math.max(0, RENDER_INTERVAL_MS - (performance.now() - lastRenderAt));
  renderTimer = window.setTimeout(() => {
    renderTimer = undefined;
    lastRenderAt = performance.now();
    render(effectivePayload());
  }, delay);
}

function cancelRender() {
  if (renderTimer === undefined) return;
  clearTimeout(renderTimer);
  renderTimer = undefined;
}

function effectivePayload() {
  if (editMode) return demoPayload;
  return latestPayload || { source: "none", session: {}, player: {}, standings: { entries: [] } };
}

function render(payload) {
  const session = payload?.session || {};
  const player = payload?.player || {};
  const source = String(payload?.source || "none");
  const rawEntries = Array.isArray(payload?.standings?.entries) ? payload.standings.entries : [];
  const entries = identifyPlayerEntries(rawEntries, player);

  updateSessionBaseline(session, source);
  updateInitialPositions(entries);
  renderHeader(session, source, entries.length);

  if (entries.length === 0) {
    renderEmptyState(source);
    return;
  }

  const classIds = uniqueClassIds(entries);
  const classColors = createClassColorMap(classIds);
  const playerEntry = entries.find((entry) => entry.isPlayer);
  const configuredMode = normalizeChoice(settings.mode, ["auto", "overall", "class", "grouped"], "auto");
  let mode = configuredMode === "auto"
    ? (classIds.length > 1 ? "grouped" : "overall")
    : configuredMode;
  if (mode === "class" && !playerEntry) mode = "overall";
  const focusMode = normalizeChoice(settings.focusMode, ["hybrid", "player", "leaders"], "hybrid");

  root.classList.toggle("grouped", mode === "grouped");
  if (mode === "grouped") {
    const groups = selectGroupedStandings(entries, settings.rows, player.carIndex, focusMode);
    rowsHost.replaceChildren(...renderGroups(groups, player, classColors));
    return;
  }

  const filtered = mode === "class" && playerEntry
    ? entries.filter((entry) => Number(entry.carClassId) === Number(playerEntry.carClassId))
    : entries;
  const positionKey = mode === "class" ? "classPosition" : "position";
  const sorted = [...filtered].sort(
    (left, right) => normalizedPosition(left[positionKey]) - normalizedPosition(right[positionKey]),
  );
  const visibleEntries = selectVisibleStandings(
    sorted,
    settings.rows,
    player.carIndex,
    positionKey,
    focusMode,
  );

  const singleClassName = classIds.length === 1 ? String(entries[0]?.carClassName || "CLASS") : "OVERALL";
  const title = mode === "class"
    ? String(playerEntry?.carClassName || "PLAYER CLASS")
    : singleClassName;
  const stripClassId = mode === "class" && playerEntry ? Number(playerEntry.carClassId) : classIds[0];

  const stripColor = classColors.get(stripClassId) || safeColor(settings.accent, DEFAULTS.accent);
  classStrip.style.setProperty("--class-color", stripColor);
  classStrip.style.setProperty("--class-text", contrastText(stripColor));
  modeLabel.textContent = title.toUpperCase();
  sofLabel.textContent = `SoF ${formatSof(filtered)}`;
  fieldSummary.textContent = String(filtered.length);
  rowsHost.replaceChildren(...renderRows(visibleEntries, sorted, positionKey, player, classColors, timingBenchmark(sorted)));
}

function renderHeader(session, source, fieldSize) {
  sessionMark.textContent = sessionMarkFor(session.sessionType);
  timeRemaining.textContent = session.hasTimeLimit
    ? formatDuration(session.timeRemainingSeconds)
    : "OPEN";
  sessionLimit.textContent = session.hasLapLimit
    ? `${Math.max(0, Math.round(number(session.lapsRemaining, 0)))} LAPS`
    : session.hasTimeLimit ? "TIMED" : "UNLIMITED";
  trackName.textContent = String(session.trackName || "Waiting for session");
  fieldSummary.textContent = String(fieldSize);

  const live = source === "iracing";
  sourceBadge.textContent = live ? "LIVE" : editMode || source === "mock" ? "DEMO" : source === "none" ? "OFF" : source.toUpperCase().slice(0, 7);
  sourceBadge.classList.toggle("live", live);
}

function renderEmptyState(source) {
  root.classList.remove("grouped");
  modeLabel.textContent = "OVERALL";
  sofLabel.textContent = "SoF —";
  fieldSummary.textContent = "0";
  classStrip.style.setProperty("--class-color", safeColor(settings.accent, DEFAULTS.accent));

  const empty = element("div", "standings-empty");
  const icon = element("span", "empty-icon", "▥");
  const title = element(
    "b",
    "",
    source === "iracing" ? "WAITING FOR SESSION ROSTER" : "NO TELEMETRY DATA",
  );
  const detail = element(
    "span",
    "",
    source === "iracing"
      ? "Driver data will appear as soon as iRacing publishes SessionInfo."
      : "Open the visual editor to see representative test data, or start iRacing.",
  );
  empty.append(icon, title, detail);
  rowsHost.replaceChildren(empty);
}

function renderGroups(groups, player, classColors) {
  const nodes = [];
  for (const group of groups) {
    const classColor = classColors.get(Number(group.carClassId)) || safeColor(settings.accent, DEFAULTS.accent);
    const header = element("div", "class-header");
    header.style.setProperty("--class-color", classColor);
    header.style.setProperty("--class-text", contrastText(classColor));

    const title = element("div", "class-title");
    title.append(
      element("b", "", String(group.carClassName || "Class").toUpperCase()),
      element("span", "class-sof", `SoF ${formatSof(group.allEntries)}`),
    );
    const meta = element("div", "class-meta");
    meta.append(element("span", "class-count", String(group.totalCount)));
    header.append(title, meta);

    nodes.push(
      header,
      ...renderRows(group.entries, group.allEntries, "classPosition", player, classColors, timingBenchmark(group.allEntries)),
    );
  }
  return nodes;
}

function renderRows(items, fullOrder, positionKey, player, classColors, fastestLap) {
  const nodes = [];
  let previousVisiblePosition = 0;
  const byPosition = new Map(
    fullOrder.map((entry) => [Number(entry[positionKey]), entry]),
  );

  for (const entry of items) {
    const position = number(entry[positionKey], 0);
    if (previousVisiblePosition > 0 && position - previousVisiblePosition > 1) {
      const separator = element("div", "row-separator");
      separator.append(element("span", "", "•••"));
      nodes.push(separator);
    }

    const precedingEntry = byPosition.get(position - 1);
    nodes.push(createRow(entry, positionKey, player, classColors, fastestLap, precedingEntry));
    previousVisiblePosition = position;
  }
  return nodes;
}

function createRow(entry, positionKey, player, classColors, fastestLap, precedingEntry) {
  const row = element("div", "row");
  const position = number(entry[positionKey], 0);
  const carClassId = Number(entry.carClassId) || 0;
  const classColor = classColors.get(carClassId) || safeColor(settings.accent, DEFAULTS.accent);
  const isOut = String(entry.status) === "out";
  const isPit = String(entry.status) === "pit" || Boolean(entry.onPitRoad);

  row.classList.toggle("player", Boolean(entry.isPlayer));
  row.classList.toggle("out", isOut);
  row.classList.toggle("pit", isPit);
  row.style.setProperty("--class-color", classColor);

  const positionCell = element("span", "position", position > 0 ? String(position) : "—");
  row.append(positionCell);

  if (settings.showPositionChange) {
    row.append(createPositionChange(entry, positionKey));
  }

  if (settings.showCarNumber) {
    const carNumber = element("span", "car-number", String(entry.carNumber || "--"));
    carNumber.title = String(entry.carClassName || "Class");
    row.append(carNumber);
  }

  const driver = element("span", "driver");
  const driverName = element("span", "driver-name", formatDriverName(entry.driverName));
  driverName.title = String(entry.driverName || "Unknown driver");
  driver.append(driverName);
  if (settings.showStatus) {
    if (isPit) driver.append(element("span", "status-badge pit-badge", "PIT"));
    else if (isOut) driver.append(element("span", "status-badge out-badge", "OUT"));
  }
  row.append(driver);

  if (settings.showLicense) {
    const license = shortLicense(entry.license);
    const licenseCell = element("span", `license ${licenseGrade(entry.license)}`, license === "—" ? "" : license);
    licenseCell.title = String(entry.license || "Licence unavailable");
    row.append(licenseCell);
  }

  if (settings.showIRating) {
    const ratingCell = element("span", "irating", formatIRating(entry.iRating));
    ratingCell.title = `iRating ${Math.max(0, Math.round(number(entry.iRating, 0)))}`;
    row.append(ratingCell);
  }

  if (String(settings.gapMode) !== "off") {
    const gap = resolveGap(entry, positionKey, precedingEntry);
    const gapCell = element("span", `gap${position === 1 ? " leader" : ""}`, formatGap(gap, position === 1));
    row.append(gapCell);
  }

  if (String(settings.timingColumn) !== "off") {
    row.append(createTimingCell(entry, fastestLap));
  }

  if (entry.isPlayer) {
    row.title = `${player.name || "Player"} · lap ${Math.max(0, Math.round(number(entry.lap, 0)))}`;
  }
  return row;
}

function createPositionChange(entry, positionKey) {
  let change = 0;
  if (editMode && Number.isFinite(Number(entry._previewChange))) {
    change = Number(entry._previewChange);
  } else if (positionKey === "position") {
    const carIndex = normalizedCarIndex(entry.carIndex);
    const initial = initialPositions.get(carIndex);
    const current = number(entry.position, 0);
    if (initial > 0 && current > 0) change = initial - current;
  }

  const cell = element("span", "position-change");
  if (change > 0) {
    cell.classList.add("gained");
    cell.append(element("span", "change-arrow", "▲"), element("b", "", String(Math.abs(change))));
  } else if (change < 0) {
    cell.classList.add("lost");
    cell.append(element("span", "change-arrow", "▼"), element("b", "", String(Math.abs(change))));
  } else {
    cell.classList.add("neutral");
    cell.textContent = "—";
  }
  return cell;
}

function createTimingCell(entry, fastestLap) {
  const mode = String(settings.timingColumn);
  const value = mode === "best" ? number(entry.bestLapSeconds, 0) : number(entry.lastLapSeconds, 0);
  const best = number(entry.bestLapSeconds, 0);
  const cell = element("span", "lap-time", formatLap(value));

  if (value > 0 && fastestLap > 0 && Math.abs(value - fastestLap) <= 0.006) {
    cell.classList.add("fastest");
  } else if (mode === "last" && value > 0 && best > 0 && value <= best + 0.02) {
    cell.classList.add("personal-best");
  }
  return cell;
}

function resolveGap(entry, positionKey, precedingEntry) {
  if (String(settings.gapMode) === "leader") {
    return number(entry.gapToLeaderSeconds, 0);
  }

  const position = number(entry[positionKey], 0);
  if (position <= 1) return 0;
  if (positionKey === "position") return number(entry.intervalSeconds, 0);

  const currentGap = number(entry.gapToLeaderSeconds, 0);
  const precedingGap = number(precedingEntry?.gapToLeaderSeconds, 0);
  return currentGap > 0 && precedingGap >= 0 ? Math.max(0, currentGap - precedingGap) : 0;
}

function createClassColorMap(classIds) {
  const palette = classPalette();
  return new Map(classIds.map((classId, index) => [Number(classId), palette[index % palette.length]]));
}

function classPalette() {
  const selected = String(settings.classPalette || "custom");
  if (selected === "vivid") return ["#ec407a", "#f0bd15", "#19b7d8", "#6c80ff", "#57c46f", "#ff8145"];
  if (selected === "cool") return ["#4cc9f0", "#4895ef", "#6574cd", "#8e65c7", "#45b7a0", "#78c6e7"];
  if (selected === "mono") {
    const accent = safeColor(settings.accent, DEFAULTS.accent);
    return [accent, mixHex(accent, "#ffffff", 0.22), mixHex(accent, "#000000", 0.18), mixHex(accent, "#ffffff", 0.42), mixHex(accent, "#000000", 0.34), mixHex(accent, "#ffffff", 0.1)];
  }
  return [1, 2, 3, 4, 5, 6].map((index) => safeColor(settings[`classColor${index}`], DEFAULTS[`classColor${index}`]));
}

function updateSessionBaseline(session, source) {
  const key = [source, session.sessionNumber, session.sessionName, session.trackName].join("|");
  if (key === lastSessionKey) return;
  lastSessionKey = key;
  initialPositions = new Map();
}

function updateInitialPositions(entries) {
  for (const entry of entries) {
    const carIndex = normalizedCarIndex(entry.carIndex);
    const position = number(entry.position, 0);
    if (carIndex >= 0 && position > 0 && !initialPositions.has(carIndex)) {
      initialPositions.set(carIndex, position);
    }
  }
}

function uniqueClassIds(entries) {
  const seen = new Set();
  const ids = [];
  for (const entry of [...entries].sort((a, b) => normalizedPosition(a.position) - normalizedPosition(b.position))) {
    const id = Number(entry.carClassId) || 0;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function timingBenchmark(entries) {
  const key = String(settings.timingColumn) === "best" ? "bestLapSeconds" : "lastLapSeconds";
  const values = entries.map((entry) => number(entry[key], 0)).filter((value) => value > 0);
  return values.length ? Math.min(...values) : 0;
}

function contrastText(color) {
  const [red, green, blue] = hexToRgb(color);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.56 ? "#101012" : "#ffffff";
}

function sessionMarkFor(value) {
  const sessionType = String(value || "RACE").trim().toUpperCase();
  if (sessionType.startsWith("Q")) return "Q";
  if (sessionType.startsWith("P")) return "P";
  if (sessionType.startsWith("W")) return "W";
  if (sessionType.startsWith("T")) return "T";
  return "R";
}

function formatSof(entries) {
  const values = (Array.isArray(entries) ? entries : [])
    .map((entry) => number(entry?.iRating, 0))
    .filter((value) => value > 0);
  if (!values.length) return "—";
  return String(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

function formatDuration(value) {
  const seconds = number(value, 0);
  if (seconds <= 0) return "--:--";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatLap(value) {
  const seconds = number(value, 0);
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
}

function formatGap(value, leader) {
  if (leader) return "—";
  const seconds = number(value, 0);
  if (seconds <= 0) return "—";
  if (seconds < 100) return seconds.toFixed(seconds < 10 ? 1 : 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds - minutes * 60)).padStart(2, "0")}`;
}

function formatIRating(value) {
  const rating = number(value, 0);
  if (rating <= 0) return "—";
  return rating >= 1000 ? `${(rating / 1000).toFixed(1)}k` : String(Math.round(rating));
}

function formatDriverName(value) {
  const name = String(value || "Unknown").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const format = String(settings.nameFormat || "full");
  if (parts.length <= 1 || format === "full") return name;
  if (format === "surname") return parts.at(-1);
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
}

function shortLicense(value) {
  const match = String(value || "").trim().match(/^([A-Za-z])/);
  return match ? match[1].toUpperCase() : "—";
}

function licenseGrade(value) {
  return String(value || "r").trim().charAt(0).toLowerCase();
}

function normalizedCarIndex(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function renderProtocolError(received) {
  cancelRender();
  const empty = element("div", "standings-empty protocol-error");
  empty.append(
    element("span", "empty-icon", "!"),
    element("b", "", "UNSUPPORTED TELEMETRY PROTOCOL"),
    element("span", "", `Race Standings requires protocol ${SUPPORTED_PROTOCOL}; received ${String(received ?? "unknown")}.`),
  );
  rowsHost.replaceChildren(empty);
}

function element(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function setRgbaVariable(variable, color, alpha) {
  const [red, green, blue] = hexToRgb(safeColor(color, "#000000"));
  root.style.setProperty(variable, `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`);
}

function safeColor(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function hexToRgb(color) {
  const value = safeColor(color, "#000000").slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function mixHex(left, right, rightWeight) {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  const weight = clamp(rightWeight, 0, 1);
  const mixed = leftRgb.map((value, index) => Math.round(value * (1 - weight) + rightRgb[index] * weight));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeChoice(value, allowed, fallback) {
  const text = String(value || "");
  return allowed.includes(text) ? text : fallback;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

applySettings();
render(effectivePayload());
window.parent.postMessage({ type: "apex:ready", moduleId: "com.apexhud.standings" }, "*");

})();
