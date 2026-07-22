using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Processing;

public sealed class RelativeEngine
{
    public RelativeState Build(
        RawTelemetryFrame frame,
        SessionMetadata metadata,
        int playerCarIndex)
    {
        if (playerCarIndex < 0 ||
            playerCarIndex >= frame.CarLapDistancePercent.Length ||
            metadata.TrackLengthMeters <= 0)
        {
            return RelativeState.Empty;
        }

        var playerPct = frame.CarLapDistancePercent[playerCarIndex];
        if (!float.IsFinite(playerPct) || playerPct < 0)
        {
            playerPct = frame.LapDistancePercent;
        }
        if (!float.IsFinite(playerPct) || playerPct < 0)
        {
            return RelativeState.Empty;
        }

        var candidates = ActiveCarIndices(frame, metadata, playerCarIndex);
        var entries = new List<RelativeEntry>();
        var speed = Math.Max(10, frame.Speed);

        foreach (var carIndex in candidates)
        {
            if (carIndex == playerCarIndex)
            {
                continue;
            }

            var pct = frame.CarLapDistancePercent[carIndex];
            if (!float.IsFinite(pct) || pct < 0)
            {
                continue;
            }

            var delta = (double)pct - playerPct;
            delta -= Math.Round(delta);
            var distance = delta * metadata.TrackLengthMeters;
            if (Math.Abs(distance) > 350)
            {
                continue;
            }

            metadata.Drivers.TryGetValue(carIndex, out var driver);
            entries.Add(new RelativeEntry(
                carIndex,
                driver?.CarNumber ?? carIndex.ToString(),
                driver?.UserName ?? $"Car {carIndex}",
                driver?.CarClassName ?? "Class",
                Safe(frame.CarPosition, carIndex),
                distance >= 0 ? "ahead" : "behind",
                Math.Round(distance, 1),
                Math.Round(Math.Abs(distance) / speed, 2),
                Safe(frame.CarOnPitRoad, carIndex),
                false));
        }

        return new RelativeState(entries
            .OrderBy(entry => Math.Abs(entry.DistanceMeters))
            .Take(12)
            .ToArray());
    }

    private static IEnumerable<int> ActiveCarIndices(
        RawTelemetryFrame frame,
        SessionMetadata metadata,
        int playerCarIndex)
    {
        var indices = new HashSet<int>(metadata.Drivers.Keys);
        for (var index = 0; index < frame.CarLapDistancePercent.Length; index++)
        {
            if (index == playerCarIndex ||
                frame.CarLapDistancePercent[index] >= 0 ||
                frame.CarPosition[index] > 0 ||
                frame.CarBestLapTime[index] > 0)
            {
                indices.Add(index);
            }
        }
        return indices;
    }

    private static int Safe(int[] values, int index) =>
        index >= 0 && index < values.Length ? values[index] : 0;

    private static bool Safe(bool[] values, int index) =>
        index >= 0 && index < values.Length && values[index];
}
