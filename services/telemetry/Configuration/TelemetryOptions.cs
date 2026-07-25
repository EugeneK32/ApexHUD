using System.ComponentModel.DataAnnotations;

namespace ApexHUD.Telemetry.Configuration;

public sealed class TelemetryOptions
{
    public const string SectionName = "Telemetry";

    [Required]
    public string Url { get; init; } = "http://127.0.0.1:47931";

    [Range(10, 60)]
    public int BroadcastHz { get; init; } = 30;

    public bool MockWhenDisconnected { get; init; } = true;

    [Range(0, 30)]
    public int MockDelaySeconds { get; init; } = 2;

    public RadarOptions Radar { get; init; } = new();
}

public sealed class RadarOptions
{
    [Range(10, 100)]
    public double CandidateDistanceMeters { get; init; } = 35;

    [Range(5, 50)]
    public double ApproachDistanceMeters { get; init; } = 18;

    [Range(3, 8)]
    public double NominalCarLengthMeters { get; init; } = 5.1;

    [Range(0.01, 1)]
    public double Smoothing { get; init; } = 0.28;
}
