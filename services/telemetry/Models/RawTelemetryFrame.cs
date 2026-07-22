namespace ApexHUD.Telemetry.Models;

public sealed record RawTelemetryFrame
{
    public DateTimeOffset CapturedAt { get; init; } = DateTimeOffset.UtcNow;
    public int TickRate { get; init; }
    public int FramesDropped { get; init; }
    public int PlayerCarIndex { get; init; } = -1;
    public int SessionNumber { get; init; } = -1;
    public int SessionState { get; init; }
    public double SessionTime { get; init; }
    public double? SessionTimeOfDay { get; init; }
    public double SessionTimeRemaining { get; init; }
    public int SessionLapsRemaining { get; init; }
    public uint SessionFlags { get; init; }
    public bool IsReplayPlaying { get; init; }
    public bool IsInGarage { get; init; }
    public bool IsOnTrack { get; init; }
    public bool IsOnTrackCar { get; init; }

    public float Speed { get; init; }
    public int Gear { get; init; }
    public float Rpm { get; init; }
    public float Throttle { get; init; }
    public float? ThrottleRaw { get; init; }
    public float Brake { get; init; }
    public float? BrakeRaw { get; init; }
    public float Clutch { get; init; }
    public float? Handbrake { get; init; }
    public float? HandbrakeRaw { get; init; }
    public float SteeringWheelAngle { get; init; }
    public float? SteeringWheelAngleMax { get; init; }
    public float? ShiftIndicatorPercent { get; init; }
    public float? ShiftPowerPercent { get; init; }
    public float FuelLevel { get; init; }
    public float FuelUsePerHour { get; init; }
    public bool OnPitRoad { get; init; }
    public int PlayerTrackSurface { get; init; }
    public int PlayerTrackSurfaceMaterial { get; init; }
    public int PlayerIncidentCount { get; init; }

    public bool? AbsActive { get; init; }
    public float? AbsCutPercent { get; init; }
    public bool? TractionControlEnabled { get; init; }
    public float? TractionControlLevel { get; init; }
    public float? TractionControlLevel2 { get; init; }
    public float? BrakeBiasPercent { get; init; }
    public bool? PitLimiterToggle { get; init; }
    public uint? EngineWarnings { get; init; }

    public bool? PitsOpen { get; init; }
    public bool? PlayerInPitStall { get; init; }
    public bool? PitstopActive { get; init; }
    public int? PlayerPitServiceStatus { get; init; }
    public float? PlayerTowTime { get; init; }
    public float? PitRepairLeft { get; init; }
    public float? PitOptionalRepairLeft { get; init; }
    public int? FastRepairsUsed { get; init; }
    public int? FastRepairsAvailable { get; init; }
    public uint? PitServiceFlags { get; init; }
    public float? PitServiceFuel { get; init; }
    public float? PitServiceLeftFrontPressure { get; init; }
    public float? PitServiceRightFrontPressure { get; init; }
    public float? PitServiceLeftRearPressure { get; init; }
    public float? PitServiceRightRearPressure { get; init; }
    public int? PitServiceTireCompound { get; init; }

    public float? AirTemperature { get; init; }
    public float? TrackTemperature { get; init; }
    public int? TrackWetness { get; init; }
    public bool? WeatherDeclaredWet { get; init; }
    public float? Precipitation { get; init; }
    public float? RelativeHumidity { get; init; }
    public float? WindSpeed { get; init; }
    public float? WindDirection { get; init; }
    public float? FogLevel { get; init; }
    public int? Skies { get; init; }

    public float? VelocityX { get; init; }
    public float? VelocityY { get; init; }
    public float? VelocityZ { get; init; }
    public float? LateralAcceleration { get; init; }
    public float? LongitudinalAcceleration { get; init; }
    public float? VerticalAcceleration { get; init; }
    public float? Yaw { get; init; }
    public float? YawRate { get; init; }
    public float? Pitch { get; init; }
    public float? PitchRate { get; init; }
    public float? Roll { get; init; }
    public float? RollRate { get; init; }
    public float? SteeringWheelTorque { get; init; }

    public int Lap { get; init; }
    public int LapCompleted { get; init; }
    public float LapDistancePercent { get; init; }
    public float CurrentLapTime { get; init; }
    public float LastLapTime { get; init; }
    public float BestLapTime { get; init; }
    public float DeltaToBestLap { get; init; }
    public bool DeltaToBestLapValid { get; init; }
    public float? DeltaToOptimalLap { get; init; }
    public bool DeltaToOptimalLapValid { get; init; }
    public float? DeltaToSessionBestLap { get; init; }
    public bool DeltaToSessionBestLapValid { get; init; }
    public float? DeltaToSessionOptimalLap { get; init; }
    public bool DeltaToSessionOptimalLapValid { get; init; }
    public float? DeltaToLastLap { get; init; }
    public bool DeltaToLastLapValid { get; init; }
    public int CarsLeftRight { get; init; }

    public float[] CarLapDistancePercent { get; init; } = new float[Infrastructure.ProtocolConstants.MaximumCars];
    public int[] CarLap { get; init; } = new int[Infrastructure.ProtocolConstants.MaximumCars];
    public int[] CarLapCompleted { get; init; } = new int[Infrastructure.ProtocolConstants.MaximumCars];
    public int[] CarPosition { get; init; } = new int[Infrastructure.ProtocolConstants.MaximumCars];
    public int[] CarClassPosition { get; init; } = new int[Infrastructure.ProtocolConstants.MaximumCars];
    public float[] CarF2Time { get; init; } = new float[Infrastructure.ProtocolConstants.MaximumCars];
    public float[] CarLastLapTime { get; init; } = new float[Infrastructure.ProtocolConstants.MaximumCars];
    public float[] CarBestLapTime { get; init; } = new float[Infrastructure.ProtocolConstants.MaximumCars];
    public float[] CarEstimatedTime { get; init; } = new float[Infrastructure.ProtocolConstants.MaximumCars];
    public bool[] CarOnPitRoad { get; init; } = new bool[Infrastructure.ProtocolConstants.MaximumCars];
    public int[] CarTrackSurface { get; init; } = new int[Infrastructure.ProtocolConstants.MaximumCars];
}
