using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ApexHUD.Telemetry.Infrastructure;

public sealed record SimulatorWindowSnapshot(
    bool ProcessRunning,
    bool WindowFound,
    bool IsVisible,
    bool IsMinimized,
    bool IsForeground)
{
    public static SimulatorWindowSnapshot Empty { get; } =
        new(false, false, false, false, false);
}

public sealed class SimulatorWindowMonitor : BackgroundService
{
    private readonly ILogger<SimulatorWindowMonitor> _logger;
    private volatile SimulatorWindowSnapshot _current = SimulatorWindowSnapshot.Empty;

    public SimulatorWindowMonitor(ILogger<SimulatorWindowMonitor> logger)
    {
        _logger = logger;
    }

    public SimulatorWindowSnapshot Current => _current;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                _current = Inspect();
            }
            catch (Exception exception)
            {
                _logger.LogDebug(exception, "Could not inspect the iRacing simulator window.");
                _current = SimulatorWindowSnapshot.Empty;
            }
        }
    }

    private static SimulatorWindowSnapshot Inspect()
    {
        var processes = Process.GetProcessesByName("iRacingSim64DX11");
        try
        {
            if (processes.Length == 0)
            {
                return SimulatorWindowSnapshot.Empty;
            }

            var process = processes.FirstOrDefault(candidate => candidate.MainWindowHandle != IntPtr.Zero)
                ?? processes[0];
            var handle = process.MainWindowHandle;
            if (handle == IntPtr.Zero)
            {
                return new SimulatorWindowSnapshot(true, false, false, false, false);
            }

            var foreground = GetForegroundWindow();
            var foregroundProcessId = 0u;
            if (foreground != IntPtr.Zero)
            {
                _ = GetWindowThreadProcessId(foreground, out foregroundProcessId);
            }

            return new SimulatorWindowSnapshot(
                true,
                true,
                IsWindowVisible(handle),
                IsIconic(handle),
                foregroundProcessId == (uint)process.Id);
        }
        finally
        {
            foreach (var process in processes)
            {
                process.Dispose();
            }
        }
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr window);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
