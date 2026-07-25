# Architecture

[Russian version](../ru/architecture.md)

## Components

ApexHUD has three runtime layers:

1. **Telemetry service (`services/telemetry`)** — a .NET 8 process that reads iRacing shared memory through IRSDKSharper, parses SessionInfo YAML, normalizes unstable values, and derives standings, relatives, radar contacts, lap validity, fuel estimates, driver aids, pit state, environment, and motion.
2. **Desktop host (`apps/desktop`)** — Electron main/preload/renderer code for Control Center, transparent overlay, visual editor, layout storage, Community Git catalog, custom protocols, and module sandboxing.
3. **Modules (`modules`)** — static web widgets rendered independently.

The shared TypeScript package in `packages/protocol` defines protocol v6, module manifests, validators, layout inheritance, and IPC-safe DTOs.

## Data flow

```text
iRacing SDK → RawTelemetryFrame → processing engines → TelemetrySnapshot
          → bounded state store → localhost WebSocket → Electron host
          → scope filtering → sandboxed module iframe
```

The telemetry queue is bounded: current data is preferred over delayed backlog. Session YAML is processed independently because driver registration and results may change while telemetry is running.

## Network boundary

The service listens only on loopback. Default endpoints are `ws://127.0.0.1:47931/ws`, `/health`, and `/snapshot`. They are diagnostic/local integration endpoints, not a public internet API.

## Process lifecycle

In development `scripts/dev.ps1` starts the telemetry service and Electron workspace. Packaged builds launch the published telemetry executable as a child process and terminate it with the desktop host. The mock source starts after a delay when live iRacing data is unavailable.

## State and persistence

Application preferences, layouts, local modules, and the Community checkout live under Electron `userData`. Layout writes use a temporary file and atomic replacement. Base Layout inheritance is resolved in the protocol package so renderer and tests share one implementation.

## Design constraints

- Windows-only live telemetry because iRacing shared memory is Windows-specific.
- Borderless/windowed overlay only; no graphics injection.
- No exact opponent world coordinates in the public live feed used by ApexHUD.
- Modules are untrusted and receive only requested data scopes.
