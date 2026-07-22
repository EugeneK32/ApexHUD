using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Processing;

public sealed class FuelEngine
{
    private readonly Queue<double> _samples = new();
    private int _sessionNumber = -1;
    private int _playerCarIndex = -1;
    private int _lastCompletedLap = -1;
    private double _fuelAtLapStart = -1;

    public FuelState Build(RawTelemetryFrame frame, int playerCarIndex)
    {
        if (_sessionNumber != frame.SessionNumber || _playerCarIndex != playerCarIndex)
        {
            Reset(frame.SessionNumber, playerCarIndex);
        }

        var fuel = Positive(frame.FuelLevel);
        if (fuel <= 0)
        {
            return FuelState.Empty;
        }

        if (_fuelAtLapStart < 0 || fuel > _fuelAtLapStart + 0.25)
        {
            _fuelAtLapStart = fuel;
            _lastCompletedLap = frame.LapCompleted;
        }

        if (frame.LapCompleted > _lastCompletedLap)
        {
            var consumed = _fuelAtLapStart - fuel;
            if (consumed is > 0.05 and < 40)
            {
                _samples.Enqueue(consumed);
                while (_samples.Count > 8)
                {
                    _samples.Dequeue();
                }
            }

            _fuelAtLapStart = fuel;
            _lastCompletedLap = frame.LapCompleted;
        }

        var average = _samples.Count > 0 ? _samples.Average() : 0;
        if (average <= 0 && frame.FuelUsePerHour > 0 && frame.BestLapTime > 0)
        {
            average = frame.FuelUsePerHour * frame.BestLapTime / 3600d;
        }

        var lapsToFinish = EstimateLapsToFinish(frame);
        var required = average > 0 && lapsToFinish > 0
            ? average * lapsToFinish * 1.05
            : 0;

        return new FuelState(
            Math.Round(fuel, 2),
            Math.Round(Positive(frame.FuelUsePerHour), 2),
            Math.Round(average, 3),
            average > 0 ? Math.Round(fuel / average, 2) : 0,
            Math.Round(required, 2),
            Math.Round(Math.Max(0, required - fuel), 2),
            _samples.Count,
            average > 0);
    }

    private static double EstimateLapsToFinish(RawTelemetryFrame frame)
    {
        if (frame.SessionLapsRemaining is > 0 and < 32767)
        {
            return frame.SessionLapsRemaining;
        }

        if (frame.SessionTimeRemaining is > 0 and < 604799 && frame.BestLapTime > 0)
        {
            return Math.Ceiling(frame.SessionTimeRemaining / frame.BestLapTime) + 1;
        }

        return 0;
    }

    private void Reset(int sessionNumber, int playerCarIndex)
    {
        _sessionNumber = sessionNumber;
        _playerCarIndex = playerCarIndex;
        _lastCompletedLap = -1;
        _fuelAtLapStart = -1;
        _samples.Clear();
    }

    private static double Positive(float value) =>
        float.IsFinite(value) && value > 0 ? value : 0;
}
