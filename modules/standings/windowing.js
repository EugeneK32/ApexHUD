(() => {
  "use strict";
function selectVisibleStandings(
  entries,
  requestedRows,
  playerCarIndex = -1,
  positionKey = "position",
  focusMode = "hybrid",
  minimumRows = 5,
) {
  const source = Array.isArray(entries) ? entries : [];
  const rows = clampRows(requestedRows, minimumRows);
  if (source.length <= rows) return source;

  const playerIndex = findPlayerIndex(source, playerCarIndex);
  if (focusMode === "leaders" || playerIndex < 0) return source.slice(0, rows);

  if (focusMode === "player") {
    const leadingRows = Math.floor((rows - 1) / 2);
    const start = clamp(playerIndex - leadingRows, 0, Math.max(0, source.length - rows));
    return source.slice(start, start + rows);
  }

  if (playerIndex < rows) return source.slice(0, rows);

  const contextCount = Math.min(3, rows - 1);
  const leaderCount = Math.max(1, rows - contextCount);
  const selected = source.slice(0, leaderCount);
  const contextStart = clamp(playerIndex - 1, 0, Math.max(0, source.length - contextCount));

  for (const entry of source.slice(contextStart, contextStart + contextCount)) {
    if (!containsCar(selected, entry)) selected.push(entry);
  }

  return selected
    .sort((left, right) => normalizedPosition(left?.[positionKey]) - normalizedPosition(right?.[positionKey]))
    .slice(0, rows);
}

function selectGroupedStandings(
  entries,
  requestedRows,
  playerCarIndex = -1,
  focusMode = "hybrid",
) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const rows = clampRows(requestedRows);
  const groups = groupByClass(entries);
  const orderedGroups = [...groups.values()].sort((left, right) => {
    const leftPosition = Math.min(...left.entries.map((entry) => normalizedPosition(entry.position)));
    const rightPosition = Math.min(...right.entries.map((entry) => normalizedPosition(entry.position)));
    return leftPosition - rightPosition;
  });

  const allocations = allocateRows(orderedGroups, rows, playerCarIndex);
  return orderedGroups
    .map((group, index) => {
      const sorted = [...group.entries].sort(
        (left, right) => normalizedPosition(left.classPosition) - normalizedPosition(right.classPosition),
      );
      const groupHasPlayer = sorted.some((entry) => isPlayerEntry(entry, playerCarIndex));
      const groupFocus = groupHasPlayer ? focusMode : "leaders";
      return {
        carClassId: group.carClassId,
        carClassName: group.carClassName,
        totalCount: sorted.length,
        allEntries: sorted,
        entries: selectVisibleStandings(
          sorted,
          allocations[index],
          playerCarIndex,
          "classPosition",
          groupFocus,
          1,
        ),
      };
    })
    .filter((group) => group.entries.length > 0);
}

function identifyPlayerEntries(entries, player = {}) {
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

function normalizedPosition(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
}

function clampRows(value, minimum = 5) {
  const fallback = minimum <= 1 ? minimum : 16;
  return Math.max(minimum, Math.min(30, Math.round(Number(value) || fallback)));
}

function allocateRows(groups, rows, playerCarIndex) {
  const count = groups.length;
  if (count <= 1) return [rows];

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
    if (cursor > rows * count * 3) break;
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
  return Boolean(entry?.isPlayer)
    || (normalized >= 0 && normalizedCarIndex(entry?.carIndex) === normalized);
}

function containsCar(entries, candidate) {
  const candidateIndex = normalizedCarIndex(candidate?.carIndex);
  return entries.some((entry) => {
    const entryIndex = normalizedCarIndex(entry?.carIndex);
    return candidateIndex >= 0 ? entryIndex === candidateIndex : entry === candidate;
  });
}

function normalizedCarIndex(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

  window.StandingsWindowing = Object.freeze({
    identifyPlayerEntries,
    normalizedPosition,
    selectGroupedStandings,
    selectVisibleStandings,
  });
})();
