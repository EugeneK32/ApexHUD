(() => {
  "use strict";
const classes = [
  { id: 3101, name: "GTP", count: 7, baseRating: 3920 },
  { id: 2207, name: "LMP2", count: 6, baseRating: 3180 },
  { id: 1184, name: "GT3", count: 9, baseRating: 2740 },
];

const names = [
  "Mason Carter", "Luca Moretti", "Eugene Konovalov", "Noah Williams", "Oliver Berg",
  "Jonas Keller", "Theo Laurent", "Martin Novak", "Daniel Cooper", "Emil Andersson",
  "Alex Mercer", "Rafael Costa", "Victor Hwang", "Leon Fischer", "Samuel Brooks",
  "Mateo Rossi", "Nikolai Petrov", "Arthur Martin", "Finn Jensen", "David Clarke",
  "Santiago Ruiz", "Hugo Bernard", "Maxim Volkov", "Ethan Walker",
];

function createDemoPayload() {
  const entries = [];
  let overallPosition = 1;
  let nameIndex = 0;

  for (const [classIndex, carClass] of classes.entries()) {
    for (let classPosition = 1; classPosition <= carClass.count; classPosition += 1) {
      const driverName = names[nameIndex % names.length];
      const carIndex = nameIndex;
      const bestLap = 66.8 + classIndex * 5.7 + classPosition * 0.115;
      const lastLap = bestLap + ((classPosition % 4) - 1) * 0.18 + 0.12;
      const gapToLeader = overallPosition === 1 ? 0 : (overallPosition - 1) * 0.64 + classIndex * 1.8;
      const interval = overallPosition === 1 ? 0 : 0.3 + (overallPosition % 5) * 0.17;
      const isPlayer = driverName === "Eugene Konovalov";

      entries.push({
        carIndex,
        position: overallPosition,
        classPosition,
        carNumber: String(8 + (nameIndex * 7) % 91),
        driverName,
        teamName: `${driverName.split(" ").at(-1)} Racing`,
        carClassId: carClass.id,
        carClassName: carClass.name,
        iRating: carClass.baseRating - classPosition * 105 + (nameIndex % 3) * 55,
        license: ["A 3.42", "A 2.87", "B 4.12", "A 4.68"][nameIndex % 4],
        lap: 14 - classIndex,
        lapDistancePercent: 0.86 - overallPosition * 0.018,
        gapToLeaderSeconds: gapToLeader,
        intervalSeconds: interval,
        lastLapSeconds: lastLap,
        bestLapSeconds: bestLap,
        incidentCount: [0, 2, 4, 1, 6][nameIndex % 5],
        onPitRoad: nameIndex === 4 || nameIndex === 15,
        isPlayer,
        status: nameIndex === 11 ? "out" : (nameIndex === 4 || nameIndex === 15 ? "pit" : "running"),
        _previewChange: [2, 1, -2, 0, 3, -1, 0][nameIndex % 7],
      });

      overallPosition += 1;
      nameIndex += 1;
    }
  }

  const playerEntry = entries.find((entry) => entry.isPlayer);
  return {
    source: "mock",
    connection: {
      connected: true,
      status: "Visual editor preview",
      tickRate: 60,
      framesDropped: 0,
      simulatorWindow: {
        processRunning: false,
        windowFound: false,
        isVisible: true,
        isMinimized: false,
        isForeground: true,
      },
    },
    session: {
      sessionNumber: 2,
      state: 4,
      sessionType: "Race",
      sessionName: "IMSA Endurance",
      eventType: "Race",
      trackName: "Road Atlanta · Full Course",
      trackLengthMeters: 4088,
      timeRemainingSeconds: 1204,
      hasTimeLimit: true,
      lapsRemaining: 0,
      hasLapLimit: false,
      flags: 0,
      isReplayPlaying: false,
      isInGarage: false,
    },
    player: {
      carIndex: playerEntry.carIndex,
      name: playerEntry.driverName,
      carNumber: playerEntry.carNumber,
      position: playerEntry.position,
      classPosition: playerEntry.classPosition,
      lap: playerEntry.lap,
      lapDistancePercent: playerEntry.lapDistancePercent,
      speedMetersPerSecond: 61.4,
      fuelLiters: 34.2,
      lastLapSeconds: playerEntry.lastLapSeconds,
      bestLapSeconds: playerEntry.bestLapSeconds,
      incidentCount: playerEntry.incidentCount,
      onPitRoad: false,
      isOnTrack: true,
    },
    standings: {
      mode: "overall",
      entries,
    },
  };
}

  window.StandingsDemo = Object.freeze({ createDemoPayload });
})();
