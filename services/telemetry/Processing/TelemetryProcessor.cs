using ApexHUD.Telemetry.Infrastructure;
using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Processing;

public sealed class TelemetryProcessor : BackgroundService
{
    private readonly RawFrameChannel _channel;
    private readonly SessionInfoStore _sessionInfo;
    private readonly TelemetryStateStore _state;
    private readonly RadarEngine _radar;
    private readonly RelativeEngine _relative;
    private readonly StandingsEngine _standings;
    private readonly FuelEngine _fuel;
    private readonly LapValidityEngine _lapValidity;
    private readonly SimulatorWindowMonitor _windowMonitor;
    private readonly ILogger<TelemetryProcessor> _logger;

    public TelemetryProcessor(
        RawFrameChannel channel,
        SessionInfoStore sessionInfo,
        TelemetryStateStore state,
        RadarEngine radar,
        RelativeEngine relative,
        StandingsEngine standings,
        FuelEngine fuel,
        LapValidityEngine lapValidity,
        SimulatorWindowMonitor windowMonitor,
        ILogger<TelemetryProcessor> logger)
    {
        _channel = channel;
        _sessionInfo = sessionInfo;
        _state = state;
        _radar = radar;
        _relative = relative;
        _standings = standings;
        _fuel = fuel;
        _lapValidity = lapValidity;
        _windowMonitor = windowMonitor;
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(
            ProcessSessionInfo(stoppingToken),
            ProcessFrames(stoppingToken));

    private async Task ProcessSessionInfo(CancellationToken token)
    {
        await foreach (var yaml in _channel.SessionInfo.ReadAllAsync(token))
        {
            try
            {
                var parsed = SessionYamlParser.Parse(yaml);
                _sessionInfo.Update(parsed);
                _logger.LogInformation(
                    "Session metadata updated: {Track}, {Drivers} drivers.",
                    parsed.TrackName,
                    parsed.Drivers.Count);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Could not parse iRacing session YAML.");
            }
        }
    }

    private async Task ProcessFrames(CancellationToken token)
    {
        await foreach (var frame in _channel.Frames.ReadAllAsync(token))
        {
            var metadata = _sessionInfo.Current;
            var playerIndex = frame.PlayerCarIndex >= 0
                ? frame.PlayerCarIndex
                : metadata.DriverCarIndex;

            metadata.Drivers.TryGetValue(playerIndex, out var playerDriver);
            var player = BuildPlayer(frame, playerIndex, playerDriver);
            var standings = _standings.Build(frame, metadata, playerIndex);
            player = ReconcilePlayerPosition(player, standings);
            var timing = BuildTiming(frame, _lapValidity.Build(frame, playerIndex));

            var window = _windowMonitor.Current;
            var session = metadata.Sessions.GetValueOrDefault(frame.SessionNumber);
            var rawLapsRemaining = frame.SessionLapsRemaining;
            var hasLapLimit = rawLapsRemaining is > 0 and < 32767;
            var rawTimeRemaining = frame.SessionTimeRemaining;
            var hasTimeLimit = double.IsFinite(rawTimeRemaining) &&
                               rawTimeRemaining > 0 &&
                               rawTimeRemaining < 604799;

            var snapshot = new TelemetrySnapshot(
                ProtocolConstants.Version,
                0,
                frame.CapturedAt,
                "iracing",
                new ConnectionState(
                    true,
                    metadata.Drivers.Count > 0
                        ? $"Live iRacing telemetry · {metadata.Drivers.Count} drivers"
                        : "Live iRacing telemetry · waiting for session roster",
                    frame.TickRate,
                    frame.FramesDropped,
                    new SimulatorWindowState(
                        window.ProcessRunning,
                        window.WindowFound,
                        window.IsVisible,
                        window.IsMinimized,
                        window.IsForeground)),
                new SessionState(
                    frame.SessionNumber,
                    frame.SessionState,
                    session?.SessionType ?? "Session",
                    session?.SessionName ?? session?.SessionType ?? "Session",
                    metadata.EventType,
                    metadata.TrackName,
                    metadata.TrackLengthMeters,
                    Math.Max(0, frame.SessionTime),
                    Finite(frame.SessionTimeOfDay),
                    hasTimeLimit ? rawTimeRemaining : 0,
                    hasTimeLimit,
                    hasLapLimit ? rawLapsRemaining : 0,
                    hasLapLimit,
                    frame.SessionFlags,
                    frame.IsReplayPlaying,
                    frame.IsInGarage),
                player,
                new VehicleState(
                    frame.Speed,
                    frame.Gear,
                    frame.Rpm,
                    metadata.PlayerShiftLightFirstRpm,
                    metadata.PlayerShiftRpm,
                    metadata.PlayerShiftLightLastRpm,
                    metadata.PlayerShiftLightBlinkRpm,
                    ClampInput(frame.Throttle),
                    ClampNullableInput(frame.ThrottleRaw),
                    ClampInput(frame.Brake),
                    ClampNullableInput(frame.BrakeRaw),
                    ClampInput(frame.Clutch),
                    ClampNullableInput(frame.Handbrake),
                    ClampNullableInput(frame.HandbrakeRaw),
                    frame.SteeringWheelAngle,
                    Finite(frame.SteeringWheelAngleMax),
                    ClampNullableInput(frame.ShiftIndicatorPercent),
                    ClampNullableInput(frame.ShiftPowerPercent),
                    frame.OnPitRoad,
                    frame.PlayerTrackSurface,
                    frame.PlayerTrackSurfaceMaterial),
                BuildDriverAids(frame),
                BuildPit(frame),
                BuildEnvironment(frame),
                BuildMotion(frame),
                timing,
                _fuel.Build(frame, playerIndex),
                _radar.Build(frame, metadata),
                _relative.Build(frame, metadata, playerIndex),
                standings);

            _state.PublishLive(snapshot);
        }
    }

    private static DriverAidsState BuildDriverAids(RawTelemetryFrame frame)
    {
        const uint waterTemperatureWarning = 0x0001;
        const uint fuelPressureWarning = 0x0002;
        const uint oilPressureWarning = 0x0004;
        const uint engineStalled = 0x0008;
        const uint pitSpeedLimiter = 0x0010;
        const uint revLimiterActive = 0x0020;
        const uint oilTemperatureWarning = 0x0040;

        var warnings = frame.EngineWarnings ?? 0;
        var warningDataAvailable = frame.EngineWarnings.HasValue;
        var pitLimiterAvailable = frame.PitLimiterToggle.HasValue ||
                                  warningDataAvailable && (warnings & pitSpeedLimiter) != 0;
        var pitLimiterActive = frame.PitLimiterToggle == true ||
                               warningDataAvailable && (warnings & pitSpeedLimiter) != 0;

        return new DriverAidsState(
            frame.AbsActive.HasValue || frame.AbsCutPercent.HasValue,
            frame.AbsActive == true,
            ClampNullableInput(frame.AbsCutPercent),
            frame.TractionControlEnabled.HasValue ||
                frame.TractionControlLevel.HasValue ||
                frame.TractionControlLevel2.HasValue,
            frame.TractionControlEnabled == true,
            Finite(frame.TractionControlLevel),
            Finite(frame.TractionControlLevel2),
            frame.BrakeBiasPercent.HasValue,
            Finite(frame.BrakeBiasPercent),
            pitLimiterAvailable,
            pitLimiterActive,
            warningDataAvailable && (warnings & revLimiterActive) != 0,
            warningDataAvailable,
            warnings,
            warningDataAvailable && (warnings & waterTemperatureWarning) != 0,
            warningDataAvailable && (warnings & fuelPressureWarning) != 0,
            warningDataAvailable && (warnings & oilPressureWarning) != 0,
            warningDataAvailable && (warnings & oilTemperatureWarning) != 0,
            warningDataAvailable && (warnings & engineStalled) != 0);
    }

    private static PitState BuildPit(RawTelemetryFrame frame)
    {
        var available = frame.PitsOpen.HasValue ||
                        frame.PlayerInPitStall.HasValue ||
                        frame.PitstopActive.HasValue ||
                        frame.PlayerPitServiceStatus.HasValue ||
                        frame.PitRepairLeft.HasValue ||
                        frame.PitOptionalRepairLeft.HasValue ||
                        frame.PitServiceFlags.HasValue;

        return new PitState(
            available,
            frame.PitsOpen,
            frame.PlayerInPitStall == true,
            frame.PitstopActive == true,
            frame.PlayerPitServiceStatus,
            PositiveOrZero(frame.PlayerTowTime),
            PositiveOrZero(frame.PitRepairLeft),
            PositiveOrZero(frame.PitOptionalRepairLeft),
            frame.FastRepairsUsed,
            frame.FastRepairsAvailable,
            frame.PitServiceFlags,
            PositiveOrZero(frame.PitServiceFuel),
            PositiveOrZero(frame.PitServiceLeftFrontPressure),
            PositiveOrZero(frame.PitServiceRightFrontPressure),
            PositiveOrZero(frame.PitServiceLeftRearPressure),
            PositiveOrZero(frame.PitServiceRightRearPressure),
            frame.PitServiceTireCompound);
    }

    private static EnvironmentState BuildEnvironment(RawTelemetryFrame frame)
    {
        var available = frame.AirTemperature.HasValue ||
                        frame.TrackTemperature.HasValue ||
                        frame.TrackWetness.HasValue ||
                        frame.WeatherDeclaredWet.HasValue;

        return new EnvironmentState(
            available,
            Finite(frame.AirTemperature),
            Finite(frame.TrackTemperature),
            frame.TrackWetness,
            frame.WeatherDeclaredWet,
            Finite(frame.Precipitation),
            Finite(frame.RelativeHumidity),
            Finite(frame.WindSpeed),
            Finite(frame.WindDirection),
            Finite(frame.FogLevel),
            frame.Skies);
    }

    private static MotionState BuildMotion(RawTelemetryFrame frame)
    {
        var available = frame.VelocityX.HasValue ||
                        frame.VelocityY.HasValue ||
                        frame.LateralAcceleration.HasValue ||
                        frame.LongitudinalAcceleration.HasValue;

        return new MotionState(
            available,
            Finite(frame.VelocityX),
            Finite(frame.VelocityY),
            Finite(frame.VelocityZ),
            Finite(frame.LateralAcceleration),
            Finite(frame.LongitudinalAcceleration),
            Finite(frame.VerticalAcceleration),
            Finite(frame.Yaw),
            Finite(frame.YawRate),
            Finite(frame.Pitch),
            Finite(frame.PitchRate),
            Finite(frame.Roll),
            Finite(frame.RollRate),
            Finite(frame.SteeringWheelTorque));
    }

    private static PlayerState ReconcilePlayerPosition(
        PlayerState player,
        StandingsState standings)
    {
        var entry = standings.Entries.FirstOrDefault(candidate =>
            candidate.IsPlayer || candidate.CarIndex == player.CarIndex);
        if (entry is null)
        {
            return player;
        }

        return player with
        {
            Position = entry.Position > 0 ? entry.Position : player.Position,
            ClassPosition = entry.ClassPosition > 0 ? entry.ClassPosition : player.ClassPosition
        };
    }

    private static TimingState BuildTiming(
        RawTelemetryFrame frame,
        LapValidityResult lapValidity)
    {
        var best = Positive(frame.BestLapTime);
        var current = Positive(frame.CurrentLapTime);
        var hasReference = best > 0;
        var deltaAvailable = hasReference &&
                             frame.DeltaToBestLapValid &&
                             float.IsFinite(frame.DeltaToBestLap);
        var validity = lapValidity.Available
            ? lapValidity.IsValid ? "valid" : "invalid"
            : "unavailable";

        var optimal = ValidDelta(frame.DeltaToOptimalLap, frame.DeltaToOptimalLapValid);
        var sessionBest = ValidDelta(frame.DeltaToSessionBestLap, frame.DeltaToSessionBestLapValid);
        var sessionOptimal = ValidDelta(frame.DeltaToSessionOptimalLap, frame.DeltaToSessionOptimalLapValid);
        var lastLap = ValidDelta(frame.DeltaToLastLap, frame.DeltaToLastLapValid);

        return new TimingState(
            Math.Max(0, frame.Lap),
            Math.Max(0, frame.LapCompleted),
            current,
            Positive(frame.LastLapTime),
            best,
            deltaAvailable ? Math.Round(frame.DeltaToBestLap, 4) : 0,
            deltaAvailable,
            optimal.Value,
            optimal.Available,
            sessionBest.Value,
            sessionBest.Available,
            sessionOptimal.Value,
            sessionOptimal.Available,
            lastLap.Value,
            lastLap.Available,
            validity == "valid",
            validity);
    }

    private static PlayerState BuildPlayer(
        RawTelemetryFrame frame,
        int playerIndex,
        DriverMetadata? metadata)
    {
        var validIndex = playerIndex >= 0 &&
                         playerIndex < frame.CarPosition.Length;

        return new PlayerState(
            playerIndex,
            metadata?.UserName ?? "Player",
            metadata?.CarNumber ?? "--",
            metadata?.TeamName ?? string.Empty,
            metadata?.CarClassId ?? 0,
            metadata?.CarClassName ?? "Class",
            metadata?.IRating ?? 0,
            metadata?.License ?? string.Empty,
            validIndex ? frame.CarPosition[playerIndex] : 0,
            validIndex ? frame.CarClassPosition[playerIndex] : 0,
            frame.Lap,
            Math.Clamp(frame.LapDistancePercent, 0, 1),
            frame.Speed,
            frame.FuelLevel,
            Positive(frame.LastLapTime),
            Positive(frame.BestLapTime),
            Math.Max(0, frame.PlayerIncidentCount),
            (validIndex && frame.CarOnPitRoad[playerIndex]) || frame.OnPitRoad,
            frame.IsOnTrack || frame.IsOnTrackCar);
    }

    private static (double Value, bool Available) ValidDelta(float? value, bool valid)
    {
        var finite = Finite(value);
        return valid && finite.HasValue
            ? (Math.Round(finite.Value, 4), true)
            : (0, false);
    }

    private static double ClampInput(float value) =>
        float.IsFinite(value) ? Math.Clamp(value, 0, 1) : 0;

    private static double? ClampNullableInput(float? value) =>
        value is { } current && float.IsFinite(current)
            ? Math.Clamp(current, 0, 1)
            : null;

    private static double Positive(float value) =>
        float.IsFinite(value) && value > 0
            ? value
            : 0;

    private static double? PositiveOrZero(float? value) =>
        value is { } current && float.IsFinite(current) && current >= 0
            ? current
            : null;

    private static double? Finite(float? value) =>
        value is { } current && float.IsFinite(current)
            ? current
            : null;

    private static double? Finite(double? value) =>
        value is { } current && double.IsFinite(current)
            ? current
            : null;
}
