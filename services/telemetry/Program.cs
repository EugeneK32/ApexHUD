using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using ApexHUD.Telemetry.Configuration;
using ApexHUD.Telemetry.Infrastructure;
using ApexHUD.Telemetry.Processing;
using ApexHUD.Telemetry.Sources;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<TelemetryOptions>()
    .Bind(builder.Configuration.GetSection(TelemetryOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton<TelemetryStateStore>();
builder.Services.AddSingleton<RawFrameChannel>();
builder.Services.AddSingleton<SessionInfoStore>();
builder.Services.AddSingleton<RadarEngine>();
builder.Services.AddSingleton<RelativeEngine>();
builder.Services.AddSingleton<StandingsEngine>();
builder.Services.AddSingleton<FuelEngine>();
builder.Services.AddSingleton<LapValidityEngine>();
builder.Services.AddSingleton<SimulatorWindowMonitor>();

builder.Services.AddHostedService<SimulatorWindowMonitor>(provider => provider.GetRequiredService<SimulatorWindowMonitor>());
builder.Services.AddHostedService<IRacingTelemetrySource>();
builder.Services.AddHostedService<TelemetryProcessor>();
builder.Services.AddHostedService<MockTelemetrySource>();

builder.WebHost.UseUrls(
    builder.Configuration[$"{TelemetryOptions.SectionName}:Url"]
    ?? "http://127.0.0.1:47931");

var app = builder.Build();

var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web)
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
};

app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(15)
});

app.MapGet("/health", (TelemetryStateStore store) =>
{
    var snapshot = store.Latest;
    return Results.Ok(new
    {
        status = "ok",
        protocolVersion = ProtocolConstants.Version,
        sequence = snapshot.Sequence,
        source = snapshot.Source,
        connected = snapshot.Connection.Connected,
        timestamp = DateTimeOffset.UtcNow
    });
});

app.MapGet("/snapshot", (TelemetryStateStore store) =>
    Results.Json(store.Latest, jsonOptions));

app.Map("/ws", async (
    HttpContext context,
    TelemetryStateStore store,
    IOptions<TelemetryOptions> options,
    CancellationToken token) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(
        token,
        context.RequestAborted);
    var cancellationToken = linkedCancellation.Token;
    var lastSequence = -1L;
    var broadcastHz = Math.Clamp(options.Value.BroadcastHz, 10, 60);
    using var timer = new PeriodicTimer(
        TimeSpan.FromMilliseconds(1000d / broadcastHz));

    try
    {
        while (socket.State == WebSocketState.Open &&
               await timer.WaitForNextTickAsync(cancellationToken))
        {
            var snapshot = store.Latest;
            if (snapshot.Sequence == lastSequence)
            {
                continue;
            }

            lastSequence = snapshot.Sequence;
            var payload = JsonSerializer.SerializeToUtf8Bytes(snapshot, jsonOptions);
            await socket.SendAsync(
                payload,
                WebSocketMessageType.Text,
                endOfMessage: true,
                cancellationToken: cancellationToken);
        }
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        // Browser closed the stream or the host is shutting down.
    }
    catch (WebSocketException)
    {
        // A dropped renderer connection is expected during reloads and shutdown.
    }

    if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
    {
        await socket.CloseAsync(
            WebSocketCloseStatus.NormalClosure,
            "ApexHUD telemetry stream closed",
            CancellationToken.None);
    }
});

app.Run();
