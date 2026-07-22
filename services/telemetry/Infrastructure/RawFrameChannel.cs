using System.Threading.Channels;
using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Infrastructure;

public sealed class RawFrameChannel
{
    private readonly Channel<RawTelemetryFrame> _frames =
        Channel.CreateBounded<RawTelemetryFrame>(new BoundedChannelOptions(2)
        {
            SingleReader = true,
            SingleWriter = true,
            FullMode = BoundedChannelFullMode.DropOldest
        });

    private readonly Channel<string> _sessionInfo =
        Channel.CreateBounded<string>(new BoundedChannelOptions(1)
        {
            SingleReader = true,
            SingleWriter = true,
            FullMode = BoundedChannelFullMode.DropOldest
        });

    public ChannelReader<RawTelemetryFrame> Frames => _frames.Reader;
    public ChannelReader<string> SessionInfo => _sessionInfo.Reader;

    public bool TryWriteFrame(RawTelemetryFrame frame) =>
        _frames.Writer.TryWrite(frame);

    public bool TryWriteSessionInfo(string yaml) =>
        _sessionInfo.Writer.TryWrite(yaml);
}
