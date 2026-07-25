using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Processing;

public sealed class StandingsEngine
{
    private static readonly TimeSpan PositionConfirmation = TimeSpan.FromMilliseconds(350);
    private readonly Dictionary<int, StablePosition> _overallPositions = new();
    private readonly Dictionary<int, StablePosition> _classPositions = new();
    private int _positionSessionNumber = int.MinValue;
    public StandingsState Build(
        RawTelemetryFrame frame,
        SessionMetadata metadata,
        int playerCarIndex)
    {
        var descriptor = metadata.Sessions.GetValueOrDefault(frame.SessionNumber);
        var sessionType = descriptor?.SessionType ?? "Session";
        var isTimeRanking = IsTimeRanking(sessionType);
        var results = descriptor?.ResultsPositions ??
            (IReadOnlyDictionary<int, SessionResultMetadata>)new Dictionary<int, SessionResultMetadata>();

        if (_positionSessionNumber != frame.SessionNumber)
        {
            _positionSessionNumber = frame.SessionNumber;
            _overallPositions.Clear();
            _classPositions.Clear();
        }

        var entries = new List<StandingEntry>();
        foreach (var carIndex in CandidateCarIndices(frame, metadata, results, playerCarIndex))
        {
            metadata.Drivers.TryGetValue(carIndex, out var driver);
            results.TryGetValue(carIndex, out var result);

            if (driver?.IsPaceCar == true ||
                driver?.IsSpectator == true ||
                !IsValidCarIndex(frame, carIndex))
            {
                continue;
            }

            var isPlayer = carIndex == playerCarIndex;
            var hasLiveEvidence = HasLiveEvidence(frame, carIndex, isPlayer);
            var hasSessionResult = result is not null &&
                                   (result.LapsDriven > 0 ||
                                    result.LapsComplete > 0 ||
                                    result.FastestTime > 0 ||
                                    result.LastTime > 0);

            // DriverInfo can contain spectators, heat participants and stale roster
            // entries. A race table must only contain cars that have actually appeared
            // in the current session (or the player itself).
            if (!isTimeRanking && !isPlayer && !hasLiveEvidence && !hasSessionResult)
            {
                continue;
            }

            var telemetryLap = Math.Max(frame.CarLap[carIndex], frame.CarLapCompleted[carIndex]);
            var lap = Math.Max(telemetryLap, result?.LapsComplete ?? 0);
            var pct = frame.CarLapDistancePercent[carIndex];
            var lapDistance = pct < 0 || !float.IsFinite(pct) ? 0 : Math.Clamp(pct, 0, 1);
            var onPitRoad = frame.CarOnPitRoad[carIndex];
            var trackSurface = frame.CarTrackSurface[carIndex];
            var reasonOut = result?.ReasonOut ?? string.Empty;
            var status = BuildStatus(onPitRoad, lapDistance, trackSurface, reasonOut);

            var rawPosition = PositivePosition(frame.CarPosition[carIndex], result?.Position ?? 0);
            var rawClassPosition = PositivePosition(frame.CarClassPosition[carIndex], result?.ClassPosition ?? 0);
            var position = isTimeRanking
                ? rawPosition
                : StabilizePosition(_overallPositions, carIndex, rawPosition, frame.CapturedAt);
            var classPosition = isTimeRanking
                ? rawClassPosition
                : StabilizePosition(_classPositions, carIndex, rawClassPosition, frame.CapturedAt);

            entries.Add(new StandingEntry(
                carIndex,
                position,
                classPosition,
                driver?.CarNumber ?? carIndex.ToString(),
                driver?.UserName ?? $"Car {carIndex}",
                driver?.TeamName ?? string.Empty,
                driver?.CarClassId ?? 0,
                driver?.CarClassName ?? "Class",
                driver?.IRating ?? 0,
                driver?.License ?? string.Empty,
                lap,
                lapDistance,
                SafeTime(frame.CarF2Time[carIndex]),
                0,
                SafeTime(frame.CarLastLapTime[carIndex], result?.LastTime ?? 0),
                SafeTime(frame.CarBestLapTime[carIndex], result?.FastestTime ?? 0),
                isPlayer
                    ? Math.Max(0, frame.PlayerIncidentCount)
                    : Math.Max(0, result?.Incidents ?? 0),
                onPitRoad,
                isPlayer,
                status));
        }

        entries = isTimeRanking
            ? entries
                .OrderBy(entry => entry.BestLapSeconds <= 0 ? double.MaxValue : entry.BestLapSeconds)
                .ThenByDescending(Progress)
                .ThenBy(entry => entry.Position <= 0 ? int.MaxValue : entry.Position)
                .ToList()
            : entries
                // iRacing already publishes the authoritative live race order.
                // Lap counters and LapDistPct do not update atomically around the
                // start/finish line, so sorting solely by calculated progress can
                // briefly move a driver several places even though no pass happened.
                .OrderBy(entry => entry.Position <= 0 ? int.MaxValue : entry.Position)
                .ThenByDescending(Progress)
                .ToList();

        if (entries.Count == 0)
        {
            return StandingsState.Empty;
        }

        var leaderBest = entries.FirstOrDefault(entry => entry.BestLapSeconds > 0)?.BestLapSeconds ?? 0;
        var classCounters = new Dictionary<int, int>();
        var previousComputedGap = 0d;

        for (var index = 0; index < entries.Count; index++)
        {
            var current = entries[index];
            var nextClassPosition = classCounters.GetValueOrDefault(current.CarClassId) + 1;
            classCounters[current.CarClassId] = nextClassPosition;

            var gap = isTimeRanking && leaderBest > 0 && current.BestLapSeconds > 0
                ? Math.Max(0, current.BestLapSeconds - leaderBest)
                : current.GapToLeaderSeconds;
            var interval = index == 0 ? 0 : PositiveDifference(gap, previousComputedGap);
            previousComputedGap = gap;

            entries[index] = current with
            {
                // Compact the ranking after stale/non-participating roster entries
                // are removed. This prevents a disconnected zero-lap car from
                // leaving the real P2 displayed as P3.
                Position = index + 1,
                ClassPosition = nextClassPosition,
                GapToLeaderSeconds = Math.Round(gap, 3),
                IntervalSeconds = interval
            };
        }

        return new StandingsState("overall", entries);
    }

    private static int StabilizePosition(
        Dictionary<int, StablePosition> positions,
        int carIndex,
        int candidate,
        DateTimeOffset capturedAt)
    {
        if (!positions.TryGetValue(carIndex, out var slot))
        {
            slot = new StablePosition(candidate, candidate, capturedAt);
            positions[carIndex] = slot;
            return candidate;
        }

        if (candidate <= 0)
        {
            return slot.Value;
        }

        if (candidate == slot.Value)
        {
            slot.Pending = candidate;
            slot.PendingSince = capturedAt;
            return slot.Value;
        }

        if (candidate != slot.Pending)
        {
            slot.Pending = candidate;
            slot.PendingSince = capturedAt;
            return slot.Value;
        }

        if (capturedAt - slot.PendingSince >= PositionConfirmation)
        {
            slot.Value = candidate;
            slot.PendingSince = capturedAt;
        }

        return slot.Value;
    }

    private sealed class StablePosition(
        int value,
        int pending,
        DateTimeOffset pendingSince)
    {
        public int Value { get; set; } = value;
        public int Pending { get; set; } = pending;
        public DateTimeOffset PendingSince { get; set; } = pendingSince;
    }

    private static bool IsTimeRanking(string sessionType) =>
        sessionType.Contains("practice", StringComparison.OrdinalIgnoreCase) ||
        sessionType.Contains("qual", StringComparison.OrdinalIgnoreCase) ||
        sessionType.Contains("time", StringComparison.OrdinalIgnoreCase);

    private static IEnumerable<int> CandidateCarIndices(
        RawTelemetryFrame frame,
        SessionMetadata metadata,
        IReadOnlyDictionary<int, SessionResultMetadata> results,
        int playerCarIndex)
    {
        var indices = new HashSet<int>(results.Keys);
        if (playerCarIndex >= 0)
        {
            indices.Add(playerCarIndex);
        }

        for (var index = 0; index < frame.CarLapDistancePercent.Length; index++)
        {
            if (HasLiveEvidence(frame, index, index == playerCarIndex))
            {
                indices.Add(index);
            }
        }

        // Metadata is useful for practice/qualifying before a driver has crossed
        // the timing line, but it is never sufficient by itself in a running race.
        foreach (var pair in metadata.Drivers)
        {
            if (!pair.Value.IsPaceCar && !pair.Value.IsSpectator &&
                pair.Key >= 0 && pair.Key < frame.CarPosition.Length &&
                (frame.CarPosition[pair.Key] > 0 || frame.CarClassPosition[pair.Key] > 0))
            {
                indices.Add(pair.Key);
            }
        }

        return indices;
    }

    private static bool HasLiveEvidence(RawTelemetryFrame frame, int carIndex, bool isPlayer)
    {
        if (!IsValidCarIndex(frame, carIndex))
        {
            return false;
        }

        return isPlayer ||
               frame.CarLapDistancePercent[carIndex] >= 0 ||
               frame.CarLap[carIndex] > 0 ||
               frame.CarLapCompleted[carIndex] > 0 ||
               frame.CarBestLapTime[carIndex] > 0 ||
               frame.CarLastLapTime[carIndex] > 0 ||
               frame.CarOnPitRoad[carIndex];
    }

    private static bool IsValidCarIndex(RawTelemetryFrame frame, int carIndex) =>
        carIndex >= 0 &&
        carIndex < frame.CarPosition.Length &&
        carIndex < frame.CarClassPosition.Length &&
        carIndex < frame.CarLapDistancePercent.Length;

    private static int PositivePosition(int livePosition, int resultPosition) =>
        livePosition > 0 ? livePosition : Math.Max(0, resultPosition);

    private static string BuildStatus(
        bool onPitRoad,
        double lapDistance,
        int trackSurface,
        string reasonOut)
    {
        if (onPitRoad)
        {
            return "pit";
        }

        if (!string.IsNullOrWhiteSpace(reasonOut) &&
            !reasonOut.Equals("Running", StringComparison.OrdinalIgnoreCase) &&
            !reasonOut.Equals("None", StringComparison.OrdinalIgnoreCase))
        {
            return "out";
        }

        return lapDistance <= 0 && trackSurface < 0 ? "out" : "running";
    }

    private static double Progress(StandingEntry entry) =>
        entry.Lap + Math.Clamp(entry.LapDistancePercent, 0, 1);

    private static double SafeTime(float value, double fallback = 0) =>
        float.IsFinite(value) && value > 0
            ? Math.Round(value, 3)
            : double.IsFinite(fallback) && fallback > 0
                ? Math.Round(fallback, 3)
                : 0;

    private static double PositiveDifference(double current, double previous)
    {
        if (current <= 0 || previous < 0)
        {
            return 0;
        }

        return Math.Round(Math.Max(0, current - previous), 3);
    }
}
