# Архитектура

[English](../en/architecture.md)

## Компоненты

ApexHUD состоит из трёх runtime-слоёв:

1. **Telemetry service (`services/telemetry`)** — процесс .NET 8, читающий shared memory iRacing через IRSDKSharper, разбирающий SessionInfo YAML и рассчитывающий standings, relative, radar, валидность круга, топливо, электронику, pit state, погоду и motion.
2. **Desktop host (`apps/desktop`)** — Electron main/preload/renderer: Control Center, прозрачный overlay, визуальный редактор, storage раскладок, Git-каталог Community, custom protocols и sandbox модулей.
3. **Modules (`modules`)** — независимые статические web-виджеты.

Пакет `packages/protocol` содержит protocol v6, manifest types и validators, наследование раскладок и DTO для IPC.

## Поток данных

```text
iRacing SDK → RawTelemetryFrame → processing engines → TelemetrySnapshot
          → bounded state store → localhost WebSocket → Electron host
          → фильтрация scopes → sandboxed module iframe
```

Очередь ограничена: актуальный кадр важнее накопленной задержки. Session YAML обрабатывается отдельно, поскольку состав участников и результаты меняются во время сессии.

## Сетевая граница

Сервис слушает только loopback. Стандартные endpoints: `ws://127.0.0.1:47931/ws`, `/health`, `/snapshot`. Это локальный diagnostic/integration API, а не интернет-сервис.

## Жизненный цикл

В development `scripts/dev.ps1` запускает telemetry service и Electron workspace. Собранное приложение стартует опубликованный telemetry executable как дочерний процесс. При отсутствии live iRacing после задержки включается mock source.

## Состояние и хранение

Preferences, layouts, локальные modules и checkout Community находятся в Electron `userData`. Раскладки записываются через временный файл и atomic replace. Логика Base Layout находится в protocol package и используется renderer и тестами.

## Ограничения архитектуры

- Live telemetry работает только под Windows.
- Overlay требует borderless/windowed mode; graphics injection отсутствует.
- Точных world coordinates соперников в используемом live feed нет.
- Модули считаются недоверенными и получают только заявленные scopes.
