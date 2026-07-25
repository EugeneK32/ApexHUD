using ApexHUD.Telemetry.Infrastructure;
using ApexHUD.Telemetry.Models;
using IRSDKSharper;

namespace ApexHUD.Telemetry.Sources;

public sealed class IRacingTelemetrySource : IHostedService, IDisposable
{
    private readonly RawFrameChannel _channel;
    private readonly TelemetryStateStore _store;
    private readonly ILogger<IRacingTelemetrySource> _logger;
    private IRacingSdk? _sdk;
    private int _lastSessionInfoUpdate = -1;

    public IRacingTelemetrySource(
        RawFrameChannel channel,
        TelemetryStateStore store,
        ILogger<IRacingTelemetrySource> logger)
    {
        _channel = channel;
        _store = store;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            _logger.LogInformation(
                "iRacing shared memory is Windows-only. Running with mock telemetry.");
            return Task.CompletedTask;
        }

        _sdk = new IRacingSdk();
        _sdk.UpdateInterval = 1;
        _sdk.OnConnected += OnConnected;
        _sdk.OnDisconnected += OnDisconnected;
        _sdk.OnSessionInfo += OnSessionInfo;
        _sdk.OnTelemetryData += OnTelemetryData;
        _sdk.OnException += OnException;
        _sdk.Start();

        _logger.LogInformation("Waiting for iRacing shared-memory telemetry.");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _sdk?.Stop();
        return Task.CompletedTask;
    }

    private void OnConnected()
    {
        _store.MarkLiveConnected();
        PublishSessionInfo(force: true);
        _logger.LogInformation("Connected to iRacing.");
    }

    private void OnDisconnected()
    {
        Interlocked.Exchange(ref _lastSessionInfoUpdate, -1);
        _store.MarkLiveDisconnected("iRacing disconnected");
        _logger.LogInformation("iRacing disconnected.");
    }

    private void OnSessionInfo() => PublishSessionInfo(force: true);

    private void PublishSessionInfo(bool force = false)
    {
        var sdk = _sdk;
        if (sdk is null || !sdk.IsConnected)
        {
            return;
        }

        var update = sdk.Data.SessionInfoUpdate;
        if (!force && update == Volatile.Read(ref _lastSessionInfoUpdate))
        {
            return;
        }

        var yaml = sdk.Data.SessionInfoYaml;
        if (string.IsNullOrWhiteSpace(yaml))
        {
            return;
        }

        Interlocked.Exchange(ref _lastSessionInfoUpdate, update);
        _channel.TryWriteSessionInfo(yaml);
    }

    private void OnTelemetryData()
    {
        var sdk = _sdk;
        if (sdk is null || !sdk.IsConnected)
        {
            return;
        }

        try
        {
            // Practice sessions can add/remove drivers without changing the local car.
            // Polling SessionInfoUpdate makes the standings robust even if an SDK event
            // was missed while the renderer or service was starting.
            PublishSessionInfo();

            var frame = new RawTelemetryFrame
            {
                CapturedAt = DateTimeOffset.UtcNow,
                TickRate = sdk.Data.TickRate,
                FramesDropped = sdk.Data.FramesDropped,
                PlayerCarIndex = GetInt(sdk, "PlayerCarIdx", -1),
                SessionNumber = GetInt(sdk, "SessionNum", -1),
                SessionState = GetInt(sdk, "SessionState"),
                SessionTime = GetDouble(sdk, "SessionTime"),
                SessionTimeOfDay = GetNullableFloat(sdk, "SessionTimeOfDay"),
                SessionTimeRemaining = GetDouble(sdk, "SessionTimeRemain"),
                SessionLapsRemaining = GetInt(sdk, "SessionLapsRemainEx"),
                SessionFlags = GetBitField(sdk, "SessionFlags"),
                IsReplayPlaying = GetBool(sdk, "IsReplayPlaying"),
                IsInGarage = GetBool(sdk, "IsInGarage"),
                IsOnTrack = GetBool(sdk, "IsOnTrack"),
                IsOnTrackCar = GetBool(sdk, "IsOnTrackCar"),

                Speed = GetFloat(sdk, "Speed"),
                Gear = GetInt(sdk, "Gear"),
                Rpm = GetFloat(sdk, "RPM"),
                Throttle = GetFloat(sdk, "Throttle"),
                ThrottleRaw = GetNullableFloat(sdk, "ThrottleRaw"),
                Brake = GetFloat(sdk, "Brake"),
                BrakeRaw = GetNullableFloat(sdk, "BrakeRaw"),
                Clutch = GetFloat(sdk, "Clutch"),
                Handbrake = GetNullableFloat(sdk, "HandBrake"),
                HandbrakeRaw = GetNullableFloat(sdk, "HandBrakeRaw"),
                SteeringWheelAngle = GetFloat(sdk, "SteeringWheelAngle"),
                SteeringWheelAngleMax = GetNullableFloat(sdk, "SteeringWheelAngleMax"),
                ShiftIndicatorPercent = GetNullableFloat(sdk, "ShiftIndicatorPct"),
                ShiftPowerPercent = GetNullableFloat(sdk, "ShiftPowerPct"),
                FuelLevel = GetFloat(sdk, "FuelLevel"),
                FuelUsePerHour = GetFloat(sdk, "FuelUsePerHour"),
                OnPitRoad = GetBool(sdk, "OnPitRoad"),
                PlayerTrackSurface = GetInt(sdk, "PlayerTrackSurface"),
                PlayerTrackSurfaceMaterial = GetInt(sdk, "PlayerTrackSurfaceMaterial"),
                PlayerIncidentCount = GetInt(sdk, "PlayerCarMyIncidentCount",
                    GetInt(sdk, "PlayerCarDriverIncidentCount")),

                AbsActive = GetNullableBool(sdk, "BrakeABSactive"),
                AbsCutPercent = GetNullableFloat(sdk, "BrakeABSCutPct"),
                TractionControlEnabled = GetNullableBool(sdk, "dcTractionControlToggle"),
                TractionControlLevel = GetNullableFloat(sdk, "dcTractionControl"),
                TractionControlLevel2 = GetNullableFloat(sdk, "dcTractionControl2"),
                BrakeBiasPercent = GetNullableFloat(sdk, "dcBrakeBias"),
                PitLimiterToggle = GetNullableBool(sdk, "dcPitSpeedLimiterToggle"),
                EngineWarnings = GetNullableBitField(sdk, "EngineWarnings"),

                PitsOpen = GetNullableBool(sdk, "PitsOpen"),
                PlayerInPitStall = GetNullableBool(sdk, "PlayerCarInPitStall"),
                PitstopActive = GetNullableBool(sdk, "PitstopActive"),
                PlayerPitServiceStatus = GetNullableInt(sdk, "PlayerCarPitSvStatus"),
                PlayerTowTime = GetNullableFloat(sdk, "PlayerCarTowTime"),
                PitRepairLeft = GetNullableFloat(sdk, "PitRepairLeft"),
                PitOptionalRepairLeft = GetNullableFloat(sdk, "PitOptRepairLeft"),
                FastRepairsUsed = GetNullableInt(sdk, "FastRepairUsed") ??
                    GetNullableInt(sdk, "PlayerFastRepairsUsed"),
                FastRepairsAvailable = GetNullableInt(sdk, "FastRepairAvailable"),
                PitServiceFlags = GetNullableBitField(sdk, "PitSvFlags"),
                PitServiceFuel = GetNullableFloat(sdk, "PitSvFuel"),
                PitServiceLeftFrontPressure = GetNullableFloat(sdk, "PitSvLFP"),
                PitServiceRightFrontPressure = GetNullableFloat(sdk, "PitSvRFP"),
                PitServiceLeftRearPressure = GetNullableFloat(sdk, "PitSvLRP"),
                PitServiceRightRearPressure = GetNullableFloat(sdk, "PitSvRRP"),
                PitServiceTireCompound = GetNullableInt(sdk, "PitSvTireCompound"),

                AirTemperature = GetNullableFloat(sdk, "AirTemp"),
                TrackTemperature = GetNullableFloat(sdk, "TrackTempCrew") ??
                    GetNullableFloat(sdk, "TrackTemp"),
                TrackWetness = GetNullableInt(sdk, "TrackWetness"),
                WeatherDeclaredWet = GetNullableBool(sdk, "WeatherDeclaredWet"),
                Precipitation = GetNullableFloat(sdk, "Precipitation"),
                RelativeHumidity = GetNullableFloat(sdk, "RelativeHumidity"),
                WindSpeed = GetNullableFloat(sdk, "WindVel"),
                WindDirection = GetNullableFloat(sdk, "WindDir"),
                FogLevel = GetNullableFloat(sdk, "FogLevel"),
                Skies = GetNullableInt(sdk, "Skies"),

                VelocityX = GetNullableFloat(sdk, "VelocityX"),
                VelocityY = GetNullableFloat(sdk, "VelocityY"),
                VelocityZ = GetNullableFloat(sdk, "VelocityZ"),
                LateralAcceleration = GetNullableFloat(sdk, "LatAccel"),
                LongitudinalAcceleration = GetNullableFloat(sdk, "LongAccel"),
                VerticalAcceleration = GetNullableFloat(sdk, "VertAccel"),
                Yaw = GetNullableFloat(sdk, "Yaw"),
                YawRate = GetNullableFloat(sdk, "YawRate"),
                Pitch = GetNullableFloat(sdk, "Pitch"),
                PitchRate = GetNullableFloat(sdk, "PitchRate"),
                Roll = GetNullableFloat(sdk, "Roll"),
                RollRate = GetNullableFloat(sdk, "RollRate"),
                SteeringWheelTorque = GetNullableFloat(sdk, "SteeringWheelTorque"),

                Lap = GetInt(sdk, "Lap"),
                LapCompleted = GetInt(sdk, "LapCompleted"),
                LapDistancePercent = GetFloat(sdk, "LapDistPct"),
                CurrentLapTime = GetFloat(sdk, "LapCurrentLapTime"),
                LastLapTime = GetFloat(sdk, "LapLastLapTime"),
                BestLapTime = GetFloat(sdk, "LapBestLapTime"),
                DeltaToBestLap = GetFloat(sdk, "LapDeltaToBestLap"),
                DeltaToBestLapValid = GetBool(sdk, "LapDeltaToBestLap_OK"),
                DeltaToOptimalLap = GetNullableFloat(sdk, "LapDeltaToOptimalLap"),
                DeltaToOptimalLapValid = GetBool(sdk, "LapDeltaToOptimalLap_OK"),
                DeltaToSessionBestLap = GetNullableFloat(sdk, "LapDeltaToSessionBestLap"),
                DeltaToSessionBestLapValid = GetBool(sdk, "LapDeltaToSessionBestLap_OK"),
                DeltaToSessionOptimalLap = GetNullableFloat(sdk, "LapDeltaToSessionOptimalLap"),
                DeltaToSessionOptimalLapValid = GetBool(sdk, "LapDeltaToSessionOptimalLap_OK"),
                DeltaToLastLap = GetNullableFloat(sdk, "LapDeltaToSessionLastlLap"),
                DeltaToLastLapValid = GetBool(sdk, "LapDeltaToSessionLastlLap_OK"),
                CarsLeftRight = GetInt(sdk, "CarLeftRight",
                    GetInt(sdk, "CarsLeftRight")),

                CarLapDistancePercent = GetFloatArray(sdk, "CarIdxLapDistPct"),
                CarLap = GetIntArray(sdk, "CarIdxLap"),
                CarLapCompleted = GetIntArray(sdk, "CarIdxLapCompleted"),
                CarPosition = GetIntArray(sdk, "CarIdxPosition"),
                CarClassPosition = GetIntArray(sdk, "CarIdxClassPosition"),
                CarF2Time = GetFloatArray(sdk, "CarIdxF2Time"),
                CarLastLapTime = GetFloatArray(sdk, "CarIdxLastLapTime"),
                CarBestLapTime = GetFloatArray(sdk, "CarIdxBestLapTime"),
                CarEstimatedTime = GetFloatArray(sdk, "CarIdxEstTime"),
                CarOnPitRoad = GetBoolArray(sdk, "CarIdxOnPitRoad"),
                CarTrackSurface = GetIntArray(sdk, "CarIdxTrackSurface")
            };

            _channel.TryWriteFrame(frame);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Failed to copy an iRacing telemetry frame.");
        }
    }

    private void OnException(Exception exception)
    {
        _logger.LogError(exception, "IRSDKSharper background task failed.");
        _store.MarkLiveDisconnected("Telemetry reader failed");
    }

    private static bool Has(IRacingSdk sdk, string name) =>
        sdk.Data.TelemetryDataProperties.ContainsKey(name);

    private static int GetInt(IRacingSdk sdk, string name, int fallback = 0) =>
        Has(sdk, name) ? sdk.Data.GetInt(name) : fallback;

    private static uint GetBitField(IRacingSdk sdk, string name, uint fallback = 0) =>
        Has(sdk, name) ? sdk.Data.GetBitField(name) : fallback;

    private static float GetFloat(IRacingSdk sdk, string name, float fallback = 0) =>
        Has(sdk, name) ? sdk.Data.GetFloat(name) : fallback;

    private static bool GetBool(IRacingSdk sdk, string name, bool fallback = false) =>
        Has(sdk, name) ? sdk.Data.GetBool(name) : fallback;

    private static double GetDouble(IRacingSdk sdk, string name, double fallback = 0) =>
        Has(sdk, name) ? sdk.Data.GetDouble(name) : fallback;

    private static int? GetNullableInt(IRacingSdk sdk, string name) =>
        Has(sdk, name) ? sdk.Data.GetInt(name) : null;

    private static uint? GetNullableBitField(IRacingSdk sdk, string name) =>
        Has(sdk, name) ? sdk.Data.GetBitField(name) : null;

    private static float? GetNullableFloat(IRacingSdk sdk, string name) =>
        Has(sdk, name) ? sdk.Data.GetFloat(name) : null;

    private static bool? GetNullableBool(IRacingSdk sdk, string name) =>
        Has(sdk, name) ? sdk.Data.GetBool(name) : null;

    private static double? GetNullableDouble(IRacingSdk sdk, string name) =>
        Has(sdk, name) ? sdk.Data.GetDouble(name) : null;

    private static int[] GetIntArray(IRacingSdk sdk, string name)
    {
        var result = new int[ProtocolConstants.MaximumCars];
        if (Has(sdk, name))
        {
            sdk.Data.GetIntArray(name, result, 0, result.Length);
        }

        return result;
    }

    private static float[] GetFloatArray(IRacingSdk sdk, string name)
    {
        var result = Enumerable.Repeat(-1f, ProtocolConstants.MaximumCars).ToArray();
        if (Has(sdk, name))
        {
            sdk.Data.GetFloatArray(name, result, 0, result.Length);
        }

        return result;
    }

    private static bool[] GetBoolArray(IRacingSdk sdk, string name)
    {
        var result = new bool[ProtocolConstants.MaximumCars];
        if (Has(sdk, name))
        {
            sdk.Data.GetBoolArray(name, result, 0, result.Length);
        }

        return result;
    }

    public void Dispose()
    {
        if (_sdk is null)
        {
            return;
        }

        _sdk.OnConnected -= OnConnected;
        _sdk.OnDisconnected -= OnDisconnected;
        _sdk.OnSessionInfo -= OnSessionInfo;
        _sdk.OnTelemetryData -= OnTelemetryData;
        _sdk.OnException -= OnException;
        _sdk.Stop();
    }
}
