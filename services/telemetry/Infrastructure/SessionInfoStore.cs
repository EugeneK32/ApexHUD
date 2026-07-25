using ApexHUD.Telemetry.Models;

namespace ApexHUD.Telemetry.Infrastructure;

public sealed class SessionInfoStore
{
    private SessionMetadata _metadata = SessionMetadata.Empty;

    public SessionMetadata Current => Volatile.Read(ref _metadata);

    public void Update(SessionMetadata metadata) =>
        Volatile.Write(ref _metadata, metadata);
}
