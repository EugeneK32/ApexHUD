# Telemetry protocol v6

[English](../en/telemetry-protocol.md)

## Транспорт

.NET bridge публикует JSON snapshots через `ws://127.0.0.1:47931/ws`. Module iframe не подключается напрямую: Electron host проверяет snapshot, фильтрует scopes и отправляет `apex:frame` с `Partial<TelemetrySnapshot>`.

Каждый snapshot содержит `protocolVersion`, `sequence`, `timestamp`, `source` и scopes:

| Scope | Назначение |
|---|---|
| `connection` | Состояние bridge и окна симулятора. |
| `session` | Сессия, трасса, лимиты, flags, replay/garage. |
| `player` | Игрок, класс, позиции, прогресс, топливо, incidents. |
| `vehicle` | Скорость, передача, RPM/shift, processed/raw controls, диапазон руля, поверхность. |
| `driverAids` | ABS intervention/cut, TC settings, brake bias, limiters, engine warnings. |
| `pit` | Пит, stall/service/repair и выбранное обслуживание. |
| `environment` | Температура, wetness, precipitation, humidity, wind, fog, skies. |
| `motion` | Velocity, acceleration, orientation/rates и steering torque. |
| `timing` | Круги, validity и personal/session/optimal deltas. |
| `fuel` | Топливо и изученные strategy estimates. |
| `radar` | Spotter state и приблизительные боковые contacts. |
| `relative` | Ближайшие машины по wrapped track distance. |
| `standings` | Общая/классовая позиция и scoring context. |

## Доступность

Поля, которые iRacing может не отдавать, optional/nullable или имеют `*Available` / `dataAvailable`. Missing не равен нулю. `absActive: false` при `absAvailable: false` означает «неизвестно/не поддерживается», а не гарантированно выключенный ABS.

`vehicle.throttle` и `brake` — обработанные in-sim значения. `throttleRaw` и `brakeRaw` — положение педалей до shaping/automatic cuts, если доступно. `shiftIndicatorPercent` и `shiftPowerPercent` нормализованы в `0..1` и предпочтительны для shift-light graphics; RPM thresholds остаются fallback.

`driverAids.absActive` — фактическое вмешательство ABS. `absCutPercent` — reported brake-cut fraction. TC fields описывают configuration; универсального `tcActive` нет, потому что SDK не даёт надёжный cross-car intervention signal.

`session.flags` и `engineWarnings` — bitfields; используйте bitwise AND. Для основных engine warnings уже есть готовые booleans.

## Единицы

SI units указаны в именах: metres, seconds, litres, radians, m/s, m/s², Nm, Celsius и kPa. Controls обычно нормализованы в `0..1`.

## Совместимость

Protocol version приходит в `apex:init` и `apex:frame`. Модуль должен спокойно обрабатывать новые поля и неизвестные enum strings и показывать unavailable state вместо выдуманного значения.

Авторитетные types/validators: `packages/protocol/src/index.ts`; C# mirror: `services/telemetry/Models/TelemetrySnapshot.cs`.
