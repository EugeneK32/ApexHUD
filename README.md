<div align="center">

# ApexHUD

**Open, modular, local-first iRacing overlays for Windows.**

Build a HUD that changes with the session, edit it directly over the simulator, and extend it with sandboxed HTML/CSS/JavaScript widgets.

![Status](https://img.shields.io/badge/status-early%20beta-f59e0b)
![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4)
![.NET](https://img.shields.io/badge/.NET-8.0-512bd4)
![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-339933)
![Protocol](https://img.shields.io/badge/telemetry-protocol%20v6-7c3aed)
![License](https://img.shields.io/badge/license-MPL--2.0-blue)

[Russian version](README.ru.md) · [Documentation](docs/README.md) · [Module guide](docs/en/module-development.md)

</div>

> [!IMPORTANT]
> ApexHUD is in active early-beta development. The source tree is ready for development and community contributions, but public binaries are not yet code-signed and the project does not yet ship an automatic updater.

## What ApexHUD is

ApexHUD is a customizable iRacing overlay platform. A local .NET service reads iRacing shared-memory telemetry, derives race-aware data, and streams it to a transparent Electron overlay. Every HUD widget is independent, configurable, and replaceable.

The project is built around four principles:

- **Glanceable while driving.** Critical information must remain readable through peripheral vision.
- **Layouts owned by the driver.** Widgets can be positioned, resized, duplicated, configured, and enabled independently.
- **Open extension model.** Community widgets are static web packages with a validated manifest and a scoped telemetry API.
- **Local-first operation.** Telemetry stays on the PC; the bridge listens only on `127.0.0.1`.

## Highlights

- Transparent click-through overlay with an in-game visual editor.
- HUD profiles for different purposes, such as Racing, Practice, Minimal, or Streaming.
- Session modes for Test Drive, Practice, Qualifying, Race, and Replay.
- A shared **Base Layout** inherited by session-specific child layouts.
- Property-level overrides, local widgets, and tombstones for intentionally removed inherited widgets.
- Copy any resolved layout between any profiles and session modes.
- Sandboxed HTML/CSS/JavaScript module system.
- Git-backed Community catalog with previews, installation, and update checks.
- Multiclass-aware positions and standings.
- Protocol v6 scopes for driver aids, pit service, weather, motion, timing, fuel, radar, relatives, and standings.
- Live ABS intervention, ABS brake-cut amount, TC settings, brake bias, pit/rev limiter state, and decoded engine warnings.
- Raw and processed pedal inputs, exact shift-indicator percentage, steering range, and motion data for training widgets.
- English and Russian documentation, plus a localized Control Center with English fallback.

## Built-in widgets

| Widget | Purpose |
|---|---|
| **Proximity Radar** | Transparent side-by-side warning driven by the iRacing spotter state. |
| **Race Standings** | Overall or multiclass order, intervals, pit state, and guaranteed player visibility. |
| **Relative** | Nearby cars ahead and behind with estimated spatial gaps. |
| **Position** | Large overall or class position designed for peripheral vision. |
| **Personal Delta** | Live personal delta with lap validity. |
| **Lap Times** | Current, last, and best lap information. |
| **Race Dashboard** | Speed, gear, and car-specific shift guidance. |
| **Driver Inputs** | Steering, throttle, brake, and clutch traces. |
| **Fuel Strategy** | Fuel level, learned consumption, and finish estimate. |
| **Session Header** | Track, session, flags, time, and laps. |
| **Race Control** | High-visibility flags, penalties, and pit instructions. |
| **Incidents** | Compact incident counter with warning thresholds. |

Community widgets can be installed from the catalog or copied into the local modules directory.

## Layout model

A HUD profile contains one Base Layout and several session-specific child layouts:

```text
HUD profile: Racing
  Base Layout
  Test Drive
  Practice
  Qualifying
  Race
  Replay
```

Child layouts store only differences from Base:

- changed position, size, settings, visibility, or z-index;
- modules added only to that child;
- tombstones for inherited modules deliberately removed from that child.

Consequences:

- changing a non-overridden Base property updates every child;
- a new Base module appears in all children automatically;
- a Base module removed from one child stays removed there;
- resetting a child removes local differences and restores inheritance.

Read [Layouts and inheritance](docs/en/layouts.md) for the exact model.

## Community catalog

The default catalog is:

```text
https://github.com/EugeneK32/apexhud-community-modules.git
```

ApexHUD can use Git from `PATH`, `APEXHUD_GIT_PATH`, or bundled PortableGit at `bin\git\cmd\git.exe`. The catalog supports normal module directories and Git submodules.

See [Community modules](docs/en/community-modules.md).

## Requirements

- Windows 10 or Windows 11;
- iRacing;
- .NET 8 SDK;
- Node.js `22.12.0` or newer;
- npm 10 or newer;
- Git for the Community catalog.

Use **windowed or borderless fullscreen**. ApexHUD intentionally does not inject a DLL or install a DirectX hook, so exclusive fullscreen cannot be overlaid reliably.

## Enable iRacing telemetry

Open:

```text
Documents\iRacing\app.ini
```

Ensure:

```ini
irsdkEnableMem=1
```

Restart iRacing after changing the setting.

## Run from source

Open PowerShell in the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\dev.ps1
```

Run the desktop without the telemetry service:

```powershell
.\scripts\dev.ps1 -NoTelemetry
```

### Global shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+F10` | Enter or leave the visual layout editor. |
| `Ctrl+Shift+F11` | Enable or disable the overlay. |
| `Ctrl+Shift+F12` | Open Control Center. |

## Verify and build

```powershell
npm run verify
dotnet build .\services\telemetry\ApexHUD.Telemetry.csproj
```

Restore locked development dependencies when local tools are missing:

```powershell
npm ci --include=dev --foreground-scripts
```

Build Windows installer and portable packages:

```powershell
.\scripts\build.ps1
```

See [Development and builds](docs/en/development.md).

## Developing modules

A module is a self-contained static web package:

```text
my-widget/
  manifest.json
  index.html
  style.css
  module.js
  preview.webp
  README.md
  README.ru.md
  LICENSE
```

Minimal manifest:

```json
{
  "schemaVersion": 1,
  "id": "com.example.apexhud.my-widget",
  "name": "My Widget",
  "description": "A short description.",
  "version": "1.0.0",
  "author": "Your Name",
  "entry": "index.html",
  "scopes": ["player", "driverAids"],
  "defaultBounds": { "x": 0.72, "y": 0.12, "width": 0.2, "height": 0.16 },
  "settings": []
}
```

Protocol v6 scopes:

```text
connection  session  player  vehicle  driverAids  pit  environment
motion      timing   fuel    radar   relative    standings
```

Widgets run in sandboxed iframes without Node.js, Electron IPC, or direct filesystem access. The host sends only declared scopes.

Read the complete [Module Development Guide](docs/en/module-development.md).

## Architecture

```text
iRacing shared memory
        │
        ▼
.NET 8 telemetry service
  ├─ Session YAML and roster parsing
  ├─ standings, relative, radar, lap-validity, and fuel engines
  ├─ driver-aids, pit, environment, and motion normalization
  └─ localhost HTTP/WebSocket API
        │
        ▼
Electron desktop host
  ├─ Control Center
  ├─ transparent overlay and visual editor
  ├─ layout inheritance and persistence
  ├─ Community Git catalog
  └─ scope filtering and module sandbox
        │
        ▼
HTML/CSS/JavaScript widgets
```

Default endpoints:

```text
ws://127.0.0.1:47931/ws
GET http://127.0.0.1:47931/health
GET http://127.0.0.1:47931/snapshot
```

Read [Architecture](docs/en/architecture.md) and [Telemetry protocol](docs/en/telemetry-protocol.md).

## Repository structure

```text
apps/desktop/                  Electron host, UI, editor, and packaging
services/telemetry/            .NET iRacing adapter and derived-data engines
packages/protocol/             Shared protocol v6 types and validators
modules/                       Built-in widgets and module template
config/default-layout.json     Factory HUD composition
scripts/                       Setup, development, verification, and build scripts
docs/en/                       English documentation
docs/ru/                       Russian documentation
tools/                         Development preview tools
```

## Security and privacy

- Telemetry endpoints bind to loopback only.
- Electron uses context isolation, renderer sandboxing, and disabled Node integration.
- Module assets are served through a restricted custom protocol.
- Manifests are validated before loading.
- Modules receive only explicitly requested telemetry scopes.
- Layout files use temporary writes and atomic replacement.

Community modules are still JavaScript. Review source and install only code you trust. Read [Security](docs/en/security.md).

## Known limitations

- Exclusive DirectX fullscreen is unsupported; use borderless or windowed mode.
- iRacing does not expose exact live world-space X/Y/orientation for every opponent through the public feed used here. Radar geometry is therefore an enhanced spotter approximation.
- Relative time, fuel, and other estimates need valid samples and are not official scoring data.
- True traction-control intervention is not exposed as a reliable generic live signal. Protocol v6 exposes TC availability, enabled state, and configured levels, but does not claim `tcActive`.
- The public build is not yet code-signed and has no automatic updater.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and run:

```powershell
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

Useful areas include telemetry correctness, race readability, Windows DPI/multi-monitor behavior, modules, localization, and documentation.

## License

The ApexHUD source code is licensed under **MPL-2.0**, unless otherwise stated. See `LICENSE` and the Licensing documentation for details.

The telemetry service currently depends on IRSDKSharper, which is distributed under **GPL-3.0** and remains subject to its own license. Distributors are responsible for complying with the licenses applicable to all included dependencies. See `THIRD_PARTY_NOTICES.md`.

The ApexHUD name, logo, and visual identity are handled separately; see `TRADEMARKS.md`.

ApexHUD is an independent community project and is not affiliated with, endorsed by, or sponsored by iRacing.com Motorsport Simulations, LLC. iRacing and related marks belong to their respective owners.

Copyright © 2026 Eugene Konovalov and ApexHUD contributors.
