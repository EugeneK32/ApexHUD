# Telemetry protocol v6

[Russian version](../ru/telemetry-protocol.md)

## Transport

The .NET bridge publishes JSON snapshots over `ws://127.0.0.1:47931/ws`. Module iframes do not connect directly; the Electron host validates snapshots, filters requested scopes, and sends `apex:frame` messages with `Partial<TelemetrySnapshot>`.

Every snapshot contains `protocolVersion`, `sequence`, `timestamp`, `source`, and the following scopes:

| Scope | Main purpose |
|---|---|
| `connection` | Bridge and simulator-window state. |
| `session` | Session identity, track, time/lap limits, flags, replay/garage state. |
| `player` | Player identity, class, positions, lap progress, fuel, incidents. |
| `vehicle` | Speed, gear, RPM/shift data, processed and raw controls, steering range, surface. |
| `driverAids` | ABS intervention/cut, TC configuration, brake bias, limiters, engine warnings. |
| `pit` | Pit availability, stall/service/repair state, service selections. |
| `environment` | Air/track temperature, wetness, precipitation, humidity, wind, fog, skies. |
| `motion` | Local velocity, acceleration, orientation/rates, steering torque. |
| `timing` | Lap times, validity, personal/session/optimal deltas. |
| `fuel` | Current fuel and learned strategy estimates. |
| `radar` | Spotter state and approximate side contacts. |
| `relative` | Nearby cars by wrapped track distance. |
| `standings` | Overall/class positions and scoring context. |

## Availability rules

Fields that iRacing may omit are optional/nullable or accompanied by `*Available` / `dataAvailable`. Never treat missing as zero. A false `absActive` with `absAvailable: false` means “unknown or unsupported”, not “ABS is definitely inactive”.

`vehicle.throttle` and `brake` are processed in-sim values. `throttleRaw` and `brakeRaw` are pedal-side values before shaping or automatic cuts when available. `shiftIndicatorPercent` and `shiftPowerPercent` are normalized `0..1` values and should be preferred for graphical shift-light behavior; car-specific RPM thresholds remain useful fallbacks.

`driverAids.absActive` is actual ABS intervention. `absCutPercent` is the reported braking cut fraction when available. TC fields describe configuration; ApexHUD does not expose a generic `tcActive` because the SDK does not provide a reliable cross-car intervention signal.

`session.flags` and `driverAids.engineWarnings` are bitfields. Decode with bitwise AND, not numeric equality. Engine warning booleans are already provided for water temperature, fuel pressure, oil pressure, oil temperature, stalled engine, pit limiter, and rev limiter.

## Units

SI units are explicit in field names: metres, seconds, litres, radians, m/s, m/s², Nm, Celsius, and kPa. Percent-like controls are generally normalized `0..1`; fields explicitly named `*Percent` follow the source convention documented in the TypeScript interface and module guide.

## Compatibility

A module receives protocol version in `apex:init` and every `apex:frame`. It should reject a higher required major protocol gracefully, tolerate additional fields and unknown enum strings, and render an unavailable state instead of fabricated values.

The authoritative schema and runtime validators are in `packages/protocol/src/index.ts`; the C# DTO mirror is `services/telemetry/Models/TelemetrySnapshot.cs`.
