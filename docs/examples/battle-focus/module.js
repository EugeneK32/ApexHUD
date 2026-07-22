(() => {
  "use strict";

  const MODULE_ID = "com.example.apexhud.battle-focus";
  const SUPPORTED_PROTOCOL = 5;
  const DEFAULTS = {
    mode: "auto",
    showNames: true,
    accent: "#f2c94c",
    opacity: 0.92,
  };

  const root = document.getElementById("widget");
  const modeLabel = document.getElementById("mode");
  const rowElements = new Map(
    ["ahead", "player", "behind"].map((kind) => [
      kind,
      document.querySelector(`[data-row="${kind}"]`),
    ])
  );

  const locale = String(navigator.language || "en").toLowerCase();
  const text = locale.startsWith("ru")
    ? {
        title: "БОРЬБА",
        ahead: "ВПЕРЕДИ",
        player: "ВЫ",
        behind: "СЗАДИ",
        noCar: "Нет машины",
        waiting: "Ожидание телеметрии",
        overall: "ОБЩИЙ",
        class: "КЛАСС",
        protocol: "Несовместимый протокол",
      }
    : {
        title: "BATTLE",
        ahead: "AHEAD",
        player: "YOU",
        behind: "BEHIND",
        noCar: "No car",
        waiting: "Waiting for telemetry",
        overall: "OVERALL",
        class: "CLASS",
        protocol: "Unsupported protocol",
      };

  document.getElementById("title").textContent = text.title;

  let settings = { ...DEFAULTS };
  let visible = true;
  let editMode = false;
  let lastSequence = -1;
  let latestPayload;
  let lastRenderAt = 0;

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (
      (message.type === "apex:init" || message.type === "apex:frame") &&
      message.protocolVersion !== SUPPORTED_PROTOCOL
    ) {
      renderProtocolError(message.protocolVersion);
      return;
    }

    if (message.type === "apex:init" || message.type === "apex:settings") {
      settings = {
        ...DEFAULTS,
        ...settings,
        ...(message.settings || {}),
      };
      applySettings();
      if (latestPayload) render(latestPayload);
      return;
    }

    if (message.type === "apex:visibility") {
      visible = Boolean(message.visible);
      editMode = Boolean(message.editMode);
      document.documentElement.classList.toggle("module-hidden", !visible);
      document.documentElement.classList.toggle("module-editing", editMode);
      if (visible && editMode && !latestPayload) renderDemo();
      return;
    }

    if (message.type === "apex:frame") {
      if (message.sequence === lastSequence) return;
      lastSequence = message.sequence;
      latestPayload = message.payload || {};
      if (!visible) return;

      const now = performance.now();
      if (now - lastRenderAt < 100) return; // The table needs only 10 Hz.
      lastRenderAt = now;
      render(latestPayload);
    }
  });

  function applySettings() {
    root.style.setProperty("--accent", normalizeColor(settings.accent));
    root.style.setProperty("--opacity", String(clampNumber(settings.opacity, 0.3, 1, 0.92)));
  }

  function render(payload) {
    const player = payload.player || {};
    const entries = Array.isArray(payload.standings?.entries)
      ? payload.standings.entries.filter(isEntry)
      : [];

    const playerEntry = entries.find(
      (entry) => entry.isPlayer || entry.carIndex === player.carIndex
    );

    if (!playerEntry) {
      renderWaiting();
      return;
    }

    const classes = new Set(entries.map((entry) => entry.carClassId));
    const requestedMode = String(settings.mode || "auto");
    const useClass = requestedMode === "class" || (requestedMode === "auto" && classes.size > 1);

    const ordered = entries
      .filter((entry) => !useClass || entry.carClassId === playerEntry.carClassId)
      .slice()
      .sort((left, right) => sortRank(left, useClass) - sortRank(right, useClass));

    const playerIndex = ordered.findIndex((entry) => entry.carIndex === playerEntry.carIndex);
    const ahead = playerIndex > 0 ? ordered[playerIndex - 1] : undefined;
    const behind = playerIndex >= 0 && playerIndex < ordered.length - 1
      ? ordered[playerIndex + 1]
      : undefined;

    modeLabel.textContent = useClass ? text.class : text.overall;
    updateRow("ahead", ahead, text.ahead, useClass, relativeGap(ahead, playerEntry));
    updateRow("player", playerEntry, text.player, useClass, 0);
    updateRow("behind", behind, text.behind, useClass, relativeGap(playerEntry, behind));
  }

  function updateRow(kind, entry, relation, useClass, gapSeconds) {
    const row = rowElements.get(kind);
    if (!row) return;

    const field = (name) => row.querySelector(`[data-field="${name}"]`);
    field("relation").textContent = relation;
    row.classList.toggle("empty", !entry);

    if (!entry) {
      field("position").textContent = "—";
      field("number").textContent = "--";
      field("name").textContent = text.noCar;
      field("gap").textContent = "—";
      setStatus(field("status"), "");
      return;
    }

    const position = rank(entry, useClass);
    field("position").textContent = position > 0 ? String(position) : "—";
    field("number").textContent = safeText(entry.carNumber, "--");
    field("name").textContent = settings.showNames
      ? safeText(entry.driverName, text.noCar)
      : safeText(entry.carClassName, "—");
    field("gap").textContent = kind === "player" ? "—" : formatGap(gapSeconds);
    setStatus(field("status"), safeText(entry.status, entry.onPitRoad ? "pit" : ""));
  }

  function setStatus(element, status) {
    const normalized = status === "pit" || status === "out" ? status : "";
    element.className = `status${normalized ? ` ${normalized}` : ""}`;
    element.textContent = normalized ? normalized.toUpperCase() : "";
  }

  function relativeGap(ahead, behind) {
    if (!ahead || !behind) return 0;
    const a = positive(ahead.gapToLeaderSeconds);
    const b = positive(behind.gapToLeaderSeconds);
    if (b >= a && (a > 0 || b > 0)) return b - a;
    return positive(behind.intervalSeconds);
  }

  function rank(entry, useClass) {
    return Math.max(0, Number(useClass ? entry.classPosition : entry.position) || 0);
  }

  function sortRank(entry, useClass) {
    return rank(entry, useClass) || 9999;
  }

  function renderWaiting() {
    modeLabel.textContent = text.overall;
    updateRow("ahead", undefined, text.ahead, false, 0);
    updateRow("player", {
      position: 0,
      classPosition: 0,
      carNumber: "--",
      driverName: text.waiting,
      carClassName: "",
      status: "",
      onPitRoad: false,
    }, text.player, false, 0);
    updateRow("behind", undefined, text.behind, false, 0);
  }

  function renderDemo() {
    const demo = {
      session: { sessionType: "Race" },
      player: { carIndex: 42 },
      standings: {
        entries: [
          demoEntry(18, 6, "18", "A. Smith", 0.84, false),
          demoEntry(42, 7, "42", "Your Driver", 1.68, true),
          demoEntry(11, 8, "11", "J. Costa", 2.91, false),
        ],
      },
    };
    render(demo);
  }

  function demoEntry(carIndex, position, carNumber, driverName, gap, isPlayer) {
    return {
      carIndex,
      position,
      classPosition: position,
      carNumber,
      driverName,
      carClassId: 101,
      carClassName: "GT3",
      gapToLeaderSeconds: gap,
      intervalSeconds: 0.8,
      status: "running",
      onPitRoad: false,
      isPlayer,
    };
  }

  function renderProtocolError(received) {
    modeLabel.textContent = "ERROR";
    const row = rowElements.get("player");
    if (!row) return;
    row.querySelector('[data-field="name"]').textContent = `${text.protocol}: ${received}`;
  }

  function isEntry(value) {
    return value && typeof value === "object" && Number.isFinite(Number(value.carIndex));
  }

  function formatGap(value) {
    const gap = positive(value);
    if (!gap) return "—";
    return `+${gap.toFixed(gap < 10 ? 2 : 1)}`;
  }

  function positive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function safeText(value, fallback) {
    const result = String(value ?? "").trim();
    return result || fallback;
  }

  function normalizeColor(value) {
    const color = String(value || "");
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULTS.accent;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.min(maximum, Math.max(minimum, number))
      : fallback;
  }

  applySettings();
  renderWaiting();

  window.parent.postMessage({ type: "apex:ready", moduleId: MODULE_ID }, "*");
})();
