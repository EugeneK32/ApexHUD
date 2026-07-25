namespace ApexHUD.Telemetry.Models;

public sealed record TelemetrySnapshot(
    int ProtocolVersion,
    long Sequence,
    DateTimeOffset Timestamp,
    string Source,
    ConnectionState Connection,
    SessionState Session,
    PlayerState Player,
    VehicleState Vehicle,
    DriverAidsState DriverAids,
    PitState Pit,
    EnvironmentState Environment,
    MotionState Motion,
    TimingState Timing,
    FuelState Fuel,
    RadarState Radar,
    RelativeState Relative,
    StandingsState Standings)
{
    public static TelemetrySnapshot Empty { get; } = new(
        Infrastructure.ProtocolConstants.Version,
        0,
        DateTimeOffset.UtcNow,
        "none",
        new ConnectionState(false, "Waiting for telemetry", 0, 0, SimulatorWindowState.Empty),
        SessionState.Empty,
        PlayerState.Empty,
        VehicleState.Empty,
        DriverAidsState.Empty,
        PitState.Empty,
        EnvironmentState.Empty,
        MotionState.Empty,
        TimingState.Empty,
        FuelState.Empty,
        RadarState.Empty,
        RelativeState.Empty,
        StandingsState.Empty);
}

public sealed record ConnectionState(
    bool Connected,
    string Status,
    int TickRate,
    int FramesDropped,
    SimulatorWindowState SimulatorWindow);

public sealed record SimulatorWindowState(
    bool ProcessRunning,
    bool WindowFound,
    bool IsVisible,
    bool IsMinimized,
    bool IsForeground)
{
    public static SimulatorWindowState Empty { get; } =
        new(false, false, false, false, false);
}

public sealed record SessionState(
    int SessionNumber,
    int State,
    string SessionType,
    string SessionName,
    string EventType,
    string TrackName,
    double TrackLengthMeters,
    double SessionTimeSeconds,
    double? TimeOfDaySeconds,
    double TimeRemainingSeconds,
    bool HasTimeLimit,
    int LapsRemaining,
    bool HasLapLimit,
    uint Flags,
    bool IsReplayPlaying,
    bool IsInGarage)
{
    public static SessionState Empty { get; } =
        new(-1, 0, "Unknown", "Unknown", "Unknown", "No active session", 0, 0, null, 0, false, 0, false, 0, false, false);
}

public sealed record PlayerState(
    int CarIndex,
    string Name,
    string CarNumber,
    string TeamName,
    int CarClassId,
    string CarClassName,
    int IRating,
    string License,
    int Position,
    int ClassPosition,
    int Lap,
    double LapDistancePercent,
    double SpeedMetersPerSecond,
    double FuelLiters,
    double LastLapSeconds,
    double BestLapSeconds,
    int IncidentCount,
    bool OnPitRoad,
    bool IsOnTrack)
{
    public static PlayerState Empty { get; } =
        new(-1, "Player", "--", string.Empty, 0, "Class", 0, string.Empty, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false);
}

public sealed record VehicleState(
    double SpeedMetersPerSecond,
    int Gear,
    double Rpm,
    double ShiftLightFirstRpm,
    double ShiftRpm,
    double ShiftLightLastRpm,
    double ShiftLightBlinkRpm,
    double Throttle,
    double? ThrottleRaw,
    double Brake,
    double? BrakeRaw,
    double Clutch,
    double? Handbrake,
    double? HandbrakeRaw,
    double SteeringWheelAngleRadians,
    double? SteeringWheelAngleMaxRadians,
    double? ShiftIndicatorPercent,
    double? ShiftPowerPercent,
    bool OnPitRoad,
    int TrackSurface,
    int TrackSurfaceMaterial)
{
    public static VehicleState Empty { get; } = new(
        SpeedMetersPerSecond: 0,
        Gear: 0,
        Rpm: 0,
        ShiftLightFirstRpm: 0,
        ShiftRpm: 0,
        ShiftLightLastRpm: 0,
        ShiftLightBlinkRpm: 0,
        Throttle: 0,
        ThrottleRaw: null,
        Brake: 0,
        BrakeRaw: null,
        Clutch: 0,
        Handbrake: null,
        HandbrakeRaw: null,
        SteeringWheelAngleRadians: 0,
        SteeringWheelAngleMaxRadians: null,
        ShiftIndicatorPercent: null,
        ShiftPowerPercent: null,
        OnPitRoad: false,
        TrackSurface: 0,
        TrackSurfaceMaterial: 0);
}

public sealed record DriverAidsState(
    bool AbsAvailable,
    bool AbsActive,
    double? AbsCutPercent,
    bool TractionControlAvailable,
    bool TractionControlEnabled,
    double? TractionControlLevel,
    double? TractionControlLevel2,
    bool BrakeBiasAvailable,
    double? BrakeBiasPercent,
    bool PitLimiterAvailable,
    bool PitLimiterActive,
    bool RevLimiterActive,
    bool EngineWarningsAvailable,
    uint EngineWarnings,
    bool WaterTemperatureWarning,
    bool FuelPressureWarning,
    bool OilPressureWarning,
    bool OilTemperatureWarning,
    bool EngineStalled)
{
    public static DriverAidsState Empty { get; } =
        new(false, false, null, false, false, null, null, false, null, false, false, false, false, 0, false, false, false, false, false);
}

public sealed record PitState(
    bool DataAvailable,
    bool? PitsOpen,
    bool InPitStall,
    bool PitstopActive,
    int? ServiceStatus,
    double? TowSeconds,
    double? MandatoryRepairSeconds,
    double? OptionalRepairSeconds,
    int? FastRepairsUsed,
    int? FastRepairsAvailable,
    uint? ServiceFlags,
    double? FuelToAddLiters,
    double? LeftFrontPressureKpa,
    double? RightFrontPressureKpa,
    double? LeftRearPressureKpa,
    double? RightRearPressureKpa,
    int? TireCompound)
{
    public static PitState Empty { get; } =
        new(false, null, false, false, null, null, null, null, null, null, null, null, null, null, null, null, null);
}

public sealed record EnvironmentState(
    bool DataAvailable,
    double? AirTemperatureCelsius,
    double? TrackTemperatureCelsius,
    int? TrackWetness,
    bool? WeatherDeclaredWet,
    double? PrecipitationPercent,
    double? RelativeHumidityPercent,
    double? WindSpeedMetersPerSecond,
    double? WindDirectionRadians,
    double? FogLevelPercent,
    int? Skies)
{
    public static EnvironmentState Empty { get; } =
        new(false, null, null, null, null, null, null, null, null, null, null);
}

public sealed record MotionState(
    bool DataAvailable,
    double? VelocityXMetersPerSecond,
    double? VelocityYMetersPerSecond,
    double? VelocityZMetersPerSecond,
    double? LateralAccelerationMetersPerSecondSquared,
    double? LongitudinalAccelerationMetersPerSecondSquared,
    double? VerticalAccelerationMetersPerSecondSquared,
    double? YawRadians,
    double? YawRateRadiansPerSecond,
    double? PitchRadians,
    double? PitchRateRadiansPerSecond,
    double? RollRadians,
    double? RollRateRadiansPerSecond,
    double? SteeringWheelTorqueNm)
{
    public static MotionState Empty { get; } =
        new(false, null, null, null, null, null, null, null, null, null, null, null, null, null);
}

public sealed record TimingState(
    int CurrentLap,
    int CompletedLaps,
    double CurrentLapSeconds,
    double LastLapSeconds,
    double BestLapSeconds,
    double DeltaToBestSeconds,
    bool DeltaAvailable,
    double DeltaToOptimalLapSeconds,
    bool DeltaToOptimalLapAvailable,
    double DeltaToSessionBestLapSeconds,
    bool DeltaToSessionBestLapAvailable,
    double DeltaToSessionOptimalLapSeconds,
    bool DeltaToSessionOptimalLapAvailable,
    double DeltaToLastLapSeconds,
    bool DeltaToLastLapAvailable,
    bool CurrentLapValid,
    string Validity)
{
    public static TimingState Empty { get; } =
        new(0, 0, 0, 0, 0, 0, false, 0, false, 0, false, 0, false, 0, false, false, "unavailable");
}

public sealed record FuelState(
    double LevelLiters,
    double UsePerHourLiters,
    double EstimatedPerLapLiters,
    double EstimatedLapsRemaining,
    double RequiredToFinishLiters,
    double AddToFinishLiters,
    int Samples,
    bool EstimateReady)
{
    public static FuelState Empty { get; } =
        new(0, 0, 0, 0, 0, 0, 0, false);
}

public sealed record RadarState(
    string SpotterState,
    bool Active,
    IReadOnlyList<RadarContact> Contacts)
{
    public static RadarState Empty { get; } =
        new("off", false, Array.Empty<RadarContact>());
}

public sealed record RadarContact(
    int CarIndex,
    string Side,
    double LongitudinalMeters,
    double ClosingSpeedMetersPerSecond,
    double Overlap,
    string Threat,
    double Confidence,
    bool IsApproaching);

public sealed record RelativeState(IReadOnlyList<RelativeEntry> Entries)
{
    public static RelativeState Empty { get; } =
        new(Array.Empty<RelativeEntry>());
}

public sealed record RelativeEntry(
    int CarIndex,
    string CarNumber,
    string DriverName,
    string CarClassName,
    int Position,
    string Relation,
    double DistanceMeters,
    double EstimatedGapSeconds,
    bool OnPitRoad,
    bool IsPlayer);

public sealed record StandingsState(
    string Mode,
    IReadOnlyList<StandingEntry> Entries)
{
    public static StandingsState Empty { get; } =
        new("overall", Array.Empty<StandingEntry>());
}

public sealed record StandingEntry(
    int CarIndex,
    int Position,
    int ClassPosition,
    string CarNumber,
    string DriverName,
    string TeamName,
    int CarClassId,
    string CarClassName,
    int IRating,
    string License,
    int Lap,
    double LapDistancePercent,
    double GapToLeaderSeconds,
    double IntervalSeconds,
    double LastLapSeconds,
    double BestLapSeconds,
    int IncidentCount,
    bool OnPitRoad,
    bool IsPlayer,
    string Status);
