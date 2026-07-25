(() => {
  "use strict";

  const drivers = [
    [8, 1, 1, "12", "Bessie Cooper", 101, "GT3", 2400, "A 3.20", "running"],
    [14, 2, 2, "77", "Wade Warren", 205, "LMP2", 2600, "A 1.80", "running"],
    [4, 3, 3, "19", "Cam Williamson", 101, "GT3", 2200, "B 3.40", "running"],
    [22, 4, 4, "04", "Istvan Fodor", 305, "GTP", 2800, "A 2.80", "running"],
    [31, 5, 5, "51", "Eleanor Pena", 205, "LMP2", 1900, "B 4.20", "running"],
    [6, 6, 6, "88", "Theresa Webb", 101, "GT3", 1600, "A 2.20", "pit"],
    [17, 7, 7, "63", "Robert Fox", 305, "GTP", 2100, "A 4.60", "running"],
    [9, 8, 8, "28", "Jane Cooper", 101, "GT3", 3400, "A 3.70", "running"],
    [27, 9, 9, "41", "Guy Hawkins", 205, "LMP2", 2300, "B 2.90", "running"],
    [43, 10, 10, "72", "Marta Silva", 101, "GT3", 2950, "A 3.10", "running"],
    [44, 11, 11, "73", "Kenji Sato", 305, "GTP", 3100, "A 2.60", "running"],
    [45, 12, 12, "74", "Lucas Meyer", 205, "LMP2", 2550, "B 3.80", "running"],
    [46, 13, 13, "75", "Sofia Rossi", 101, "GT3", 2700, "A 4.10", "running"],
    [47, 14, 14, "76", "Daniel Novak", 305, "GTP", 2850, "A 2.90", "running"],
    [48, 15, 15, "78", "Emma Wilson", 205, "LMP2", 2450, "B 4.00", "running"],
    [49, 16, 16, "79", "Noah Martin", 101, "GT3", 2250, "A 3.50", "running"],
    [50, 17, 17, "80", "Olivia Brown", 305, "GTP", 3200, "A 4.30", "running"],
    [51, 18, 18, "81", "Mateo Garcia", 205, "LMP2", 2050, "B 3.30", "running"],
    [52, 19, 19, "82", "Hannah Lee", 101, "GT3", 2650, "A 2.70", "running"],
    [53, 20, 20, "83", "Felix Wagner", 305, "GTP", 2750, "A 3.90", "running"],
    [54, 21, 21, "84", "Amelia Clark", 205, "LMP2", 2350, "B 2.80", "running"],
    [55, 22, 22, "85", "Leo Dubois", 101, "GT3", 2500, "A 3.60", "running"],
    [56, 23, 23, "86", "Nora Andersen", 305, "GTP", 2900, "A 4.00", "running"],
    [57, 24, 24, "87", "Victor Stone", 205, "LMP2", 2150, "B 3.00", "out"],
    [58, 25, 25, "89", "Alice Johnson", 101, "GT3", 2800, "A 3.80", "running"]
  ];

  function standing(tuple) {
    const [carIndex, position, classPosition, carNumber, driverName, carClassId, carClassName, iRating, license, status] = tuple;
    return {
      carIndex,
      position,
      classPosition,
      carNumber,
      driverName,
      teamName: `${driverName} Racing`,
      carClassId,
      carClassName,
      iRating,
      license,
      lap: 12,
      lapDistancePercent: Math.max(0, 0.72 - position * 0.008),
      gapToLeaderSeconds: Math.max(0, (position - 1) * 1.55),
      intervalSeconds: position === 1 ? 0 : 0.8 + position * 0.17,
      lastLapSeconds: 110.1 + position * 0.23,
      bestLapSeconds: 109.7 + position * 0.17,
      incidentCount: position % 4,
      onPitRoad: status === "pit",
      isPlayer: carIndex === 22,
      status,
    };
  }

  function relative(carIndex, relation, distanceMeters, estimatedGapSeconds) {
    const source = drivers.find((item) => item[0] === carIndex);
    return {
      carIndex,
      carNumber: source[3],
      driverName: source[4],
      carClassName: source[6],
      position: source[1],
      relation,
      distanceMeters,
      estimatedGapSeconds,
      onPitRoad: source[9] === "pit",
      isPlayer: false,
    };
  }

  function createDemoPayload() {
    const standings = drivers.map(standing);
    return {
      source: "mock",
      session: {
        sessionNumber: 0,
        state: 4,
        sessionType: "Race",
        sessionName: "IMSA Endurance",
        eventType: "Race",
        trackName: "Watkins Glen International",
        trackLengthMeters: 5423,
        sessionTimeSeconds: 1212,
        timeOfDaySeconds: 54420,
        timeRemainingSeconds: 1488,
        hasTimeLimit: true,
        lapsRemaining: 14,
        hasLapLimit: true,
        flags: 0,
        isReplayPlaying: false,
        isInGarage: false,
      },
      player: {
        carIndex: 22,
        name: "Istvan Fodor",
        carNumber: "04",
        teamName: "Apex Racing",
        carClassId: 305,
        carClassName: "GTP",
        iRating: 2800,
        license: "A 2.80",
        position: 4,
        classPosition: 4,
        lap: 12,
        lapDistancePercent: 0.634,
        speedMetersPerSecond: 61.2,
        fuelLiters: 42.6,
        lastLapSeconds: 111.275,
        bestLapSeconds: 110.685,
        incidentCount: 1,
        onPitRoad: false,
        isOnTrack: true,
      },
      environment: {
        dataAvailable: true,
        airTemperatureCelsius: 21.6,
        trackTemperatureCelsius: 27.2,
        trackWetness: 0,
        weatherDeclaredWet: false,
        precipitationPercent: 0,
        relativeHumidityPercent: 48,
        windSpeedMetersPerSecond: 2.4,
        windDirectionRadians: 1.3,
        fogLevelPercent: 0,
        skies: 1,
      },
      relative: {
        entries: [
          relative(8, "ahead", 386.2, 6.2),
          relative(14, "ahead", 244.8, 4.0),
          relative(4, "ahead", 131.7, 2.2),
          relative(31, "behind", -151.4, 2.6),
          relative(6, "behind", -329.1, 12.8),
          relative(17, "behind", -612.8, 24.6),
          relative(9, "behind", -887.3, 31.2),
        ],
      },
      standings: {
        mode: "overall",
        entries: standings,
      },
    };
  }

  window.RelativeDemo = Object.freeze({ createDemoPayload });
})();
