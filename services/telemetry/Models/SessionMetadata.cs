namespace ApexHUD.Telemetry.Models;

public sealed record SessionMetadata(
    int DriverCarIndex,
    string TrackName,
    double TrackLengthMeters,
    double PlayerShiftLightFirstRpm,
    double PlayerShiftRpm,
    double PlayerShiftLightLastRpm,
    double PlayerShiftLightBlinkRpm,
    string EventType,
    IReadOnlyDictionary<int, DriverMetadata> Drivers,
    IReadOnlyDictionary<int, SessionDescriptor> Sessions)
{
    public static SessionMetadata Empty { get; } =
        new(-1, "Unknown track", 0, 0, 0, 0, 0, "Unknown",
            new Dictionary<int, DriverMetadata>(),
            new Dictionary<int, SessionDescriptor>());
}

public sealed record SessionDescriptor(
    int SessionNumber,
    string SessionType,
    string SessionName,
    IReadOnlyDictionary<int, SessionResultMetadata> ResultsPositions);

public sealed record SessionResultMetadata(
    int CarIndex,
    int Position,
    int ClassPosition,
    int LapsComplete,
    int LapsDriven,
    double LastTime,
    double FastestTime,
    int Incidents,
    int ReasonOutId,
    string ReasonOut);

public sealed record DriverMetadata(
    int CarIndex,
    string UserName,
    string TeamName,
    string CarNumber,
    int CarClassId,
    string CarClassName,
    int IRating,
    string License,
    bool IsPaceCar,
    bool IsSpectator);
