using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Processing;

/// <summary>
/// iRacing does not expose a dedicated "current lap is clean" flag.
/// Track the player's session incident counter from the start of each lap and
/// combine it with the SDK delta-valid flag. This catches the normal off-track,
/// contact and loss-of-control invalidations without pretending to have more
/// information than the SDK provides.
/// </summary>
public sealed class LapValidityEngine
{
    private int _sessionNumber = int.MinValue;
    private int _playerCarIndex = -1;
    private int _lap = -1;
    private int _incidentBaseline;
    private bool _invalid;

    public LapValidityResult Build(RawTelemetryFrame frame, int playerCarIndex)
    {
        if (_sessionNumber != frame.SessionNumber ||
            _playerCarIndex != playerCarIndex)
        {
            Reset(frame, playerCarIndex);
        }

        if (frame.Lap != _lap)
        {
            _lap = frame.Lap;
            _incidentBaseline = Math.Max(0, frame.PlayerIncidentCount);
            _invalid = false;
        }

        if (frame.PlayerIncidentCount > _incidentBaseline)
        {
            _invalid = true;
        }

        var available = frame.IsOnTrackCar && frame.CurrentLapTime > 0.05f;
        return new LapValidityResult(available, available && !_invalid);
    }

    private void Reset(RawTelemetryFrame frame, int playerCarIndex)
    {
        _sessionNumber = frame.SessionNumber;
        _playerCarIndex = playerCarIndex;
        _lap = frame.Lap;
        _incidentBaseline = Math.Max(0, frame.PlayerIncidentCount);
        _invalid = false;
    }
}

public readonly record struct LapValidityResult(bool Available, bool IsValid);
