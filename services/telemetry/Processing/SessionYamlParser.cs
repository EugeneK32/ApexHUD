using System.Globalization;
using System.Text.RegularExpressions;
using ApexHUD.Telemetry.Models;
using YamlDotNet.RepresentationModel;

namespace ApexHUD.Telemetry.Processing;

public static partial class SessionYamlParser
{
    public static SessionMetadata Parse(string yaml)
    {
        if (string.IsNullOrWhiteSpace(yaml))
        {
            return SessionMetadata.Empty;
        }

        using var reader = new StringReader(yaml);
        var stream = new YamlStream();
        stream.Load(reader);

        if (stream.Documents.Count == 0 ||
            stream.Documents[0].RootNode is not YamlMappingNode root)
        {
            return SessionMetadata.Empty;
        }

        var weekend = Map(root, "WeekendInfo");
        var driverInfo = Map(root, "DriverInfo");
        var sessionInfo = Map(root, "SessionInfo");

        var trackName =
            Scalar(weekend, "TrackDisplayName") ??
            Scalar(weekend, "TrackName") ??
            "Unknown track";

        var trackLength = ParseLengthMeters(Scalar(weekend, "TrackLength"));
        var eventType = Scalar(weekend, "EventType") ?? "Unknown";
        var driverCarIndex = Int(driverInfo, "DriverCarIdx", -1);
        var playerShiftLightFirstRpm = Double(driverInfo, "DriverCarSLFirstRPM", 0);
        var playerShiftRpm = Double(driverInfo, "DriverCarSLShiftRPM", 0);
        var playerShiftLightLastRpm = Double(driverInfo, "DriverCarSLLastRPM", 0);
        var playerShiftLightBlinkRpm = Double(driverInfo, "DriverCarSLBlinkRPM", 0);

        var drivers = new Dictionary<int, DriverMetadata>();
        foreach (var driverNode in Sequence(driverInfo, "Drivers"))
        {
            if (driverNode is not YamlMappingNode driver)
            {
                continue;
            }

            var carIndex = Int(driver, "CarIdx", -1);
            if (carIndex < 0)
            {
                continue;
            }

            var license =
                Scalar(driver, "LicString") ??
                BuildLicense(driver) ??
                string.Empty;

            drivers[carIndex] = new DriverMetadata(
                carIndex,
                Scalar(driver, "UserName") ?? $"Car {carIndex}",
                Scalar(driver, "TeamName") ?? string.Empty,
                Scalar(driver, "CarNumber") ?? carIndex.ToString(CultureInfo.InvariantCulture),
                Int(driver, "CarClassID", 0),
                Scalar(driver, "CarClassShortName") ??
                    Scalar(driver, "CarClassRelSpeed") ??
                    "Class",
                Int(driver, "IRating", 0),
                license,
                Bool(driver, "CarIsPaceCar"),
                Bool(driver, "IsSpectator"));
        }

        var sessions = new Dictionary<int, SessionDescriptor>();
        foreach (var sessionNode in Sequence(sessionInfo, "Sessions"))
        {
            if (sessionNode is not YamlMappingNode session)
            {
                continue;
            }

            var number = Int(session, "SessionNum", -1);
            if (number >= 0)
            {
                var sessionType = Scalar(session, "SessionType") ?? "Session";
                var sessionName = Scalar(session, "SessionName") ?? sessionType;
                var results = new Dictionary<int, SessionResultMetadata>();
                foreach (var resultNode in Sequence(session, "ResultsPositions"))
                {
                    if (resultNode is not YamlMappingNode result)
                    {
                        continue;
                    }

                    var resultCarIndex = Int(result, "CarIdx", -1);
                    if (resultCarIndex < 0)
                    {
                        continue;
                    }

                    results[resultCarIndex] = new SessionResultMetadata(
                        resultCarIndex,
                        OneBasedPosition(result, "Position"),
                        OneBasedPosition(result, "ClassPosition"),
                        Math.Max(0, Int(result, "LapsComplete", 0)),
                        Math.Max(0, Int(result, "LapsDriven", 0)),
                        PositiveDouble(result, "LastTime"),
                        PositiveDouble(result, "FastestTime"),
                        Math.Max(0, Int(result, "Incidents", 0)),
                        Int(result, "ReasonOutId", 0),
                        Scalar(result, "ReasonOutStr") ?? string.Empty);
                }

                sessions[number] = new SessionDescriptor(
                    number,
                    sessionType,
                    sessionName,
                    results);
            }
        }

        return new SessionMetadata(
            driverCarIndex,
            trackName,
            trackLength,
            playerShiftLightFirstRpm,
            playerShiftRpm,
            playerShiftLightLastRpm,
            playerShiftLightBlinkRpm,
            eventType,
            drivers,
            sessions);
    }

    private static int OneBasedPosition(YamlMappingNode? parent, string key)
    {
        var raw = Int(parent, key, -1);
        return raw >= 0 ? raw + 1 : 0;
    }

    private static double PositiveDouble(YamlMappingNode? parent, string key)
    {
        var value = Double(parent, key, 0);
        return double.IsFinite(value) && value > 0 ? value : 0;
    }

    private static string? BuildLicense(YamlMappingNode? driver)
    {
        var level = Scalar(driver, "LicString");
        if (!string.IsNullOrWhiteSpace(level))
        {
            return level;
        }

        var subLevel = Int(driver, "LicSubLevel", -1);
        return subLevel >= 0
            ? $"{subLevel / 100}.{subLevel % 100:00}"
            : null;
    }

    private static double ParseLengthMeters(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var match = LengthRegex().Match(value);
        if (!match.Success ||
            !double.TryParse(
                match.Groups["value"].Value,
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out var length))
        {
            return 0;
        }

        var unit = match.Groups["unit"].Value.ToLowerInvariant();
        return unit switch
        {
            "km" => length * 1000,
            "mi" or "mile" or "miles" => length * 1609.344,
            "m" => length,
            _ => length * 1000
        };
    }

    private static YamlMappingNode? Map(YamlMappingNode? parent, string key) =>
        Child(parent, key) as YamlMappingNode;

    private static IEnumerable<YamlNode> Sequence(YamlMappingNode? parent, string key) =>
        Child(parent, key) is YamlSequenceNode sequence
            ? sequence.Children
            : Array.Empty<YamlNode>();

    private static YamlNode? Child(YamlMappingNode? parent, string key)
    {
        if (parent is null)
        {
            return null;
        }

        return parent.Children.TryGetValue(new YamlScalarNode(key), out var node)
            ? node
            : null;
    }

    private static string? Scalar(YamlMappingNode? parent, string key) =>
        Child(parent, key) is YamlScalarNode scalar
            ? scalar.Value
            : null;

    private static int Int(YamlMappingNode? parent, string key, int fallback)
    {
        var value = Scalar(parent, key);
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : fallback;
    }

    private static double Double(YamlMappingNode? parent, string key, double fallback)
    {
        var value = Scalar(parent, key);
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : fallback;
    }

    private static bool Bool(YamlMappingNode? parent, string key)
    {
        var value = Scalar(parent, key);
        return bool.TryParse(value, out var parsed) && parsed ||
               value == "1";
    }

    [GeneratedRegex(
        @"(?<value>\d+(?:\.\d+)?)\s*(?<unit>km|mi|mile|miles|m)?",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex LengthRegex();
}
