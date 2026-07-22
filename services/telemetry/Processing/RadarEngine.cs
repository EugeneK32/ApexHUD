using ApexHUD.Telemetry.Configuration;
using ApexHUD.Telemetry.Models;
using Microsoft.Extensions.Options;

namespace ApexHUD.Telemetry.Processing;

public sealed class RadarEngine
{
    private readonly RadarOptions _options;
    private readonly Dictionary<int, ContactHistory> _history = new();

    public RadarEngine(IOptions<TelemetryOptions> options)
    {
        _options = options.Value.Radar;
    }

    public RadarState Build(RawTelemetryFrame frame, SessionMetadata metadata)
    {
        var player = ResolvePlayerIndex(frame, metadata);
        if (player < 0 || player >= frame.CarLapDistancePercent.Length)
        {
            return RadarState.Empty;
        }

        var trackLength = metadata.TrackLengthMeters > 100
            ? metadata.TrackLengthMeters
            : 5000;

        var candidates = BuildCandidates(frame, metadata, player, trackLength);
        var requirement = DecodeSpotterState(frame.CarsLeftRight);
        var assigned = AssignSides(candidates, requirement);

        if (assigned.Count == 0 && requirement.TotalCount > 0)
        {
            assigned.AddRange(CreateSyntheticContacts(requirement));
        }

        var contacts = new List<RadarContact>(assigned.Count + 1);
        foreach (var assignment in assigned)
        {
            contacts.Add(ToContact(frame.CapturedAt, assignment));
        }

        if (contacts.Count == 0)
        {
            var approaching = candidates
                .Where(candidate => candidate.LongitudinalMeters < 0)
                .OrderBy(candidate => Math.Abs(candidate.LongitudinalMeters))
                .FirstOrDefault();

            if (approaching is not null &&
                Math.Abs(approaching.LongitudinalMeters) <= _options.ApproachDistanceMeters)
            {
                contacts.Add(ToContact(
                    frame.CapturedAt,
                    approaching with { Side = "unknown", Confidence = 0.45 }));
            }
        }

        TrimHistory(frame.CapturedAt);

        return new RadarState(
            requirement.Name,
            requirement.TotalCount > 0 || contacts.Count > 0,
            contacts);
    }

    private List<Candidate> BuildCandidates(
        RawTelemetryFrame frame,
        SessionMetadata metadata,
        int player,
        double trackLength)
    {
        var result = new List<Candidate>();
        var playerPct = ValidPct(frame.CarLapDistancePercent[player])
            ? frame.CarLapDistancePercent[player]
            : frame.LapDistancePercent;
        var playerLap = frame.CarLap[player] > 0
            ? frame.CarLap[player]
            : frame.Lap;

        foreach (var driver in metadata.Drivers.Values)
        {
            var carIndex = driver.CarIndex;
            if (carIndex == player ||
                carIndex < 0 ||
                carIndex >= frame.CarLapDistancePercent.Length ||
                driver.IsPaceCar)
            {
                continue;
            }

            var otherPct = frame.CarLapDistancePercent[carIndex];
            if (!ValidPct(otherPct))
            {
                continue;
            }

            var otherLap = frame.CarLap[carIndex];
            var lapDelta = otherLap > 0 && playerLap > 0
                ? otherLap - playerLap
                : 0;

            var progressDelta = (double)lapDelta + otherPct - playerPct;
            if (lapDelta == 0)
            {
                progressDelta = WrapHalfLap(progressDelta);
            }

            var meters = progressDelta * trackLength;
            if (Math.Abs(meters) > _options.CandidateDistanceMeters)
            {
                continue;
            }

            result.Add(new Candidate(
                carIndex,
                meters,
                "unknown",
                0.35));
        }

        return result
            .OrderBy(candidate => Math.Abs(candidate.LongitudinalMeters))
            .ToList();
    }

    private List<Candidate> AssignSides(
        IReadOnlyList<Candidate> candidates,
        SideRequirement requirement)
    {
        var remaining = new List<Candidate>(candidates);
        var result = new List<Candidate>(requirement.TotalCount);

        AssignKnownSide("left", requirement.LeftCount);
        AssignKnownSide("right", requirement.RightCount);
        FillSide("left", requirement.LeftCount);
        FillSide("right", requirement.RightCount);

        return result;

        void AssignKnownSide(string side, int required)
        {
            if (required <= 0)
            {
                return;
            }

            foreach (var candidate in remaining
                         .Where(candidate =>
                             _history.TryGetValue(candidate.CarIndex, out var history) &&
                             history.Side == side)
                         .Take(required)
                         .ToArray())
            {
                result.Add(candidate with { Side = side, Confidence = 0.95 });
                remaining.Remove(candidate);
            }
        }

        void FillSide(string side, int required)
        {
            var already = result.Count(item => item.Side == side);
            while (already < required && remaining.Count > 0)
            {
                var candidate = remaining[0];
                remaining.RemoveAt(0);
                result.Add(candidate with { Side = side, Confidence = 0.82 });
                already++;
            }
        }
    }

    private IEnumerable<Candidate> CreateSyntheticContacts(SideRequirement requirement)
    {
        for (var index = 0; index < requirement.LeftCount; index++)
        {
            yield return new Candidate(-100 - index, index * -2.4, "left", 0.58);
        }

        for (var index = 0; index < requirement.RightCount; index++)
        {
            yield return new Candidate(-200 - index, index * -2.4, "right", 0.58);
        }
    }

    private RadarContact ToContact(DateTimeOffset capturedAt, Candidate candidate)
    {
        var nowTicks = capturedAt.UtcDateTime.Ticks;
        var rawDistance = candidate.LongitudinalMeters;
        var smoothed = rawDistance;
        var closingSpeed = 0d;

        if (_history.TryGetValue(candidate.CarIndex, out var previous))
        {
            smoothed =
                previous.SmoothedLongitudinal +
                (rawDistance - previous.SmoothedLongitudinal) * _options.Smoothing;

            var elapsed = TimeSpan.FromTicks(nowTicks - previous.TimestampTicks).TotalSeconds;
            if (elapsed > 0.005 && elapsed < 1)
            {
                closingSpeed =
                    (Math.Abs(previous.SmoothedLongitudinal) - Math.Abs(smoothed)) /
                    elapsed;
            }
        }

        _history[candidate.CarIndex] = new ContactHistory(
            smoothed,
            nowTicks,
            candidate.Side);

        var overlap = Math.Clamp(
            1 - Math.Abs(smoothed) / (_options.NominalCarLengthMeters * 1.35),
            0,
            1);

        if (candidate.Side != "unknown")
        {
            overlap = Math.Max(overlap, 0.28);
        }

        var threat = overlap switch
        {
            >= 0.72 => "critical",
            >= 0.35 => "warning",
            _ when closingSpeed > 8 => "fast-approach",
            _ => "nearby"
        };

        return new RadarContact(
            candidate.CarIndex,
            candidate.Side,
            Math.Round(smoothed, 2),
            Math.Round(closingSpeed, 2),
            Math.Round(overlap, 3),
            threat,
            candidate.Confidence,
            smoothed < 0 && closingSpeed > 1.5);
    }

    private void TrimHistory(DateTimeOffset current)
    {
        var minimumTicks = current.AddSeconds(-3).UtcDateTime.Ticks;
        foreach (var key in _history
                     .Where(pair => pair.Value.TimestampTicks < minimumTicks)
                     .Select(pair => pair.Key)
                     .ToArray())
        {
            _history.Remove(key);
        }
    }

    private static int ResolvePlayerIndex(
        RawTelemetryFrame frame,
        SessionMetadata metadata) =>
        frame.PlayerCarIndex >= 0
            ? frame.PlayerCarIndex
            : metadata.DriverCarIndex;

    private static bool ValidPct(float value) =>
        value >= 0 && value <= 1.1f && !float.IsNaN(value);

    private static double WrapHalfLap(double value)
    {
        if (value > 0.5)
        {
            return value - 1;
        }

        if (value < -0.5)
        {
            return value + 1;
        }

        return value;
    }

    private static SideRequirement DecodeSpotterState(int state) =>
        state switch
        {
            1 => new SideRequirement("clear", 0, 0),
            2 => new SideRequirement("car-left", 1, 0),
            3 => new SideRequirement("car-right", 0, 1),
            4 => new SideRequirement("both-sides", 1, 1),
            5 => new SideRequirement("two-left", 2, 0),
            6 => new SideRequirement("two-right", 0, 2),
            _ => new SideRequirement("off", 0, 0)
        };

    private sealed record Candidate(
        int CarIndex,
        double LongitudinalMeters,
        string Side,
        double Confidence);

    private sealed record ContactHistory(
        double SmoothedLongitudinal,
        long TimestampTicks,
        string Side);

    private sealed record SideRequirement(
        string Name,
        int LeftCount,
        int RightCount)
    {
        public int TotalCount => LeftCount + RightCount;
    }
}
