using ApexHUD.Telemetry.Configuration;
using ApexHUD.Telemetry.Infrastructure;
using ApexHUD.Telemetry.Models;
using Microsoft.Extensions.Options;

namespace ApexHUD.Telemetry.Sources;

public sealed class MockTelemetrySource : BackgroundService
{
    private static readonly string[] Names =
    [
        "Alex Morgan", "Mika Virtanen", "Sofia Ricci", "Jonas Berg",
        "Luca Moretti", "Noah Williams", "Emil Novak", "Hugo Laurent",
        "Theo Martin", "Mateo Silva", "Elias Becker", "Oscar Lind",
        "Niko Saarinen", "Leo Fischer", "Arthur Dubois", "Max Jensen",
        "Daniel Costa", "Felix Wagner", "Milan Horvat", "Rafael Ramos",
        "Oliver King", "Anton Petrov", "Sam Taylor", "Victor Olsen"
    ];

    private readonly TelemetryStateStore _store;
    private readonly TelemetryOptions _options;
    private readonly DateTimeOffset _started = DateTimeOffset.UtcNow;

    public MockTelemetrySource(
        TelemetryStateStore store,
        IOptions<TelemetryOptions> options)
    {
        _store = store;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(
            TimeSpan.FromMilliseconds(1000d / _options.BroadcastHz));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (!_options.MockWhenDisconnected ||
                DateTimeOffset.UtcNow - _started <
                TimeSpan.FromSeconds(_options.MockDelaySeconds) ||
                _store.IsLiveFresh(TimeSpan.FromSeconds(1)))
            {
                continue;
            }

            var time = (DateTimeOffset.UtcNow - _started).TotalSeconds;
            _store.PublishMock(BuildSnapshot(time));
        }
    }

    private static TelemetrySnapshot BuildSnapshot(double time)
    {
        const int playerIndex = 7;
        var entries = new List<StandingEntry>(Names.Length);

        for (var index = 0; index < Names.Length; index++)
        {
            var gap = index == 0
                ? 0
                : index * 1.37 + Math.Sin(time * 0.21 + index) * 0.32;
            var lastLap = 89.4 + index * 0.08 + Math.Sin(time * 0.13 + index) * 0.45;
            var bestLap = lastLap - 0.5 - (index % 5) * 0.06;

            entries.Add(new StandingEntry(
                index,
                index + 1,
                index + 1,
                (17 + index * 7).ToString(),
                Names[index],
                index % 4 == 0 ? "Apex Vector Racing" : string.Empty,
                index < 14 ? 101 : 202,
                index < 14 ? "GT3" : "GT4",
                1450 + ((Names.Length - index) * 73),
                (index % 5) switch
                {
                    0 => "A 3.42",
                    1 => "B 2.88",
                    2 => "A 4.11",
                    3 => "C 3.05",
                    _ => "B 3.71"
                },
                18,
                (0.72 - index * 0.004 + time * 0.0008) % 1,
                Math.Max(0, gap),
                index == 0 ? 0 : 1.2 + (index % 4) * 0.19,
                lastLap,
                bestLap,
                index == playerIndex ? 2 : 0,
                index == 12,
                index == playerIndex,
                index == 12 ? "pit" : "running"));
        }

        var phase = time % 18;
        var contacts = new List<RadarContact>();
        var spotter = "clear";

        if (phase is > 2 and < 8)
        {
            var longitudinal = -8 + (phase - 2) * 1.8;
            contacts.Add(new RadarContact(
                8, "right", longitudinal, 6.3,
                Math.Clamp(1 - Math.Abs(longitudinal) / 7, 0.28, 1),
                longitudinal > -2 ? "critical" : "warning",
                0.96, true));
            spotter = "car-right";
        }
        else if (phase is >= 8 and < 12)
        {
            contacts.Add(new RadarContact(
                8, "right", 0.8, 0.2, 0.92,
                "critical", 0.98, false));
            contacts.Add(new RadarContact(
                6, "left", -1.5, 1.1, 0.76,
                "critical", 0.91, true));
            spotter = "both-sides";
        }
        else if (phase is >= 12 and < 15)
        {
            contacts.Add(new RadarContact(
                6, "left", 1.4 + (phase - 12) * 2, -1.2, 0.55,
                "warning", 0.94, false));
            spotter = "car-left";
        }

        var playerProgress = entries[playerIndex].LapDistancePercent;
        var relatives = entries
            .Where(entry => entry.CarIndex != playerIndex)
            .Select(entry =>
            {
                var delta = entry.LapDistancePercent - playerProgress;
                delta -= Math.Round(delta);
                var distance = delta * 7004;
                return new RelativeEntry(
                    entry.CarIndex,
                    entry.CarNumber,
                    entry.DriverName,
                    entry.CarClassName,
                    entry.Position,
                    distance >= 0 ? "ahead" : "behind",
                    Math.Round(distance, 1),
                    Math.Round(Math.Abs(distance) / 61.4, 2),
                    entry.OnPitRoad,
                    false);
            })
            .Where(entry => Math.Abs(entry.DistanceMeters) < 350)
            .OrderBy(entry => Math.Abs(entry.DistanceMeters))
            .Take(12)
            .ToArray();

        var deltaToBest = Math.Sin(time * 0.7) * 0.42;
        var lapValid = phase < 13;
        var rpm = 4100 + (Math.Sin(time * 3.2) + 1) * 2100;
        var gear = 2 + (int)(time / 2 % 5);

        return new TelemetrySnapshot(
            ProtocolConstants.Version,
            0,
            DateTimeOffset.UtcNow,
            "mock",
            new ConnectionState(
                false,
                "Demo telemetry — start iRacing for live data",
                60,
                0,
                new SimulatorWindowState(false, false, false, false, false)),
            new SessionState(
                0,
                4,
                "Race",
                "Race",
                "Race",
                "Spa-Francorchamps",
                7004,
                time,
                43200 + time,
                Math.Max(0, 2460 - time),
                true,
                23,
                true,
                4,
                false,
                false),
            new PlayerState(
                playerIndex,
                Names[playerIndex],
                entries[playerIndex].CarNumber,
                "Apex Vector Racing",
                101,
                "GT3",
                2410,
                "A 3.42",
                entries[playerIndex].Position,
                entries[playerIndex].ClassPosition,
                18,
                entries[playerIndex].LapDistancePercent,
                61.4,
                42.8,
                entries[playerIndex].LastLapSeconds,
                entries[playerIndex].BestLapSeconds,
                3,
                false,
                true),
            new VehicleState(
                61.4,
                gear,
                rpm,
                5200,
                6500,
                6900,
                7200,
                Math.Clamp(0.7 + Math.Sin(time * 2.1) * 0.3, 0, 1),
                Math.Clamp(0.72 + Math.Sin(time * 2.1) * 0.28, 0, 1),
                Math.Clamp(Math.Sin(time * 1.7 - 2) * 0.8, 0, 1),
                Math.Clamp(Math.Sin(time * 1.7 - 2) * 0.82, 0, 1),
                0,
                0,
                0,
                Math.Sin(time * 1.2) * 0.24,
                7.85,
                Math.Clamp((rpm - 5000) / 2300, 0, 1),
                Math.Clamp((rpm - 5800) / 1500, 0, 1),
                false,
                3,
                2),
            new DriverAidsState(
                true,
                phase is > 6 and < 7,
                phase is > 6 and < 7 ? 0.38 : 0,
                true,
                true,
                5,
                2,
                true,
                53.4,
                true,
                phase is > 15 and < 17,
                rpm > 7150,
                true,
                rpm > 7150 ? 0x20u : 0u,
                false,
                false,
                false,
                false,
                false),
            new PitState(
                true,
                true,
                false,
                false,
                0,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                145,
                145,
                142,
                142,
                0),
            new EnvironmentState(
                true,
                23.4,
                31.8,
                1,
                false,
                0,
                47,
                2.4,
                1.2,
                0,
                1),
            new MotionState(
                true,
                2.1,
                61.3,
                0,
                Math.Sin(time * 0.8) * 8.4,
                Math.Cos(time * 0.6) * 3.2,
                9.81,
                Math.Sin(time * 0.12),
                Math.Sin(time * 0.8) * 0.4,
                0.01,
                0.02,
                0.03,
                0.04,
                Math.Sin(time * 1.4) * 4.5),
            new TimingState(
                18,
                17,
                43.2 + time % 40,
                entries[playerIndex].LastLapSeconds,
                entries[playerIndex].BestLapSeconds,
                lapValid ? deltaToBest : 0,
                lapValid,
                lapValid ? deltaToBest - 0.18 : 0,
                lapValid,
                lapValid ? deltaToBest + 0.08 : 0,
                lapValid,
                lapValid ? deltaToBest - 0.31 : 0,
                lapValid,
                lapValid ? deltaToBest + 0.12 : 0,
                lapValid,
                lapValid,
                lapValid ? "valid" : "invalid"),
            new FuelState(
                42.8,
                112.4,
                2.71,
                15.79,
                62.37,
                19.57,
                5,
                true),
            new RadarState(spotter, contacts.Count > 0, contacts),
            new RelativeState(relatives),
            new StandingsState("overall", entries));
    }
}
