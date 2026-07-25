export function selectVisibleStandings(entries, requestedRows, playerCarIndex = -1, positionKey = "position") {
  const rows = clampRows(requestedRows);
  if (!Array.isArray(entries) || entries.length <= rows) {
    return Array.isArray(entries) ? entries : [];
  }

  const playerIndex = findPlayerIndex(entries, playerCarIndex);
  if (playerIndex < 0 || playerIndex < rows) {
    return entries.slice(0, rows);
  }

  const topCount = Math.max(1, rows - 2);
  const result = entries.slice(0, topCount);
  const player = entries[playerIndex];
  const following = entries[playerIndex + 1];
  const preceding = entries[playerIndex - 1];

  if (!following && preceding && !containsCar(result, preceding)) result.push(preceding);
  if (player && !containsCar(result, player)) result.push(player);
  if (following && !containsCar(result, following)) result.push(following);

  return result
    .sort((left, right) => normalizedPosition(left?.[positionKey]) - normalizedPosition(right?.[positionKey]))
    .slice(0, rows);
}

export function selectGroupedStandings(entries, requestedRows, playerCarIndex = -1) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const rows = clampRows(requestedRows);
  const groups = groupByClass(entries);
  const orderedGroups = [...groups.values()].sort((left, right) => {
    const leftPosition = Math.min(...left.entries.map((entry) => normalizedPosition(entry.position)));
    const rightPosition = Math.min(...right.entries.map((entry) => normalizedPosition(entry.position)));
    return leftPosition - rightPosition;
  });

  const allocations = allocateRows(orderedGroups, rows, playerCarIndex);
  return orderedGroups.map((group, index) => ({
    carClassId: group.carClassId,
    carClassName: group.carClassName,
    entries: selectVisibleStandings(
      [...group.entries].sort((a, b) => normalizedPosition(a.classPosition) - normalizedPosition(b.classPosition)),
      allocations[index],
      playerCarIndex,
      "classPosition",
    ),
  })).filter((group) => group.entries.length > 0);
}

export function identifyPlayerEntries(entries, player = {}) {
  if (!Array.isArray(entries)) return [];

  const playerCarIndex = normalizedCarIndex(player?.carIndex);
  let matchedIndex = playerCarIndex >= 0
    ? entries.findIndex((entry) => normalizedCarIndex(entry?.carIndex) === playerCarIndex)
    : -1;

  if (matchedIndex < 0) {
    const carNumber = String(player?.carNumber || "").trim();
    if (carNumber) {
      const matches = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => String(entry?.carNumber || "").trim() === carNumber);
      if (matches.length === 1) matchedIndex = matches[0].index;
    }
  }

  if (matchedIndex < 0) {
    const name = String(player?.name || "").trim().toLocaleLowerCase();
    if (name) {
      const matches = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => String(entry?.driverName || "").trim().toLocaleLowerCase() === name);
      if (matches.length === 1) matchedIndex = matches[0].index;
    }
  }

  return entries.map((entry, index) => ({
    ...entry,
    isPlayer: matchedIndex >= 0 ? index === matchedIndex : Boolean(entry?.isPlayer),
  }));
}

function allocateRows(groups, rows, playerCarIndex) {
  const count = groups.length;
  if (count === 1) return [rows];

  const minimum = rows >= count * 3 ? 3 : Math.max(1, Math.floor(rows / count));
  const allocations = groups.map(() => minimum);
  let remaining = Math.max(0, rows - minimum * count);

  const playerGroupIndex = groups.findIndex((group) =>
    group.entries.some((entry) => isPlayerEntry(entry, playerCarIndex)),
  );

  const order = [];
  if (playerGroupIndex >= 0) order.push(playerGroupIndex);
  for (let index = 0; index < count; index += 1) {
    if (index !== playerGroupIndex) order.push(index);
  }

  let cursor = 0;
  while (remaining > 0 && order.length > 0) {
    const groupIndex = order[cursor % order.length];
    if (allocations[groupIndex] < groups[groupIndex].entries.length) {
      allocations[groupIndex] += 1;
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > rows * count * 2) break;
  }

  return allocations;
}

function groupByClass(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const carClassId = Number(entry?.carClassId) || 0;
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

function findPlayerIndex(entries, playerCarIndex) {
  const normalized = normalizedCarIndex(playerCarIndex);
  let playerIndex = normalized >= 0
    ? entries.findIndex((entry) => normalizedCarIndex(entry?.carIndex) === normalized)
    : -1;
  if (playerIndex < 0) playerIndex = entries.findIndex((entry) => Boolean(entry?.isPlayer));
  return playerIndex;
}

function isPlayerEntry(entry, playerCarIndex) {
  const normalized = normalizedCarIndex(playerCarIndex);
  return Boolean(entry?.isPlayer) ||
    (normalized >= 0 && normalizedCarIndex(entry?.carIndex) === normalized);
}

function containsCar(entries, candidate) {
  return entries.some((entry) => entry?.carIndex === candidate?.carIndex);
}

function normalizedPosition(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
}

function normalizedCarIndex(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function clampRows(value) {
  return Math.max(5, Math.min(30, Math.round(Number(value) || 16)));
}
