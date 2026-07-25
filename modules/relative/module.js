(() => {
  "use strict";

  const SUPPORTED_PROTOCOL = 6;
  const MODULE_ID = "com.apexhud.relative";
  const DEFAULTS = {
    carsAhead: 3,
    carsBehind: 3,
    classFilter: "all",
    gapMode: "time",
    gapSigns: "none",
    nameFormat: "full",
    rowHeight: 28,
    fontScale: 0.92,
    headerMode: "compact",
    footerMode: "full",
    playerHighlight: "row",
    cornerRadius: 3,
    shadowStrength: 0.2,
    showPosition: true,
    positionMode: "overall",
    showCarNumber: false,
    showLicense: true,
    showIRating: true,
    showClassStripe: true,
    showStatus: true,
    showTemperature: true,
    temperatureSource: "track",
    showSoF: true,
    showFieldPosition: true,
    showLapFooter: true,
    showSessionFooter: true,
    autoHideWhenEmpty: false,
    backgroundColor: "#000000",
    backgroundOpacity: 0.92,
    headerColor: "#000000",
    headerOpacity: 0.96,
    rowColor: "#090909",
    alternateRowColor: "#262626",
    rowOpacity: 0.94,
    playerRowColor: "#7A6200",
    playerAccentColor: "#F2C94C",
    textColor: "#F7F7F8",
    mutedTextColor: "#8D8D92",
    aheadGapColor: "#FFFFFF",
    behindGapColor: "#FFFFFF",
    pitColor: "#F2C94C",
    licenseAColor: "#3485EB",
    licenseBColor: "#20B968",
    licenseCColor: "#F2C94C",
    licenseDColor: "#F08A24",
    licenseRColor: "#D94B4B",
    classColor1: "#35BFE8",
    classColor2: "#FF4F86",
    classColor3: "#F5CF4B",
    classColor4: "#3ED16F",
    classColor5: "#8B7CFF",
    classColor6: "#F08A24",
  };

  const root = document.getElementById("relative");
  const header = document.getElementById("header");
  const footer = document.getElementById("footer");
  const rows = document.getElementById("rows");
  const emptyState = document.getElementById("empty");
  const protocolState = document.getElementById("protocol");
  const protocolMessage = document.getElementById("protocol-message");

  const temperature = document.getElementById("temperature");
  const temperatureValue = document.getElementById("temperature-value");
  const temperatureLabel = document.getElementById("temperature-label");
  const sof = document.getElementById("sof");
  const sofValue = document.getElementById("sof-value");
  const field = document.getElementById("field");
  const fieldValue = document.getElementById("field-value");
  const lap = document.getElementById("lap");
  const lapValue = document.getElementById("lap-value");
  const session = document.getElementById("session");
  const sessionLabel = document.getElementById("session-label");
  const sessionValue = document.getElementById("session-value");

  let settings = { ...DEFAULTS };
  let latestPayload = {};
  let editMode = window.parent === window;
  let visible = true;
  let unsupportedProtocol = false;
  let lastSequence = -1;
  let hasTelemetryFrame = false;
  let renderTimer = 0;
  let lastRenderAt = 0;

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (message.type === "apex:init" || message.type === "apex:frame") {
      if (Number(message.protocolVersion) !== SUPPORTED_PROTOCOL) {
        showProtocolError(message.protocolVersion);
        return;
      }
      unsupportedProtocol = false;
    }

    switch (message.type) {
      case "apex:init":
      case "apex:settings":
        settings = mergeSettings(message.settings);
        applySettings();
        queueRender(true);
        break;

      case "apex:visibility":
        visible = Boolean(message.visible);
        editMode = Boolean(message.editMode);
        document.documentElement.classList.toggle("module-hidden", !visible);
        queueRender(true);
        break;

      case "apex:frame":
        if (!visible || Number(message.sequence) === lastSequence) return;
        lastSequence = Number(message.sequence);
        latestPayload = isRecord(message.payload) ? message.payload : {};
        hasTelemetryFrame = true;
        queueRender(false);
        break;
    }
  });

  const resizeObserver = new ResizeObserver(() => queueRender(true));
  resizeObserver.observe(root);

  function mergeSettings(incoming) {
    const source = isRecord(incoming) ? { ...incoming } : {};

    if (source.rows !== undefined && source.carsAhead === undefined && source.carsBehind === undefined) {
      const total = clampInteger(source.rows, 2, 16, 6);
      source.carsAhead = Math.ceil(total / 2);
      source.carsBehind = Math.floor(total / 2);
    }
    if (source.opacity !== undefined && source.backgroundOpacity === undefined) {
      source.backgroundOpacity = source.opacity;
    }
    if (source.accent !== undefined && source.playerAccentColor === undefined) {
      source.playerAccentColor = source.accent;
    }
    if (source.headerStyle !== undefined && source.headerMode === undefined) {
      source.headerMode = source.headerStyle;
    }
    if (source.footerStyle !== undefined && source.footerMode === undefined) {
      source.footerMode = source.footerStyle;
    }

    // Relative 3.x persisted hideWhenEmpty=true by default. Reusing that key
    // would make upgraded instances vanish as soon as apex:init arrives, before
    // live relative data is available. The new opt-in key deliberately ignores
    // the legacy value.
    delete source.hideWhenEmpty;

    return { ...DEFAULTS, ...settings, ...source };
  }

  function applySettings() {
    const headerMode = validChoice(settings.headerMode, ["compact", "full", "hidden"], "compact");
    const footerMode = validChoice(settings.footerMode, ["compact", "full", "hidden"], "compact");

    temperature.hidden = !Boolean(settings.showTemperature);
    sof.hidden = !Boolean(settings.showSoF);
    field.hidden = !Boolean(settings.showFieldPosition);
    lap.hidden = !Boolean(settings.showLapFooter);
    session.hidden = !Boolean(settings.showSessionFooter);

    const effectiveHeader = temperature.hidden && sof.hidden && field.hidden ? "hidden" : headerMode;
    const effectiveFooter = lap.hidden && session.hidden ? "hidden" : footerMode;

    root.className = [
      "relative",
      `header-${effectiveHeader}`,
      `footer-${effectiveFooter}`,
      settings.showPosition ? "" : "no-position",
      settings.showClassStripe ? "" : "no-class-stripe",
      settings.showLicense ? "" : "no-license",
      settings.showIRating ? "" : "no-irating",
    ].filter(Boolean).join(" ");

    setCss("--panel-bg", rgba(settings.backgroundColor, settings.backgroundOpacity, DEFAULTS.backgroundColor, DEFAULTS.backgroundOpacity));
    setCss("--chrome-bg", rgba(settings.headerColor, settings.headerOpacity, DEFAULTS.headerColor, DEFAULTS.headerOpacity));
    setCss("--row-bg", rgba(settings.rowColor, settings.rowOpacity, DEFAULTS.rowColor, DEFAULTS.rowOpacity));
    setCss("--row-alt-bg", rgba(settings.alternateRowColor, settings.rowOpacity, DEFAULTS.alternateRowColor, DEFAULTS.rowOpacity));
    setCss("--player-row-bg", rgba(settings.playerRowColor, settings.rowOpacity, DEFAULTS.playerRowColor, DEFAULTS.rowOpacity));
    setCss("--text", safeColor(settings.textColor, DEFAULTS.textColor));
    setCss("--muted", safeColor(settings.mutedTextColor, DEFAULTS.mutedTextColor));
    setCss("--player-accent", safeColor(settings.playerAccentColor, DEFAULTS.playerAccentColor));
    setCss("--ahead-gap", safeColor(settings.aheadGapColor, DEFAULTS.aheadGapColor));
    setCss("--behind-gap", safeColor(settings.behindGapColor, DEFAULTS.behindGapColor));
    setCss("--pit", safeColor(settings.pitColor, DEFAULTS.pitColor));
    setCss("--radius", `${clampNumber(settings.cornerRadius, 0, 10, DEFAULTS.cornerRadius)}px`);
    setCss("--shadow-alpha", String(clampNumber(settings.shadowStrength, 0, 1, DEFAULTS.shadowStrength) * 0.7));
    setCss("--font-scale", String(clampNumber(settings.fontScale, 0.72, 1.25, DEFAULTS.fontScale)));
  }

  function queueRender(immediate) {
    window.clearTimeout(renderTimer);
    const now = performance.now();
    const delay = immediate ? 0 : Math.max(0, 80 - (now - lastRenderAt));
    renderTimer = window.setTimeout(() => {
      if (!visible) return;
      lastRenderAt = performance.now();
      render();
    }, delay);
  }

  function render() {
    if (unsupportedProtocol) return;

    const payload = editMode && window.RelativeDemo
      ? window.RelativeDemo.createDemoPayload()
      : latestPayload;
    const model = buildModel(payload);

    updateHeader(model);
    updateFooter(model);

    const hasNearby = model.ahead.length > 0 || model.behind.length > 0;
    const liveSource = String(latestPayload.source || "") === "iracing";
    const shouldAutoHide = !editMode
      && hasTelemetryFrame
      && liveSource
      && Boolean(settings.autoHideWhenEmpty)
      && !hasNearby;
    root.hidden = shouldAutoHide;
    if (root.hidden) return;

    protocolState.hidden = true;
    const hasPlayer = model.player.available;
    emptyState.hidden = hasNearby || hasPlayer;
    rows.hidden = !emptyState.hidden;
    if (!emptyState.hidden) {
      rows.replaceChildren();
      return;
    }

    const requestedSlots = Math.max(
      1,
      clampInteger(settings.carsAhead, 1, 8, DEFAULTS.carsAhead)
        + clampInteger(settings.carsBehind, 1, 8, DEFAULTS.carsBehind)
        + (model.player.available ? 1 : 0),
    );
    const rowHeight = configureTypography(requestedSlots);
    const rowModels = rowsForAvailableSpace(model, rowHeight);
    rows.replaceChildren(...rowModels.map(createRow));
  }

  function buildModel(payload) {
    const sessionState = record(payload.session);
    const playerState = record(payload.player);
    const environmentState = record(payload.environment);
    const relativeEntries = array(payload.relative?.entries);
    const standingsEntries = array(payload.standings?.entries).filter(isRecord);
    const standingsByCar = new Map();

    for (const entry of standingsEntries) {
      const carIndex = integer(entry.carIndex, -1);
      if (carIndex >= 0) standingsByCar.set(carIndex, entry);
    }

    const playerCarIndex = integer(playerState.carIndex, -1);
    const playerStanding = standingsByCar.get(playerCarIndex)
      || standingsEntries.find((entry) => Boolean(entry.isPlayer))
      || {};
    const player = enrichPlayer(playerState, playerStanding);

    const nearby = relativeEntries
      .filter(isRecord)
      .map((entry) => enrichRelative(entry, standingsByCar.get(integer(entry.carIndex, -1)) || {}))
      .filter((entry) => classAllowed(entry, player))
      .filter((entry) => entry.carIndex !== player.carIndex);

    const ahead = nearby
      .filter((entry) => entry.relation === "ahead")
      .sort(compareNearest);
    const behind = nearby
      .filter((entry) => entry.relation === "behind")
      .sort(compareNearest);

    return {
      session: sessionState,
      environment: environmentState,
      standings: standingsEntries,
      player,
      ahead,
      behind,
    };
  }

  function enrichPlayer(player, standing) {
    const name = text(player.name, text(standing.driverName, "Player"));
    return {
      available: Boolean(name) || integer(player.carIndex, -1) >= 0,
      isPlayer: true,
      carIndex: integer(player.carIndex, integer(standing.carIndex, -1)),
      driverName: name,
      carNumber: text(player.carNumber, text(standing.carNumber, "")),
      carClassId: integer(player.carClassId, integer(standing.carClassId, 0)),
      carClassName: text(player.carClassName, text(standing.carClassName, "")),
      position: positiveInteger(player.position, positiveInteger(standing.position, 0)),
      classPosition: positiveInteger(player.classPosition, positiveInteger(standing.classPosition, 0)),
      iRating: positiveInteger(player.iRating, positiveInteger(standing.iRating, 0)),
      license: text(player.license, text(standing.license, "")),
      onPitRoad: Boolean(player.onPitRoad || standing.onPitRoad),
      status: text(standing.status, player.onPitRoad ? "pit" : "running").toLowerCase(),
      relation: "player",
      distanceMeters: 0,
      estimatedGapSeconds: 0,
    };
  }

  function enrichRelative(entry, standing) {
    return {
      available: true,
      isPlayer: false,
      carIndex: integer(entry.carIndex, integer(standing.carIndex, -1)),
      driverName: text(entry.driverName, text(standing.driverName, "Unknown driver")),
      carNumber: text(entry.carNumber, text(standing.carNumber, "")),
      carClassId: integer(standing.carClassId, 0),
      carClassName: text(entry.carClassName, text(standing.carClassName, "")),
      position: positiveInteger(entry.position, positiveInteger(standing.position, 0)),
      classPosition: positiveInteger(standing.classPosition, 0),
      iRating: positiveInteger(standing.iRating, 0),
      license: text(standing.license, ""),
      onPitRoad: Boolean(entry.onPitRoad || standing.onPitRoad),
      status: text(standing.status, entry.onPitRoad ? "pit" : "running").toLowerCase(),
      relation: text(entry.relation, "").toLowerCase(),
      distanceMeters: finite(entry.distanceMeters, 0),
      estimatedGapSeconds: finite(entry.estimatedGapSeconds, 0),
    };
  }

  function rowsForAvailableSpace(model, rowHeight) {
    const wantedAhead = Math.min(clampInteger(settings.carsAhead, 1, 8, 3), model.ahead.length);
    const wantedBehind = Math.min(clampInteger(settings.carsBehind, 1, 8, 3), model.behind.length);
    const wantedRows = wantedAhead + wantedBehind + (model.player.available ? 1 : 0);
    const safeRowHeight = clampNumber(rowHeight, 20, 38, 30);
    const capacity = Math.max(
      1,
      Math.min(wantedRows, Math.floor(Math.max(1, rows.clientHeight) / safeRowHeight)),
    );

    if (!model.player.available) {
      const combined = [...model.ahead, ...model.behind].sort(compareNearest);
      return combined.slice(0, capacity);
    }

    const opponentSlots = Math.max(0, capacity - 1);
    let aheadCount = Math.min(wantedAhead, Math.ceil(opponentSlots / 2));
    let behindCount = Math.min(wantedBehind, Math.floor(opponentSlots / 2));
    let remaining = opponentSlots - aheadCount - behindCount;

    while (remaining > 0) {
      if (aheadCount < wantedAhead) {
        aheadCount += 1;
        remaining -= 1;
        continue;
      }
      if (behindCount < wantedBehind) {
        behindCount += 1;
        remaining -= 1;
        continue;
      }
      break;
    }

    const ahead = model.ahead.slice(0, aheadCount).reverse();
    const behind = model.behind.slice(0, behindCount);
    return [...ahead, model.player, ...behind];
  }

  function configureTypography(requestedSlots) {
    const scale = clampNumber(settings.fontScale, 0.72, 1.25, DEFAULTS.fontScale);
    const configuredHeight = clampNumber(settings.rowHeight, 20, 52, DEFAULTS.rowHeight) * scale;
    const availableHeight = Math.max(1, rows.clientHeight);
    const fillHeight = availableHeight / Math.max(1, requestedSlots);

    // Rows may grow just enough to use a normal seven-row panel, but never
    // according to the number of cars that happen to survive filtering.
    // This keeps a two-car class relative compact instead of turning it into
    // two enormous full-height cards.
    const rowHeight = clampNumber(Math.max(configuredHeight, fillHeight), 20, 38, 30);
    const rowFont = clampNumber(rowHeight * 0.52, 11, 21, 17);
    const badgeFont = clampNumber(rowHeight * 0.35, 9, 14, 12);
    const metaFont = clampNumber(rowHeight * 0.29, 8, 12, 10);
    const positionWidth = clampNumber(rowHeight * 1.08, 30, 46, 38);
    const gapWidth = clampNumber(rowHeight * 1.36, 42, 58, 48);
    const stripeWidth = clampNumber(rowHeight * 0.14, 4, 7, 5);

    setCss("--row-height", `${rowHeight}px`);
    setCss("--row-font", `${rowFont}px`);
    setCss("--badge-font", `${badgeFont}px`);
    setCss("--meta-font", `${metaFont}px`);
    setCss("--position-width", `${positionWidth}px`);
    setCss("--gap-width", `${gapWidth}px`);
    setCss("--stripe-width", `${stripeWidth}px`);
    return rowHeight;
  }

  function createRow(model) {
    const row = element("article", "relative-row");
    row.classList.toggle("player", model.isPlayer);
    if (model.isPlayer) {
      row.classList.add(`player-highlight-${validChoice(settings.playerHighlight, ["row", "stripe", "name"], "row")}`);
    }

    const classColor = classColorFor(model.carClassId, model.carClassName);
    row.style.setProperty("--class-color", classColor);
    row.style.setProperty("--gap-color", model.relation === "ahead"
      ? safeColor(settings.aheadGapColor, DEFAULTS.aheadGapColor)
      : model.relation === "behind"
        ? safeColor(settings.behindGapColor, DEFAULTS.behindGapColor)
        : safeColor(settings.textColor, DEFAULTS.textColor));

    const position = settings.positionMode === "class" ? model.classPosition : model.position;
    const positionCell = textElement("div", "position-cell", position > 0 ? String(position) : "—");
    const stripe = element("div", "class-stripe");

    const driverCell = element("div", "driver-cell");
    if (Boolean(settings.showCarNumber) && model.carNumber) {
      driverCell.append(textElement("span", "car-number", `#${model.carNumber}`));
    }
    driverCell.append(textElement("span", "driver-name", formatName(model.driverName, settings.nameFormat)));

    const licenseCell = element("div", "badge-cell license-cell");
    const licenseBadge = textElement("span", "license-badge", formatLicense(model.license));
    licenseBadge.style.setProperty("--license-color", licenseColorFor(model.license));
    licenseCell.append(licenseBadge);

    const iratingCell = element("div", "badge-cell irating-cell");
    iratingCell.append(textElement("span", "irating-badge", formatIRating(model.iRating)));
    const status = statusText(model);
    if (Boolean(settings.showStatus) && status) {
      iratingCell.append(textElement("span", "status-badge", status));
    }

    const gapCell = textElement("div", "gap-cell", formatGap(model));
    row.append(positionCell, stripe, driverCell, licenseCell, iratingCell, gapCell);
    return row;
  }

  function updateHeader(model) {
    const track = settings.temperatureSource !== "air";
    const temperatureNumber = optionalNumber(track
      ? model.environment.trackTemperatureCelsius
      : model.environment.airTemperatureCelsius);
    temperatureLabel.textContent = track ? "TRACK" : "AIR";
    temperatureValue.textContent = temperatureNumber === null ? "—°C" : `${Math.round(temperatureNumber)}°C`;

    const ratings = model.standings
      .map((entry) => positiveInteger(entry.iRating, 0))
      .filter((value) => value > 0);
    const average = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
    sofValue.textContent = average > 0 ? formatIRating(Math.round(average)) : "—";

    const position = settings.positionMode === "class" ? model.player.classPosition : model.player.position;
    const fieldSize = settings.positionMode === "class"
      ? classFieldSize(model.standings, model.player)
      : model.standings.length;
    fieldValue.textContent = `${position > 0 ? position : "—"}/${fieldSize > 0 ? fieldSize : "—"}`;
  }

  function updateFooter(model) {
    const player = model.player;
    const sessionState = model.session;
    const currentLap = positiveInteger(record(editMode && window.RelativeDemo ? window.RelativeDemo.createDemoPayload().player : latestPayload.player).lap, 0);
    if (Boolean(sessionState.hasLapLimit) && currentLap > 0) {
      const remaining = positiveInteger(sessionState.lapsRemaining, 0);
      const total = remaining > 0 ? currentLap + remaining - 1 : currentLap;
      lapValue.textContent = `${currentLap}/${Math.max(currentLap, total)}`;
    } else {
      lapValue.textContent = currentLap > 0 ? String(currentLap) : "—";
    }

    sessionLabel.textContent = titleCase(text(sessionState.sessionType, text(sessionState.sessionName, "Session")));
    const elapsed = nonNegative(sessionState.sessionTimeSeconds, 0);
    if (Boolean(sessionState.hasTimeLimit)) {
      const remaining = nonNegative(sessionState.timeRemainingSeconds, 0);
      const totalMinutes = Math.max(1, Math.round((elapsed + remaining) / 60));
      sessionValue.textContent = `${formatClock(elapsed)}/${totalMinutes}m`;
    } else if (Boolean(sessionState.hasLapLimit)) {
      sessionValue.textContent = `${positiveInteger(sessionState.lapsRemaining, 0)} laps`;
    } else {
      sessionValue.textContent = elapsed > 0 ? formatClock(elapsed) : "—";
    }

    void player;
  }

  function classAllowed(entry, player) {
    if (settings.classFilter !== "class") return true;
    if (player.carClassId > 0 && entry.carClassId > 0) return player.carClassId === entry.carClassId;
    if (player.carClassName && entry.carClassName) {
      return player.carClassName.toLowerCase() === entry.carClassName.toLowerCase();
    }
    return true;
  }

  function classFieldSize(entries, player) {
    if (player.carClassId > 0) {
      return entries.filter((entry) => integer(entry.carClassId, 0) === player.carClassId).length;
    }
    if (player.carClassName) {
      const name = player.carClassName.toLowerCase();
      return entries.filter((entry) => text(entry.carClassName, "").toLowerCase() === name).length;
    }
    return entries.length;
  }

  function formatGap(model) {
    if (model.isPlayer) return "0.0";
    const mode = validChoice(settings.gapMode, ["time", "distance", "auto"], "time");
    const seconds = Math.abs(finite(model.estimatedGapSeconds, 0));
    const metres = Math.abs(finite(model.distanceMeters, 0));
    const resolved = mode === "auto" ? (seconds > 0 ? "time" : "distance") : mode;
    const signMode = validChoice(settings.gapSigns, ["none", "signed", "behind"], "none");
    let sign = "";
    if (signMode === "signed") sign = model.relation === "ahead" ? "−" : "+";
    if (signMode === "behind" && model.relation === "behind") sign = "+";

    if (resolved === "distance") {
      if (metres <= 0) return "—";
      const value = metres >= 1000 ? `${(metres / 1000).toFixed(1)}k` : `${Math.round(metres)}m`;
      return `${sign}${value}`;
    }
    if (seconds <= 0) return "—";
    return `${sign}${seconds.toFixed(seconds < 100 ? 1 : 0)}`;
  }

  function formatName(value, mode) {
    const name = text(value, "Unknown driver");
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || mode === "full") return name;
    const surname = parts[parts.length - 1];
    return mode === "surname" ? surname : `${parts[0].charAt(0)}. ${surname}`;
  }

  function formatLicense(value) {
    const source = text(value, "—").trim();
    const match = /^([A-Za-z]+)\s*([0-9]+(?:\.[0-9]+)?)/.exec(source);
    if (!match) return source;
    const number = Number(match[2]);
    return Number.isFinite(number) ? `${match[1].toUpperCase()} ${number.toFixed(1)}` : source;
  }

  function formatIRating(value) {
    const rating = positiveInteger(value, 0);
    if (rating <= 0) return "—";
    if (rating >= 1000) return `${(rating / 1000).toFixed(rating >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
    return String(rating);
  }

  function statusText(model) {
    if (model.onPitRoad || model.status === "pit") return "PIT";
    if (model.status === "out") return "OUT";
    return "";
  }

  function classColorFor(classId, className) {
    const palette = [1, 2, 3, 4, 5, 6].map((index) => safeColor(settings[`classColor${index}`], DEFAULTS[`classColor${index}`]));
    const key = classId > 0 ? String(classId) : text(className, "class");
    return palette[Math.abs(hashString(key)) % palette.length];
  }

  function licenseColorFor(value) {
    const letter = text(value, "R").trim().charAt(0).toUpperCase();
    const colors = {
      A: safeColor(settings.licenseAColor, DEFAULTS.licenseAColor),
      B: safeColor(settings.licenseBColor, DEFAULTS.licenseBColor),
      C: safeColor(settings.licenseCColor, DEFAULTS.licenseCColor),
      D: safeColor(settings.licenseDColor, DEFAULTS.licenseDColor),
      R: safeColor(settings.licenseRColor, DEFAULTS.licenseRColor),
    };
    return colors[letter] || colors.R;
  }

  function showProtocolError(received) {
    unsupportedProtocol = true;
    root.hidden = false;
    rows.hidden = true;
    emptyState.hidden = true;
    protocolState.hidden = false;
    protocolMessage.textContent = `Race Relative requires protocol v${SUPPORTED_PROTOCOL}; received ${Number.isFinite(Number(received)) ? `v${received}` : "an unknown version"}.`;
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(nonNegative(seconds, 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function compareNearest(left, right) {
    const leftGap = Math.abs(finite(left.estimatedGapSeconds, 0)) || Math.abs(finite(left.distanceMeters, 0));
    const rightGap = Math.abs(finite(right.estimatedGapSeconds, 0)) || Math.abs(finite(right.distanceMeters, 0));
    return leftGap - rightGap;
  }

  function rgba(value, opacity, fallbackColor, fallbackOpacity) {
    const color = safeColor(value, fallbackColor).slice(1);
    const expanded = color.length === 3 ? color.split("").map((char) => char + char).join("") : color.slice(0, 6);
    const parsed = Number.parseInt(expanded, 16);
    const red = (parsed >> 16) & 255;
    const green = (parsed >> 8) & 255;
    const blue = parsed & 255;
    const alpha = clampNumber(opacity, 0, 1, fallbackOpacity);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function safeColor(value, fallback) {
    const candidate = typeof value === "string" ? value : fallback;
    return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(candidate) ? candidate : fallback;
  }

  function setCss(name, value) {
    root.style.setProperty(name, String(value));
  }

  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function textElement(tag, className, value) {
    const node = element(tag, className);
    node.textContent = String(value ?? "");
    return node;
  }

  function titleCase(value) {
    const source = text(value, "Session").trim();
    return source ? source.charAt(0).toUpperCase() + source.slice(1).toLowerCase() : "Session";
  }

  function hashString(value) {
    let hash = 0;
    for (const char of String(value)) hash = ((hash * 31) + char.charCodeAt(0)) | 0;
    return hash;
  }

  function validChoice(value, choices, fallback) {
    return choices.includes(value) ? value : fallback;
  }

  function record(value) {
    return isRecord(value) ? value : {};
  }

  function array(value) {
    return Array.isArray(value) ? value : [];
  }

  function isRecord(value) {
    return typeof value === "object" && value !== null;
  }

  function text(value, fallback) {
    return typeof value === "string" && value.trim() ? value : fallback;
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function optionalNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function integer(value, fallback) {
    const number = Math.trunc(Number(value));
    return Number.isFinite(number) ? number : fallback;
  }

  function positiveInteger(value, fallback) {
    const number = Math.trunc(Number(value));
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function nonNegative(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : fallback));
  }

  function clampInteger(value, minimum, maximum, fallback) {
    return Math.round(clampNumber(value, minimum, maximum, fallback));
  }

  applySettings();
  render();
  window.parent.postMessage({ type: "apex:ready", moduleId: MODULE_ID }, "*");
})();
