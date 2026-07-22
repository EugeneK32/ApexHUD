using System.Diagnostics;
using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Infrastructure;

public sealed class TelemetryStateStore
{
    private TelemetrySnapshot _latest = TelemetrySnapshot.Empty;
    private long _sequence;
    private long _lastLiveFrameTicks;
    private int _liveConnected;

    public TelemetrySnapshot Latest => Volatile.Read(ref _latest);

    public bool IsLiveConnected => Volatile.Read(ref _liveConnected) == 1;

    public bool IsLiveFresh(TimeSpan threshold)
    {
        var ticks = Volatile.Read(ref _lastLiveFrameTicks);
        if (ticks == 0)
        {
            return false;
        }

        var elapsed = Stopwatch.GetElapsedTime(ticks);
        return elapsed <= threshold;
    }

    public void MarkLiveConnected()
    {
        Volatile.Write(ref _liveConnected, 1);
        Volatile.Write(ref _lastLiveFrameTicks, Stopwatch.GetTimestamp());
    }

    public void MarkLiveDisconnected(string reason)
    {
        Volatile.Write(ref _liveConnected, 0);
        var current = Latest;
        if (current.Source != "iracing")
        {
            return;
        }

        Publish(current with
        {
            Source = "none",
            Connection = current.Connection with
            {
                Connected = false,
                Status = reason
            }
        });
    }

    public void PublishLive(TelemetrySnapshot snapshot)
    {
        MarkLiveConnected();
        Publish(snapshot with { Source = "iracing" });
    }

    public void PublishMock(TelemetrySnapshot snapshot)
    {
        if (IsLiveFresh(TimeSpan.FromSeconds(1)))
        {
            return;
        }

        Publish(snapshot with { Source = "mock" });
    }

    private void Publish(TelemetrySnapshot snapshot)
    {
        var next = snapshot with
        {
            ProtocolVersion = ProtocolConstants.Version,
            Sequence = Interlocked.Increment(ref _sequence),
            Timestamp = DateTimeOffset.UtcNow
        };

        Volatile.Write(ref _latest, next);
    }
}
