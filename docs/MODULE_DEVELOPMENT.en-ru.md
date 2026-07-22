# ApexHUD Module Development Guide

**Target:** ApexHUD 0.10.0  
**Telemetry protocol:** v5  
**Manifest schema:** v1  
**Language:** English

This document describes the complete public module model implemented by ApexHUD 0.10.0. It covers local modules, built-in modules, Community catalog packaging, the manifest schema, host messages, every telemetry scope, settings, layout inheritance, security, performance, testing, visual design, compatibility and troubleshooting.

> ApexHUD modules are static web applications rendered inside sandboxed iframes. A module normally consists of `manifest.json`, an HTML entry point, CSS, JavaScript and local assets. A build tool is optional.

---

## Table of contents

1. [Core concepts](#1-core-concepts)
2. [Quick start](#2-quick-start)
3. [Module locations and discovery rules](#3-module-locations-and-discovery-rules)
4. [Recommended project structure](#4-recommended-project-structure)
5. [Manifest reference](#5-manifest-reference)
6. [Settings reference](#6-settings-reference)
7. [Runtime and sandbox model](#7-runtime-and-sandbox-model)
8. [Host-to-module messages](#8-host-to-module-messages)
9. [Module-to-host messages](#9-module-to-host-messages)
10. [Robust message handler](#10-robust-message-handler)
11. [Telemetry scope reference](#11-telemetry-scope-reference)
12. [Data semantics and defensive rendering](#12-data-semantics-and-defensive-rendering)
13. [Visibility and edit mode](#13-visibility-and-edit-mode)
14. [Multiple instances and persisted state](#14-multiple-instances-and-persisted-state)
15. [Base Layout inheritance](#15-base-layout-inheritance)
16. [Rendering and performance](#16-rendering-and-performance)
17. [Racing-focused UX and visual design](#17-racing-focused-ux-and-visual-design)
18. [Localization](#18-localization)
19. [Security and CSP](#19-security-and-csp)
20. [Development workflow](#20-development-workflow)
21. [Testing checklist](#21-testing-checklist)
22. [Community catalog publishing](#22-community-catalog-publishing)
23. [Versioning and compatibility](#23-versioning-and-compatibility)
24. [Complete example module](#24-complete-example-module)
25. [Troubleshooting](#25-troubleshooting)
26. [Current API limitations](#26-current-api-limitations)
27. [Release checklist](#27-release-checklist)

---

## 1. Core concepts

### Module package

A module package is one directory containing a valid `manifest.json` and all files required by the widget. ApexHUD does not require npm, React or a bundler. Frameworks are allowed if the final output is static and self-contained.

### Module definition vs module instance

A **module definition** is the package identified by `manifest.id`.

A **module instance** is one placed copy of that module in a HUD layout. Several instances of the same module may exist at the same time. Each instance has independent:

- `instanceId`;
- position and size;
- enabled state;
- z-index;
- settings.

Do not assume that only one copy of your module exists.

### Host

The ApexHUD Electron application is the host. It:

- discovers module packages;
- validates manifests;
- creates sandboxed iframes;
- generates the settings UI from the manifest;
- sends telemetry and lifecycle messages;
- persists layout and instance settings.

### Scopes

A scope is a named subset of telemetry. The module lists required scopes in its manifest. The host sends only those scope objects, plus `payload.source`.

Request the smallest set of scopes that the module genuinely uses.

### Layouts

A module does not manage layout state directly. ApexHUD owns positioning, resizing, duplication, inheritance, removal and persistence.

---

## 2. Quick start

### Option A: develop inside the ApexHUD source tree

Copy the template:

```powershell
Copy-Item .\modules\_template .\modules\my-widget -Recurse
```

Then edit:

```text
modules/my-widget/manifest.json
modules/my-widget/index.html
modules/my-widget/style.css
modules/my-widget/module.js
```

Start ApexHUD:

```powershell
npm install
.\scripts\dev.ps1
```

Reload the module catalog from the Control Center after changing the package structure or manifest.

### Option B: create a local user module

The safest way to find the user module directory is:

1. Open ApexHUD Control Center.
2. Open **My widgets / Library**.
3. Use the `···` menu.
4. Choose **Open modules folder**.

On the current Windows package, the directory is normally similar to:

```text
%APPDATA%\@apexhud\desktop\modules
```

Do not hard-code this path in installers. ApexHUD uses Electron's `app.getPath("userData")` and the exact folder can change with package identity or platform.

Copy the module directory there, reload modules, open the visual editor and add the widget.

### Minimal working package

```text
my-widget/
  manifest.json
  index.html
  style.css
  module.js
```

---

## 3. Module locations and discovery rules

ApexHUD scans two roots:

1. Built-in modules.
2. User modules.

### Development roots

```text
<repository>/modules/
<user-data>/modules/
```

### Packaged application roots

```text
<application-resources>/modules/
<user-data>/modules/
```

### Discovery rules

- Only immediate child directories are scanned.
- Directory names beginning with `_` are ignored.
- `manifest.json` must be at the module directory root.
- The declared `entry` file must exist and be a regular file.
- Invalid modules are skipped and logged to the Electron console.
- Modules are sorted by display name after discovery.
- Built-in modules are scanned first.
- Duplicate `manifest.id` values are ignored after the first discovered definition.
- A user module therefore cannot replace a built-in module by reusing its ID.
- Folder name and manifest ID do not need to match, but matching them conceptually makes maintenance easier.

### Reserved IDs

Never reuse any built-in ID such as:

```text
com.apexhud.dashboard
com.apexhud.delta
com.apexhud.fuel
com.apexhud.incidents
com.apexhud.inputs
com.apexhud.lap-times
com.apexhud.position
com.apexhud.race-control
com.apexhud.radar
com.apexhud.relative
com.apexhud.session
com.apexhud.standings
```

`com.apexhud.radar` is additionally special-cased by the host and rendered by the native radar renderer instead of a normal iframe.

---

## 4. Recommended project structure

```text
com.example.apexhud.battle-focus/
  manifest.json
  index.html
  style.css
  module.js
  preview.webp
  README.md
  LICENSE
  assets/
    icon.svg
```

For a bundled framework build:

```text
com.example.apexhud.widget/
  manifest.json
  index.html
  assets/
    index-a1b2c3.js
    index-d4e5f6.css
  preview.webp
  README.md
  LICENSE
```

Requirements:

- Everything needed at runtime must be inside the module directory.
- Use relative URLs.
- Do not depend on a CDN.
- Do not ship `node_modules`.
- Do not ship source maps containing secrets or local absolute paths.
- Do not redistribute font files.

---

## 5. Manifest reference

ApexHUD 0.10.0 uses manifest schema version `1`.

### Complete example

```json
{
  "schemaVersion": 1,
  "id": "com.example.apexhud.battle-focus",
  "name": "Battle Focus",
  "description": "Shows the nearest car ahead, the player and the nearest car behind.",
  "version": "1.0.0",
  "author": "Example Racing",
  "entry": "index.html",
  "scopes": ["player", "session", "standings"],
  "defaultBounds": {
    "x": 0.76,
    "y": 0.38,
    "width": 0.21,
    "height": 0.22
  },
  "minimumSize": {
    "width": 300,
    "height": 170
  },
  "settings": [
    {
      "key": "mode",
      "label": "Cars to compare",
      "type": "select",
      "default": "auto",
      "options": [
        { "label": "Automatic", "value": "auto" },
        { "label": "Overall", "value": "overall" },
        { "label": "My class", "value": "class" }
      ]
    },
    {
      "key": "showNames",
      "label": "Show driver names",
      "type": "boolean",
      "default": true
    },
    {
      "key": "accent",
      "label": "Player highlight",
      "type": "color",
      "default": "#f2c94c"
    },
    {
      "key": "opacity",
      "label": "Panel opacity",
      "type": "range",
      "default": 0.92,
      "min": 0.3,
      "max": 1,
      "step": 0.05
    }
  ]
}
```

### Top-level fields

| Field | Required | Validation and behavior |
|---|---:|---|
| `schemaVersion` | yes | Must be exactly `1`. |
| `id` | yes | Reverse-DNS identifier, lowercase letters, numbers and hyphens; at least one dot; maximum 120 characters. Example: `com.example.apexhud.widget`. |
| `name` | yes | 1–80 characters. Displayed in the editor and library. |
| `description` | yes | 1–300 characters. Keep it user-facing and concrete. |
| `version` | yes | 1–40 characters. The validator does not enforce strict SemVer, but Community update comparison works best with numeric dotted versions. |
| `author` | yes | 1–100 characters. |
| `entry` | yes | Safe relative path using `/`, maximum 240 characters. No leading slash, backslash, empty component, `.`, `..` or NUL. |
| `scopes` | yes | Non-empty array containing only supported scope names. |
| `defaultBounds` | yes | Initial normalized position and size. |
| `minimumSize` | no | Pixel dimensions used while resizing in the visual editor. Each dimension must be between 40 and 10,000. |
| `settings` | yes | Array of 0–64 setting fields. |

### Module ID format

Valid:

```text
com.example.apexhud.widget
io.github.username.apexhud.my-widget
ru.company.apexhud.fuel-helper
```

Invalid:

```text
my-widget                  # no dot
Com.Example.Widget         # uppercase
com.example.my_widget      # underscore
.com.example.widget        # leading dot
com..example.widget        # empty component
```

### `defaultBounds`

Coordinates are normalized to the overlay display:

```json
{
  "x": 0.72,
  "y": 0.12,
  "width": 0.20,
  "height": 0.18
}
```

Interpretation:

- `x`: distance from the left edge, `0..1`;
- `y`: distance from the top edge, `0..1`;
- `width`: fraction of display width;
- `height`: fraction of display height.

Validation rules:

- `x` and `y`: `0..1`;
- `width` and `height`: `0.01..1`;
- `x + width <= 1`;
- `y + height <= 1`.

At runtime, bounds are sanitized and width/height are clamped to at least `0.04`. Existing saved instances are not automatically moved when you change `defaultBounds`.

### `minimumSize`

```json
{
  "minimumSize": {
    "width": 280,
    "height": 140
  }
}
```

This constrains interactive resizing. It is not a guarantee that every old saved layout will immediately be resized after a module update. Your CSS must remain defensive and responsive.

---

## 6. Settings reference

The visual editor generates controls directly from `manifest.settings`.

### General setting fields

| Field | Required | Rules |
|---|---:|---|
| `key` | yes | Starts with a letter, then letters, numbers, `_`, `.`, or `-`; maximum 64 characters; unique within the manifest. |
| `label` | yes | 1–80 characters. |
| `type` | yes | `boolean`, `range`, `number`, `color`, or `select`. |
| `default` | yes | String, finite number or boolean matching the declared type. |
| `min` | conditional | Finite number. Recommended for `range` and `number`. |
| `max` | conditional | Finite number and not below `min`. |
| `step` | conditional | Positive finite number. |
| `options` | select | 1–50 options. Values must be unique. |
| `help` | no | 1–240 characters. |

### Boolean

```json
{
  "key": "showNames",
  "label": "Show driver names",
  "type": "boolean",
  "default": true
}
```

### Range

```json
{
  "key": "opacity",
  "label": "Panel opacity",
  "type": "range",
  "default": 0.9,
  "min": 0.2,
  "max": 1,
  "step": 0.05
}
```

### Number

```json
{
  "key": "warningAt",
  "label": "Warning threshold",
  "type": "number",
  "default": 8,
  "min": 1,
  "max": 100,
  "step": 1
}
```

### Color

```json
{
  "key": "accent",
  "label": "Accent",
  "type": "color",
  "default": "#f2c94c"
}
```

The validator accepts hexadecimal colors with 3–8 digits. For consistent editor behavior, prefer six-digit `#RRGGBB` values.

### Select

```json
{
  "key": "mode",
  "label": "Position mode",
  "type": "select",
  "default": "auto",
  "options": [
    { "label": "Automatic", "value": "auto" },
    { "label": "Overall", "value": "overall" },
    { "label": "Class", "value": "class" }
  ]
}
```

Option values may be strings or numbers.

### Important persistence behavior

- Settings are persisted per module instance.
- Manifest defaults are copied when a new instance is created.
- Changing a default in a later module version does not overwrite existing user settings.
- Adding a new setting does not guarantee that old instances contain that key.
- Always merge persisted settings over internal fallback defaults.
- Removing or renaming a key has no automatic migration mechanism.
- Keep old keys when possible or handle both old and new names in code.

Recommended pattern:

```js
const DEFAULTS = {
  accent: "#f2c94c",
  showNames: true,
  opacity: 0.92,
};

let settings = { ...DEFAULTS };

function applyIncomingSettings(value) {
  settings = { ...DEFAULTS, ...settings, ...(value || {}) };
}
```

---

## 7. Runtime and sandbox model

Every normal module is loaded in an iframe configured approximately as follows:

```text
sandbox="allow-scripts"
```

Consequences:

- JavaScript is allowed.
- Node.js is unavailable.
- `require` is unavailable.
- `process` is unavailable.
- Electron IPC is unavailable.
- Direct filesystem access is unavailable.
- The iframe does not receive `allow-same-origin`.
- Do not depend on `localStorage`, IndexedDB or origin persistence.
- Do not attempt to manipulate the parent DOM.
- The supported communication channel is `postMessage`.

Assets are served through:

```text
apex-module://<manifest.id>/<relative-path>
```

Use relative links from the entry document:

```html
<link rel="stylesheet" href="style.css" />
<script src="module.js"></script>
<img src="assets/icon.svg" alt="" />
```

The host normalizes paths and blocks traversal outside the module directory.

### Do not rely on runtime fetch

The supported baseline is linked local files and host messages. Because the iframe has a sandboxed opaque origin, browser storage and fetch/CORS behavior should not be treated as a stable module API. Bundle static data into JS or reference it directly from HTML/CSS.

---

## 8. Host-to-module messages

The host sends messages through `window.postMessage`.

### Load order

After the iframe `load` event, the host sends:

1. `apex:init`;
2. `apex:visibility`;
3. the latest `apex:frame`, if available.

Later it sends:

- `apex:frame` for telemetry updates;
- `apex:settings` when instance settings change;
- `apex:visibility` when runtime/edit visibility changes.

Do not assume that telemetry already exists when `apex:init` arrives.

### `apex:init`

```js
{
  type: "apex:init",
  protocolVersion: 5,
  moduleId: "com.example.apexhud.widget",
  instanceId: "widget-8c934f12",
  settings: {
    accent: "#f2c94c",
    opacity: 0.92
  },
  source: "iracing" | "mock" | "none" | string
}
```

Use it to:

- capture `instanceId` if useful for diagnostics;
- apply persisted settings;
- detect the telemetry source;
- initialize static UI state.

### `apex:frame`

```js
{
  type: "apex:frame",
  protocolVersion: 5,
  sequence: 12345,
  timestamp: "2026-07-23T14:30:00.000Z",
  payload: {
    source: "iracing",
    player: { /* only if requested */ },
    standings: { /* only if requested */ }
  }
}
```

Properties:

- `sequence` is monotonically increasing for published snapshots.
- `timestamp` is an ISO 8601 timestamp.
- `payload.source` is always included.
- Only scopes declared in the manifest are included.
- Unknown fields may be added in future versions and must be ignored.

### `apex:settings`

```js
{
  type: "apex:settings",
  settings: {
    opacity: 0.75,
    showNames: false
  }
}
```

The message currently has no `protocolVersion`. Treat it as a full current settings object and merge it with internal defaults.

### `apex:visibility`

```js
{
  type: "apex:visibility",
  visible: true,
  editMode: false
}
```

Meaning:

- `visible: false`: the overlay is disabled or hidden by runtime policy; pause expensive work.
- `visible: true, editMode: false`: normal driving mode.
- `visible: true, editMode: true`: visual editor mode; telemetry may be absent or mock data may be shown.

---

## 9. Module-to-host messages

### Diagnostic log

```js
window.parent.postMessage({
  type: "apex:log",
  level: "warn",
  message: "No player entry was found in standings"
}, "*");
```

Supported levels:

```text
debug
info
warn
error
```

The host limits a logged message to 2,000 characters and prefixes it with the module ID.

Do not log every telemetry frame.

### Ready message

The protocol type includes:

```js
window.parent.postMessage({
  type: "apex:ready",
  moduleId: "com.example.apexhud.widget"
}, "*");
```

ApexHUD 0.10.0 does not require a ready handshake and currently performs no runtime action for this message. It is safe to emit for forward compatibility, but module initialization must not depend on an acknowledgement.

### Unsupported outgoing actions

A module currently cannot directly:

- change its own persisted settings;
- request a resize;
- add or remove another widget;
- change layouts;
- execute an Electron action;
- access telemetry scopes not declared in the manifest.

---

## 10. Robust message handler

```js
(() => {
  "use strict";

  const SUPPORTED_PROTOCOL = 5;
  const DEFAULTS = {
    accent: "#f2c94c",
    opacity: 0.92,
  };

  let settings = { ...DEFAULTS };
  let visible = true;
  let editMode = false;
  let lastSequence = -1;

  window.addEventListener("message", (event) => {
    // The sandbox may expose an opaque origin, so validate the source window
    // rather than relying on event.origin.
    if (event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (
      (message.type === "apex:init" || message.type === "apex:frame") &&
      message.protocolVersion !== SUPPORTED_PROTOCOL
    ) {
      showUnsupportedProtocol(message.protocolVersion);
      return;
    }

    switch (message.type) {
      case "apex:init":
      case "apex:settings":
        settings = {
          ...DEFAULTS,
          ...settings,
          ...(message.settings || {}),
        };
        applySettings();
        break;

      case "apex:visibility":
        visible = Boolean(message.visible);
        editMode = Boolean(message.editMode);
        document.documentElement.classList.toggle("module-hidden", !visible);
        document.documentElement.classList.toggle("module-editing", editMode);
        break;

      case "apex:frame":
        if (!visible || message.sequence === lastSequence) return;
        lastSequence = message.sequence;
        render(message.payload || {});
        break;
    }
  });

  function applySettings() {
    document.documentElement.style.setProperty(
      "--accent",
      String(settings.accent)
    );
    document.documentElement.style.setProperty(
      "--opacity",
      String(Number(settings.opacity) || 0.92)
    );
  }

  function render(payload) {
    // Read only declared scopes and guard every optional/unavailable value.
  }

  function showUnsupportedProtocol(received) {
    document.body.textContent = `Unsupported ApexHUD protocol: ${received}`;
  }
})();
```

CSS for visibility:

```css
html.module-hidden {
  visibility: hidden;
}
```

---

## 11. Telemetry scope reference

The default telemetry service publishes at 30 Hz. A module is not required to redraw at 30 Hz.

### Common source value

Every frame payload includes:

```ts
source: "iracing" | "mock" | "none" | string
```

- `iracing`: live iRacing shared-memory source.
- `mock`: built-in simulated source.
- `none`: no active source.
- Future source names are possible; handle unknown strings.

### 11.1 `connection`

```ts
interface ConnectionState {
  connected: boolean;
  status: string;
  tickRate: number;
  framesDropped: number;
  simulatorWindow: {
    processRunning: boolean;
    windowFound: boolean;
    isVisible: boolean;
    isMinimized: boolean;
    isForeground: boolean;
  };
}
```

| Field | Meaning |
|---|---|
| `connected` | Telemetry bridge currently has a source. |
| `status` | Human-readable diagnostic status; do not parse as a stable enum. |
| `tickRate` | Source telemetry tick rate. |
| `framesDropped` | Reported dropped frame count. |
| `processRunning` | iRacing process detected. |
| `windowFound` | Simulator window handle found. |
| `isVisible` | Window visible. |
| `isMinimized` | Window minimized. |
| `isForeground` | Simulator is the foreground window. |

Use window state only when the module genuinely needs it. The host already applies overlay auto-hide policy.

### 11.2 `session`

```ts
interface SessionState {
  sessionNumber: number;
  state: number;
  sessionType: string;
  sessionName: string;
  eventType: string;
  trackName: string;
  trackLengthMeters: number;
  timeRemainingSeconds: number;
  hasTimeLimit: boolean;
  lapsRemaining: number;
  hasLapLimit: boolean;
  flags: number;
  isReplayPlaying: boolean;
  isInGarage: boolean;
}
```

| Field | Unit / meaning |
|---|---|
| `sessionNumber` | Current session index; `-1` may mean unavailable. |
| `state` | Raw numeric session state. Treat as opaque unless you maintain a mapping. |
| `sessionType` | Examples: Practice, Qualifying, Race. Use case-insensitive matching and tolerate unknown values. |
| `sessionName` | User-facing session name. |
| `eventType` | Event type from session metadata. |
| `trackName` | Display name of the track. |
| `trackLengthMeters` | Track length in metres; `0` if unavailable. |
| `timeRemainingSeconds` | Remaining seconds only when `hasTimeLimit` is true. |
| `hasTimeLimit` | Whether the session has a meaningful time limit. |
| `lapsRemaining` | Remaining laps only when `hasLapLimit` is true. |
| `hasLapLimit` | Whether the session has a meaningful lap limit. |
| `flags` | Raw iRacing session-flags bitmask. Do not infer a single flag by numeric equality. |
| `isReplayPlaying` | Replay playback detected. |
| `isInGarage` | Player is in garage state. |

ApexHUD normalizes iRacing unlimited sentinels. When a limit is absent, the value is `0` and the matching `has*Limit` flag is `false`.

### 11.3 `player`

```ts
interface PlayerState {
  carIndex: number;
  name: string;
  carNumber: string;
  position: number;
  classPosition: number;
  lap: number;
  lapDistancePercent: number;
  speedMetersPerSecond: number;
  fuelLiters: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isOnTrack: boolean;
}
```

| Field | Unit / meaning |
|---|---|
| `carIndex` | iRacing car index; `-1` if unavailable. Use this as the strongest identity key. |
| `name` | Driver display name. |
| `carNumber` | Car number as text. |
| `position` | Reconciled overall position. `0` means unavailable. |
| `classPosition` | Reconciled class position. `0` means unavailable. |
| `lap` | Current lap counter. |
| `lapDistancePercent` | Current lap progress, clamped to `0..1`. |
| `speedMetersPerSecond` | Speed in m/s. Multiply by `3.6` for km/h or `2.236936` for mph. |
| `fuelLiters` | Fuel level in litres. |
| `lastLapSeconds` | Last lap in seconds; `0` if unavailable. |
| `bestLapSeconds` | Best lap in seconds; `0` if unavailable. |
| `incidentCount` | Current session incident total. |
| `onPitRoad` | Player is on pit road. |
| `isOnTrack` | Player is considered on track. |

### 11.4 `vehicle`

```ts
interface VehicleState {
  speedMetersPerSecond: number;
  gear: number;
  rpm: number;
  shiftLightFirstRpm?: number;
  shiftRpm: number;
  shiftLightLastRpm?: number;
  shiftLightBlinkRpm?: number;
  throttle: number;
  brake: number;
  clutch: number;
  steeringWheelAngleRadians: number;
  onPitRoad: boolean;
  trackSurface: number;
}
```

| Field | Unit / meaning |
|---|---|
| `speedMetersPerSecond` | Vehicle speed in m/s. |
| `gear` | Raw iRacing gear value; normally `-1` reverse, `0` neutral, positive forward gears. |
| `rpm` | Current engine RPM. |
| `shiftLightFirstRpm` | Car-specific RPM where shift lights begin; may be missing or `0`. |
| `shiftRpm` | Car-specific recommended shift threshold; may be `0` if unknown. |
| `shiftLightLastRpm` | Last solid shift-light threshold; may be missing or `0`. |
| `shiftLightBlinkRpm` | Car-specific blink threshold; may be missing or `0`. |
| `throttle` | `0..1`. |
| `brake` | `0..1`. |
| `clutch` | `0..1`. |
| `steeringWheelAngleRadians` | Signed steering angle in radians. If your visual gauge uses the opposite screen direction, invert only at presentation time. |
| `onPitRoad` | Vehicle on pit road. |
| `trackSurface` | Raw numeric track-surface value. Treat as opaque unless mapped. |

Shift threshold fallback recommendation:

```js
const shift = positive(vehicle.shiftRpm) || positive(vehicle.shiftLightLastRpm);
const first = positive(vehicle.shiftLightFirstRpm) || shift * 0.86;
const blink = positive(vehicle.shiftLightBlinkRpm) || shift * 1.04;
```

Do not flash a gear indicator far below the car-provided blink threshold.

### 11.5 `timing`

```ts
interface TimingState {
  currentLap: number;
  completedLaps: number;
  currentLapSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  deltaToBestSeconds: number;
  deltaAvailable: boolean;
  currentLapValid: boolean;
  validity: "valid" | "invalid" | "unavailable" | string;
}
```

| Field | Meaning |
|---|---|
| `currentLap` | Current lap number. |
| `completedLaps` | Completed lap count. |
| `currentLapSeconds` | Current lap elapsed time; `0` if unavailable. |
| `lastLapSeconds` | Last lap; `0` if unavailable. |
| `bestLapSeconds` | Best lap; `0` if unavailable. |
| `deltaToBestSeconds` | Signed personal delta to best lap. Negative means ahead/faster. |
| `deltaAvailable` | Whether delta is currently valid and has a reference. |
| `currentLapValid` | Convenience boolean true only for `valid`. |
| `validity` | `valid`, `invalid`, or `unavailable`; accept future strings. |

Do not display `0.000` as a real delta when `deltaAvailable` is false.

### 11.6 `fuel`

```ts
interface FuelState {
  levelLiters: number;
  usePerHourLiters: number;
  estimatedPerLapLiters: number;
  estimatedLapsRemaining: number;
  requiredToFinishLiters: number;
  addToFinishLiters: number;
  samples: number;
  estimateReady: boolean;
}
```

| Field | Meaning |
|---|---|
| `levelLiters` | Current fuel level. |
| `usePerHourLiters` | Instant/source consumption estimate per hour. |
| `estimatedPerLapLiters` | Learned average consumption per lap. |
| `estimatedLapsRemaining` | Estimated laps available with current fuel. |
| `requiredToFinishLiters` | Estimated fuel required to finish. |
| `addToFinishLiters` | Estimated amount to add. |
| `samples` | Number of accepted learning samples. |
| `estimateReady` | Whether the estimate is considered ready for display. |

Use a calm learning state until `estimateReady` is true.

### 11.7 `radar`

```ts
interface RadarState {
  spotterState: string;
  active: boolean;
  contacts: RadarContact[];
}

interface RadarContact {
  carIndex: number;
  side: "left" | "right" | "unknown" | string;
  longitudinalMeters: number;
  closingSpeedMetersPerSecond: number;
  overlap: number;
  threat: "nearby" | "warning" | "critical" | "fast-approach" | string;
  confidence: number;
  isApproaching: boolean;
}
```

| Field | Meaning |
|---|---|
| `spotterState` | Normalized spotter state such as `clear`, `car-left`, `car-right`, `both-sides`, `two-left`, `two-right`, `off`. |
| `active` | At least one side requirement or candidate contact exists. |
| `carIndex` | Opponent car index. Negative values may represent synthetic contacts when iRacing reports a side contact but the car cannot be confidently matched. |
| `side` | Left, right, or unknown. |
| `longitudinalMeters` | Approximate signed distance along the track. Positive is ahead; negative is behind. |
| `closingSpeedMetersPerSecond` | Positive means absolute separation is decreasing. |
| `overlap` | Approximate `0..1` side-by-side depth, not geometric world-space overlap. |
| `threat` | Normalized severity. Accept unknown future values. |
| `confidence` | Approximate association confidence. |
| `isApproaching` | Contact is behind and closing above the current threshold. |

The current iRacing SDK feed does not expose all opponents' exact world X/Y/orientation through this module protocol. Radar geometry is an approximation based on spotter state and lap progress.

### 11.8 `relative`

```ts
interface RelativeState {
  entries: RelativeEntry[];
}

interface RelativeEntry {
  carIndex: number;
  carNumber: string;
  driverName: string;
  carClassName: string;
  position: number;
  relation: "ahead" | "behind" | string;
  distanceMeters: number;
  estimatedGapSeconds: number;
  onPitRoad: boolean;
  isPlayer: boolean;
}
```

| Field | Meaning |
|---|---|
| `entries` | Up to 12 nearest non-player cars within the engine's relative window. |
| `relation` | Ahead or behind by wrapped lap progress. |
| `distanceMeters` | Signed distance; positive ahead, negative behind. |
| `estimatedGapSeconds` | Approximation based on current player speed, not official timing. |
| `position` | Current overall position when available. |

Relative data is for spatial awareness. Do not present `estimatedGapSeconds` as an official scoring gap.

### 11.9 `standings`

```ts
interface StandingsState {
  mode: "overall" | "class" | string;
  entries: StandingEntry[];
}

interface StandingEntry {
  carIndex: number;
  position: number;
  classPosition: number;
  carNumber: string;
  driverName: string;
  teamName: string;
  carClassId: number;
  carClassName: string;
  iRating: number;
  license: string;
  lap: number;
  lapDistancePercent: number;
  gapToLeaderSeconds: number;
  intervalSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isPlayer: boolean;
  status: "running" | "pit" | "out" | string;
}
```

| Field | Meaning |
|---|---|
| `position` | Compact overall rank after stale/non-participating roster entries are removed. |
| `classPosition` | Compact rank within `carClassId`. |
| `carClassId` | Strong class grouping key. |
| `carClassName` | Display label. |
| `lap` | Best available lap/progress counter. |
| `lapDistancePercent` | `0..1`. |
| `gapToLeaderSeconds` | In races, scoring gap when available; in practice/qualifying, deficit to the fastest best lap. `0` can mean leader or unavailable. |
| `intervalSeconds` | Gap to the preceding row in the published ordering; `0` can mean unavailable. |
| `lastLapSeconds` | `0` if unavailable. |
| `bestLapSeconds` | `0` if unavailable. |
| `incidentCount` | Available incident count; opponent values may depend on session results. |
| `isPlayer` | Host identity flag. Also compare `carIndex` with `player.carIndex` as a fallback. |
| `status` | `running`, `pit`, `out`, or future string. |

Race positions are stabilized for approximately 350 ms to suppress one-frame timing-line jumps. Practice and qualifying are ordered primarily by best lap.

### Detecting multiclass

```js
function classCount(entries) {
  return new Set(
    entries
      .filter((entry) => Number.isFinite(entry.carClassId))
      .map((entry) => entry.carClassId)
  ).size;
}
```

Use `carClassId` for grouping and `carClassName` for display.

---

## 12. Data semantics and defensive rendering

### Unavailable numeric data

ApexHUD frequently uses `0` for unavailable positive measurements such as lap times and shift thresholds. Check context flags where available:

```js
function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
```

### Do not parse human-readable strings as enums

Fields such as `connection.status`, `sessionName`, `eventType` and driver/team names are display strings.

### Accept future enum values

Use defaults:

```js
const severityClass = {
  nearby: "nearby",
  warning: "warning",
  critical: "critical",
  "fast-approach": "approach",
}[contact.threat] || "unknown";
```

### Player identity

Recommended fallback chain:

```js
const playerEntry = entries.find((entry) =>
  entry.isPlayer || entry.carIndex === player.carIndex
);
```

Do not identify a driver only by name.

### Format lap times

```js
function formatLap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}
```

### Format gaps

```js
function formatGap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return `+${seconds.toFixed(seconds < 10 ? 3 : 1)}`;
}
```

---

## 13. Visibility and edit mode

Respond to `apex:visibility`.

Recommended behavior:

- Hide the root when `visible` is false.
- Stop timers, animations and heavy calculations.
- Preserve state so the module can resume immediately.
- In edit mode, show a stable representative empty state instead of collapsing to zero size.
- Do not render your own edit border; ApexHUD supplies editor chrome.
- Do not use edit mode to persist data.

Example:

```js
let visible = true;

function setVisibility(message) {
  visible = Boolean(message.visible);
  document.documentElement.classList.toggle("module-hidden", !visible);

  if (!visible) {
    stopAnimation();
  } else {
    resumeAnimation();
  }
}
```

---

## 14. Multiple instances and persisted state

Every iframe instance receives a unique `instanceId` in `apex:init`.

### Rules

- Keep all runtime state inside the iframe instance.
- Never assume settings are global per module ID.
- Avoid shared browser storage.
- If you log diagnostics, include `instanceId` when useful.
- Duplicate instances can request the same scopes and receive the same frames independently.

Example:

```js
let instanceId = "unknown";

if (message.type === "apex:init") {
  instanceId = String(message.instanceId || "unknown");
}
```

---

## 15. Base Layout inheritance

ApexHUD layouts use a Base Layout and child session layouts:

```text
Base Layout
Test Drive
Practice
Qualifying
Race
Replay
```

Module developers do not need custom inheritance code, but must understand persistence effects.

### Behavior

- A module placed in Base Layout is inherited by child layouts.
- A child layout may override bounds, settings, z-index or enabled state.
- Removing an inherited module in a child creates a tombstone, so it is not re-added there.
- Adding a new instance to Base Layout adds it to children that did not explicitly remove that instance.
- A module placed only in a child is local to that child.
- Copying layouts materializes the source and stores appropriate target overrides.

### Implications for module updates

- Changing JavaScript/CSS affects all instances immediately after reload.
- Changing `defaultBounds` affects only newly created instances.
- Changing manifest defaults affects only newly created instances.
- Existing per-instance settings remain persisted.
- Adding a new manifest setting requires a code fallback because old instances may not contain it.

---

## 16. Rendering and performance

The telemetry service broadcasts at 30 Hz by default. Most UI does not need 30 full DOM rebuilds per second.

### Recommended update rates

| UI type | Suggested rate |
|---|---:|
| Gear, RPM, pedals, radar | 20–30 Hz |
| Delta bar | 20–30 Hz |
| Relative movement | 10–20 Hz |
| Standings table | 5–10 Hz |
| Session clock | 4–10 Hz |
| Static labels/settings | only when changed |

### Reuse DOM nodes

Bad:

```js
root.innerHTML = buildEntireTable(entries);
```

on every frame.

Better:

- Create stable rows once.
- Update text nodes and CSS variables.
- Key rows by `carIndex`.
- Remove/create rows only when roster composition changes.

### Use sequence and throttling

```js
let lastPaintAt = 0;
let pendingPayload;

function onFrame(message) {
  pendingPayload = message.payload;
  const now = performance.now();
  if (now - lastPaintAt < 100) return; // 10 Hz
  lastPaintAt = now;
  render(pendingPayload);
}
```

For smooth motion, store the latest data and paint with `requestAnimationFrame`.

### Prefer compositor-friendly changes

Use:

- `transform`;
- `opacity`;
- CSS variables;
- SVG attribute updates;
- fixed geometry.

Avoid:

- repeated layout measurements inside loops;
- large box shadows and blur;
- synchronous heavy sorting every frame;
- unbounded arrays;
- continuous decorative animations.

### Bound history buffers

```js
history.push(sample);
if (history.length > maximumSamples) {
  history.splice(0, history.length - maximumSamples);
}
```

### Pause while hidden

`visible=false` should stop animation frames and timers whenever possible.

---

## 17. Racing-focused UX and visual design

A racing HUD is consumed through peripheral vision. It should communicate state before the driver consciously reads text.

### Information hierarchy

1. One primary value.
2. One state color or shape.
3. Optional compact context.
4. Details only when necessary.

### Good glanceable design

- Large stable gear number.
- Large position with a small class/overall qualifier.
- Three-row battle box instead of a 20-row table.
- Fixed-width gap columns.
- Strong player highlight.
- Short labels.
- Color changes tied to a real action threshold.

### Poor driving design

- Long paragraphs.
- Small low-contrast text.
- Multiple equally prominent values.
- Constant motion.
- Decorative gradients competing with data.
- A large header consuming useful bounds.
- Color changes that happen too early and produce false urgency.

### Native ApexHUD visual language

Base colors:

```text
Panel:          rgba(0,0,0,.90)
Primary text:   #f5f5f5
Secondary text: rgba(255,255,255,.55)
Player/action:  #f2c94c
Positive:       #36c96b
Negative:       #ef4444
Neutral blue:   #179fc4
```

Typography:

```css
font-family: "Bahnschrift", "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
font-variant-numeric: tabular-nums;
```

Guidelines:

- Keep panel opacity approximately 0.82–0.94.
- Use 0–3 px outer radius for timing equipment styling.
- Avoid glow, bloom and backdrop blur.
- Keep rows compact and column widths stable.
- Truncate long names with ellipsis.
- Do not use color as the only critical-state signal.
- Test on bright sky, grass, dark cockpit and night scenes.
- Empty state must be calm and explicit.

### Responsive CSS

Use container-relative sizing:

```css
.value {
  font-size: clamp(24px, 28cqh, 58px);
}

.name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

Keep the widget usable at `minimumSize` and at wider user-defined bounds.

---

## 18. Localization

### Module content

A module may bundle its own translations and choose them from `navigator.language`:

```js
const locale = String(navigator.language || "en").toLowerCase();
const language = locale.startsWith("ru") ? "ru" : "en";
```

Bundle all translations locally.

### Manifest settings localization

ApexHUD 0.10.0 manifest schema has one `name`, `description`, `label` and `help` string. The host does not currently support localized manifest string maps and does not send the selected Control Center locale in `apex:init`.

Recommendations:

- Use clear international English for Community manifest labels.
- Localize visible module content internally if needed.
- Do not dynamically change manifest settings labels at runtime; the settings UI belongs to the host.

---

## 19. Security and CSP

### Recommended CSP

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';"
/>
```

This requires external local JS/CSS files rather than inline scripts/styles.

### Security rules

- Never execute strings with `eval` or `new Function`.
- Never import remote scripts.
- Never load remote fonts.
- Avoid network access entirely.
- Treat all telemetry text as untrusted display data and assign it through `textContent`.
- If HTML generation is necessary, escape names and labels.
- Validate incoming message shape.
- Check `event.source === window.parent`.
- Limit diagnostic log size and frequency.
- Do not include tokens, credentials or private endpoints in the package.

### Safe text rendering

```js
nameElement.textContent = String(entry.driverName || "Unknown");
```

Avoid:

```js
nameElement.innerHTML = entry.driverName;
```

### Sandbox is not a trust guarantee

A module remains executable JavaScript. Review third-party source before installation. The sandbox removes Node/Electron/filesystem privileges, but it does not make arbitrary code trustworthy.

---

## 20. Development workflow

### Requirements for the ApexHUD repository

```text
Node.js >= 22.12
npm >= 10
.NET 8 SDK for the telemetry service
```

### Install dependencies

```powershell
npm ci --include=dev --foreground-scripts
```

### Run development mode

```powershell
.\scripts\dev.ps1
```

### Validate protocol and manifests

```powershell
npm run verify
```

Or the narrower manifest verification:

```powershell
npm --workspace @apexhud/protocol run build
node .\scripts\verify-manifests.mjs
```

The repository verifier scans built-in folders under `modules/` and skips names beginning with `_`. Local user modules are validated by the application when the catalog is reloaded.

### Recommended local iteration loop

1. Edit files.
2. Reload the module catalog if the manifest/package structure changed.
3. Remove and re-add the instance only when testing new manifest defaults.
4. Open the visual editor.
5. Test at minimum and large sizes.
6. Test with mock telemetry.
7. Test with live iRacing.
8. Inspect Electron DevTools console for `[module:<id>]` logs.

### Visual preview

The repository command:

```powershell
npm run preview:modules
```

opens a visual harness for built-in modules. Treat it as a styling preview, not a substitute for real host lifecycle, sandbox, persistence or live telemetry testing. For a custom module, either add it temporarily to the preview page or test it in the actual ApexHUD editor.

### Test protocol mismatch explicitly

A robust module should show a clear unavailable state instead of throwing when it receives an unsupported protocol version.

---

## 21. Testing checklist

### Lifecycle

- [ ] Loads with no telemetry.
- [ ] Handles `source: none`.
- [ ] Handles mock source.
- [ ] Handles live source.
- [ ] Applies `apex:init` settings.
- [ ] Applies later `apex:settings` updates.
- [ ] Hides and pauses on `visible=false`.
- [ ] Renders a stable edit-mode state.
- [ ] Survives iframe reload.

### Data

- [ ] Handles all requested scopes missing from an unexpected test payload.
- [ ] Handles `0`, negative and non-finite values defensively.
- [ ] Handles unknown enum strings.
- [ ] Handles long driver/team/track names.
- [ ] Identifies player by `carIndex` fallback.
- [ ] Handles single-class and multiclass sessions.
- [ ] Handles pit and out statuses.
- [ ] Handles empty standings/relative/radar arrays.

### Layout

- [ ] Works at declared `minimumSize`.
- [ ] Works at 1920×1080.
- [ ] Works at 2560×1440.
- [ ] Works on ultrawide aspect ratios.
- [ ] Works with two instances simultaneously.
- [ ] Does not display editor chrome in race mode.
- [ ] Does not overflow its iframe.

### Visual

- [ ] Readable against bright and dark scenery.
- [ ] Primary information is recognizable through peripheral vision.
- [ ] Important columns do not shift.
- [ ] Color state has a secondary shape/text cue where critical.
- [ ] No decorative pulsing, glow or blur.
- [ ] No full white or opaque accidental background.

### Performance

- [ ] No unbounded history arrays.
- [ ] No full table rebuild at 30 Hz without a reason.
- [ ] No console log per frame.
- [ ] Timers stop while hidden.
- [ ] CPU usage remains stable during a long session.

### Packaging

- [ ] Manifest passes validation.
- [ ] Entry file exists.
- [ ] All paths are relative.
- [ ] Module works offline.
- [ ] No `node_modules`.
- [ ] No secrets or machine-specific paths.
- [ ] Preview is present and below 2.5 MB for Community publishing.
- [ ] License and README are included.

---

## 22. Community catalog publishing

Default catalog:

```text
https://github.com/EugeneK32/apexhud-community-modules.git
```

Default branch:

```text
main
```

### Supported catalog layouts

Root folders:

```text
repository/
  module-a/
    manifest.json
  module-b/
    manifest.json
```

Or under `modules/`:

```text
repository/
  modules/
    module-a/
      manifest.json
    module-b/
      manifest.json
```

Only immediate child directories are scanned. Module folders may be normal directories or Git submodules.

### Recommended module repository structure

```text
manifest.json
index.html
style.css
module.js
preview.webp
README.md
LICENSE
```

When the catalog repository uses Git submodules, each submodule root should be the module root containing `manifest.json`.

### Preview

Recommended:

```text
preview.webp
960 × 540
16:9
<= 2.5 MB
```

Recognized catalog paths:

```text
preview.webp
preview.png
preview.jpg
preview.jpeg
assets/preview.webp
assets/preview.png
assets/preview.jpg
```

Use root-level `preview.webp` for maximum compatibility.

The preview is shown in the catalog/library and is not loaded into the race overlay unless your HTML references it.

### Installation behavior

- The catalog is shallow-cloned and submodules are initialized recursively.
- Installation copies module files into the user module directory.
- `.git` directories are excluded.
- ApexHUD writes `.apexhud-community.json` to mark the installed source.
- Update replaces the installed module directory atomically.
- Uninstall removes only the installed copy, not the catalog cache.
- Automatic update checks can run after startup and every six hours.

### Version comparison

Current update comparison is numeric and simple. It splits the version on `.`, `+` and `-`, then compares integer components.

Recommended:

```text
1.0.0
1.1.0
2.0.0
```

Avoid relying on strict SemVer prerelease ordering such as:

```text
1.0.0-beta.10
```

### Git branch requirements

The configured branch must exist remotely, for example `origin/main`. If a repository uses another default branch, users must configure it or the catalog must be changed.

### Community review recommendations

- Unique reverse-DNS ID owned by the author.
- Clear screenshot/preview.
- Source available.
- No minified-only opaque release without source.
- Strict CSP.
- Offline operation.
- No telemetry exfiltration.
- Changelog for user-visible updates.

---

## 23. Versioning and compatibility

### Protocol version

ApexHUD 0.10.0 sends protocol version `5` in `apex:init` and `apex:frame`.

A module should:

- ignore unknown object fields;
- validate fields it uses;
- handle unsupported protocol versions calmly;
- document its minimum ApexHUD version.

Suggested README metadata:

```text
Requires ApexHUD 0.10.0 or later (telemetry protocol v5).
```

### Manifest version

`schemaVersion` is independent from telemetry protocol version.

Current values:

```text
manifest schema: 1
telemetry protocol: 5
```

### Module version

Use numeric SemVer-like versions:

```text
MAJOR.MINOR.PATCH
```

- MAJOR: incompatible behavior/settings changes.
- MINOR: new features and backward-compatible settings.
- PATCH: bug fixes and visual corrections.

### Settings compatibility

To preserve existing layouts:

- Do not change `manifest.id` after publication.
- Avoid renaming setting keys.
- Keep value types stable.
- Accept older values in code when practical.
- Add defaults internally for new keys.

### Entry path compatibility

Changing `entry` is allowed in a new package version as long as the file exists. The host reloads the manifest and URL.

---

## 24. Complete example module

A complete `Battle Focus` example is included next to this guide:

```text
docs/examples/battle-focus/
```

It demonstrates:

- a valid manifest;
- `player`, `session` and `standings` scopes;
- per-instance settings;
- protocol v5 handling;
- player identity fallback;
- automatic single-class/multiclass behavior;
- stable three-row DOM updates;
- visibility handling;
- defensive number formatting;
- native-style glanceable CSS;
- strict CSP.

Install it by copying the whole folder into the user module directory and reloading the module catalog.

---

## 25. Troubleshooting

### Module does not appear in the library

Check:

1. The module is an immediate child directory of the modules root.
2. Folder name does not begin with `_`.
3. `manifest.json` is valid JSON.
4. `schemaVersion` is `1`.
5. `id` is valid lowercase reverse-DNS.
6. `scopes` is non-empty and supported.
7. `entry` exists.
8. There is no duplicate ID.
9. Reload modules or restart ApexHUD.
10. Check the main-process console for `[modules]` warnings.

### Module appears but is blank

Check:

- HTML references local CSS/JS correctly.
- CSP permits those local files.
- `html` and `body` have non-zero size.
- JavaScript has no syntax error.
- The module handles init before telemetry.
- The requested scope is declared in the manifest.
- The root was not hidden by stale visibility state.

Basic CSS:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}
```

### White background appears

Explicitly set every root layer transparent:

```css
html,
body,
#app,
.widget-root {
  background: transparent !important;
}
```

Also remove default canvas fills and clear canvas with:

```js
ctx.clearRect(0, 0, canvas.width, canvas.height);
```

Do not draw a placeholder panel in normal runtime unless the design requires one.

### Settings do not update

- Handle both `apex:init` and `apex:settings`.
- Merge with defaults.
- Convert numeric strings defensively only if your own code introduced them.
- Apply CSS variables after each update.

### New setting is undefined on an old layout

Expected behavior. Existing instances preserve their old settings object. Add an internal fallback default.

### Changing `defaultBounds` has no effect

Expected for existing instances. Remove/re-add the instance or reset the layout when testing defaults.

### Preview does not show in Community

Use:

```text
preview.webp
```

at the module root. Verify:

- file is committed and pushed;
- configured branch contains it;
- file is below 2.5 MB;
- catalog was updated correctly;
- repository/submodule pointer was updated if using submodules.

### Module update is not detected

- Increase `manifest.version` numerically.
- Push the catalog repository or update the submodule commit.
- Check the configured branch.
- Run **Check updates**.

### Telemetry field is missing

- Confirm the required scope is declared.
- Confirm protocol v5.
- Treat partial test payloads defensively.
- Inspect `/snapshot` from the telemetry service during development if necessary.

### Positions jump unexpectedly

Use `standings.position` for official ordered display rather than sorting solely by `lap + lapDistancePercent`. Progress values do not update atomically at the timing line.

### Relative gap differs from scoring gap

Expected. `relative.estimatedGapSeconds` is a spatial estimate. Use standings gaps for scoring/timing presentation.

---

## 26. Current API limitations

As of ApexHUD 0.10.0, public module API does not provide:

- exact opponent world X/Y coordinates or orientation;
- track map geometry;
- corner definitions;
- full historical telemetry storage;
- module-initiated layout changes;
- module-initiated settings persistence;
- arbitrary host commands;
- localized manifest string maps;
- a negotiated protocol capability API;
- an official npm SDK package for module code;
- guaranteed browser storage;
- direct network permissions as a supported feature.

Modules should not emulate missing APIs through unsupported Electron or filesystem access.

---

## 27. Release checklist

Before publishing:

### Identity and compatibility

- [ ] Stable unique module ID.
- [ ] Version increased.
- [ ] Minimum ApexHUD/protocol documented.
- [ ] Existing setting keys preserved.

### Manifest

- [ ] Schema version 1.
- [ ] User-facing name and description.
- [ ] Only required scopes requested.
- [ ] Bounds valid.
- [ ] Minimum size tested.
- [ ] Settings validated.

### Runtime

- [ ] Protocol v5 handled.
- [ ] Init, frame, settings and visibility handled.
- [ ] Unknown values handled.
- [ ] Multiple instances work.
- [ ] No browser storage dependency.

### Visual

- [ ] Glanceable while driving.
- [ ] Readable on bright and dark scenes.
- [ ] Stable geometry.
- [ ] No accidental white background.
- [ ] No excessive animation/glow/blur.

### Performance

- [ ] Bounded memory.
- [ ] Sensible render rate.
- [ ] Hidden state pauses work.
- [ ] No per-frame logging.

### Security

- [ ] Strict CSP.
- [ ] No remote dependencies.
- [ ] No eval.
- [ ] Untrusted text uses `textContent`.
- [ ] No secrets.

### Community package

- [ ] `preview.webp` present.
- [ ] Preview <= 2.5 MB.
- [ ] README and LICENSE included.
- [ ] Catalog/submodule commit updated.
- [ ] Install and update tested from the catalog.

---

## Canonical source references

For the exact implementation in ApexHUD 0.10.0, consult:

```text
packages/protocol/src/index.ts
apps/desktop/src/main/moduleCatalog.ts
apps/desktop/src/main/communityModuleService.ts
apps/desktop/src/renderer/overlay/index.ts
services/telemetry/Models/TelemetrySnapshot.cs
services/telemetry/Processing/TelemetryProcessor.cs
modules/_template/
docs/VISUAL_SYSTEM.md
```

The TypeScript definitions in `packages/protocol/src/index.ts` are the primary machine-readable contract.


---

# Русская версия

# Руководство по разработке модулей ApexHUD

**Целевая версия:** ApexHUD 0.10.0  
**Версия протокола телеметрии:** v5  
**Версия схемы manifest:** v1  
**Язык:** русский

Этот документ описывает полный публичный контракт модулей, реализованный в ApexHUD 0.10.0. Здесь разобраны локальные и встроенные модули, публикация в Community-каталоге, схема `manifest.json`, сообщения host-приложения, все telemetry scopes, настройки, наследование раскладок, безопасность, производительность, тестирование, визуальная система, совместимость и диагностика проблем.

> Модуль ApexHUD — это статическое веб-приложение, которое отображается внутри sandboxed iframe. Обычно модуль состоит из `manifest.json`, HTML entry point, CSS, JavaScript и локальных ресурсов. Сборщик необязателен.

---

## Содержание

1. [Основные понятия](#1-основные-понятия)
2. [Быстрый старт](#2-быстрый-старт)
3. [Расположение модулей и правила обнаружения](#3-расположение-модулей-и-правила-обнаружения)
4. [Рекомендуемая структура проекта](#4-рекомендуемая-структура-проекта)
5. [Полная справка по manifest](#5-полная-справка-по-manifest)
6. [Настройки модуля](#6-настройки-модуля)
7. [Runtime и модель sandbox](#7-runtime-и-модель-sandbox)
8. [Сообщения host → module](#8-сообщения-host--module)
9. [Сообщения module → host](#9-сообщения-module--host)
10. [Надёжный обработчик сообщений](#10-надёжный-обработчик-сообщений)
11. [Справочник telemetry scopes](#11-справочник-telemetry-scopes)
12. [Семантика данных и защитный рендеринг](#12-семантика-данных-и-защитный-рендеринг)
13. [Видимость и режим редактирования](#13-видимость-и-режим-редактирования)
14. [Несколько экземпляров и сохранение состояния](#14-несколько-экземпляров-и-сохранение-состояния)
15. [Наследование Base Layout](#15-наследование-base-layout)
16. [Рендеринг и производительность](#16-рендеринг-и-производительность)
17. [Гоночный UX и визуальный дизайн](#17-гоночный-ux-и-визуальный-дизайн)
18. [Локализация](#18-локализация)
19. [Безопасность и CSP](#19-безопасность-и-csp)
20. [Рабочий процесс разработки](#20-рабочий-процесс-разработки)
21. [Чек-лист тестирования](#21-чек-лист-тестирования)
22. [Публикация в Community-каталоге](#22-публикация-в-community-каталоге)
23. [Версионирование и совместимость](#23-версионирование-и-совместимость)
24. [Полноценный пример модуля](#24-полноценный-пример-модуля)
25. [Диагностика проблем](#25-диагностика-проблем)
26. [Текущие ограничения API](#26-текущие-ограничения-api)
27. [Чек-лист релиза](#27-чек-лист-релиза)

---

## 1. Основные понятия

### Пакет модуля

Пакет модуля — это отдельная директория с валидным `manifest.json` и всеми файлами, необходимыми для работы виджета. ApexHUD не требует npm, React или сборщика. Framework допустим, если результатом сборки являются статические и полностью автономные файлы.

### Описание модуля и экземпляр модуля

**Описание модуля** — пакет, идентифицируемый полем `manifest.id`.

**Экземпляр модуля** — конкретная размещённая копия модуля в HUD-раскладке. Одновременно может существовать несколько экземпляров одного модуля. У каждого экземпляра независимы:

- `instanceId`;
- положение и размер;
- признак включения;
- z-index;
- настройки.

Нельзя считать, что пользователь добавит ваш модуль только один раз.

### Host

Host — Electron-приложение ApexHUD. Оно:

- обнаруживает пакеты модулей;
- валидирует manifest;
- создаёт sandboxed iframe;
- строит интерфейс настроек из manifest;
- отправляет телеметрию и lifecycle-сообщения;
- сохраняет раскладки и настройки экземпляров.

### Scopes

Scope — именованный раздел телеметрии. Модуль перечисляет необходимые scopes в manifest. Host отправляет только эти объекты и обязательное поле `payload.source`.

Запрашивайте минимальный набор scopes, который действительно используется.

### Раскладки

Модуль не управляет раскладкой напрямую. ApexHUD отвечает за размещение, изменение размера, дублирование, наследование, удаление и сохранение.

---

## 2. Быстрый старт

### Вариант A: разработка внутри исходников ApexHUD

Скопируйте шаблон:

```powershell
Copy-Item .\modules\_template .\modules\my-widget -Recurse
```

Измените файлы:

```text
modules/my-widget/manifest.json
modules/my-widget/index.html
modules/my-widget/style.css
modules/my-widget/module.js
```

Запустите ApexHUD:

```powershell
npm install
.\scripts\dev.ps1
```

После изменения manifest или структуры пакета перезагрузите каталог модулей в Control Center.

### Вариант B: локальный пользовательский модуль

Надёжнее всего открыть правильную папку через интерфейс:

1. Откройте ApexHUD Control Center.
2. Перейдите в **Мои виджеты / Библиотека**.
3. Откройте меню `···`.
4. Выберите **Открыть папку модулей**.

В текущей Windows-сборке путь обычно выглядит примерно так:

```text
%APPDATA%\@apexhud\desktop\modules
```

Не зашивайте этот путь в установщики. ApexHUD использует Electron `app.getPath("userData")`, поэтому точная директория может измениться вместе с package identity или платформой.

Скопируйте туда папку модуля, перезагрузите каталог, откройте визуальный редактор и добавьте виджет.

### Минимальный пакет

```text
my-widget/
  manifest.json
  index.html
  style.css
  module.js
```

---

## 3. Расположение модулей и правила обнаружения

ApexHUD сканирует два источника:

1. Встроенные модули.
2. Пользовательские модули.

### В режиме разработки

```text
<repository>/modules/
<user-data>/modules/
```

### В собранном приложении

```text
<application-resources>/modules/
<user-data>/modules/
```

### Правила обнаружения

- Сканируются только непосредственные дочерние директории.
- Папки, начинающиеся с `_`, игнорируются.
- `manifest.json` должен находиться в корне папки модуля.
- Файл из `entry` должен существовать и быть обычным файлом.
- Невалидные модули пропускаются, ошибка пишется в Electron console.
- После обнаружения модули сортируются по отображаемому имени.
- Сначала сканируются встроенные модули.
- При повторяющемся `manifest.id` используется первое найденное описание, остальные игнорируются.
- Пользовательский модуль не может переопределить встроенный, просто использовав его ID.
- Имя папки не обязано совпадать с ID, но логическое соответствие упрощает поддержку.

### Зарезервированные ID

Не используйте ID встроенных модулей:

```text
com.apexhud.dashboard
com.apexhud.delta
com.apexhud.fuel
com.apexhud.incidents
com.apexhud.inputs
com.apexhud.lap-times
com.apexhud.position
com.apexhud.race-control
com.apexhud.radar
com.apexhud.relative
com.apexhud.session
com.apexhud.standings
```

`com.apexhud.radar` дополнительно обрабатывается host-приложением особым образом и рисуется native radar renderer вместо обычного iframe.

---

## 4. Рекомендуемая структура проекта

```text
com.example.apexhud.battle-focus/
  manifest.json
  index.html
  style.css
  module.js
  preview.webp
  README.md
  LICENSE
  assets/
    icon.svg
```

Для модуля, собранного framework-сборщиком:

```text
com.example.apexhud.widget/
  manifest.json
  index.html
  assets/
    index-a1b2c3.js
    index-d4e5f6.css
  preview.webp
  README.md
  LICENSE
```

Требования:

- Все runtime-зависимости должны лежать внутри папки модуля.
- Используйте относительные URL.
- Не зависите от CDN.
- Не публикуйте `node_modules`.
- Не публикуйте source maps с секретами и абсолютными локальными путями.
- Не распространяйте файлы шрифтов.

---

## 5. Полная справка по manifest

ApexHUD 0.10.0 использует schema version `1`.

### Полный пример

```json
{
  "schemaVersion": 1,
  "id": "com.example.apexhud.battle-focus",
  "name": "Battle Focus",
  "description": "Shows the nearest car ahead, the player and the nearest car behind.",
  "version": "1.0.0",
  "author": "Example Racing",
  "entry": "index.html",
  "scopes": ["player", "session", "standings"],
  "defaultBounds": {
    "x": 0.76,
    "y": 0.38,
    "width": 0.21,
    "height": 0.22
  },
  "minimumSize": {
    "width": 300,
    "height": 170
  },
  "settings": [
    {
      "key": "mode",
      "label": "Cars to compare",
      "type": "select",
      "default": "auto",
      "options": [
        { "label": "Automatic", "value": "auto" },
        { "label": "Overall", "value": "overall" },
        { "label": "My class", "value": "class" }
      ]
    },
    {
      "key": "showNames",
      "label": "Show driver names",
      "type": "boolean",
      "default": true
    },
    {
      "key": "accent",
      "label": "Player highlight",
      "type": "color",
      "default": "#f2c94c"
    },
    {
      "key": "opacity",
      "label": "Panel opacity",
      "type": "range",
      "default": 0.92,
      "min": 0.3,
      "max": 1,
      "step": 0.05
    }
  ]
}
```

### Поля верхнего уровня

| Поле | Обязательно | Валидация и поведение |
|---|---:|---|
| `schemaVersion` | да | Строго `1`. |
| `id` | да | Reverse-DNS ID: строчные буквы, цифры и дефисы; минимум одна точка; не более 120 символов. Пример: `com.example.apexhud.widget`. |
| `name` | да | 1–80 символов. Показывается в редакторе и библиотеке. |
| `description` | да | 1–300 символов. Пишите для обычного пользователя, а не как внутреннее техническое описание. |
| `version` | да | 1–40 символов. Строгий SemVer не проверяется, но Community-обновления лучше работают с цифровыми версиями. |
| `author` | да | 1–100 символов. |
| `entry` | да | Безопасный относительный путь через `/`, максимум 240 символов. Запрещены ведущий `/`, обратный слеш, пустые компоненты, `.`, `..`, NUL. |
| `scopes` | да | Непустой массив поддерживаемых scopes. |
| `defaultBounds` | да | Начальные нормализованные координаты и размер. |
| `minimumSize` | нет | Ограничение размера в пикселях при resize. Каждое измерение — от 40 до 10 000. |
| `settings` | да | Массив из 0–64 полей настроек. |

### Формат ID

Валидно:

```text
com.example.apexhud.widget
io.github.username.apexhud.my-widget
ru.company.apexhud.fuel-helper
```

Невалидно:

```text
my-widget                  # нет точки
Com.Example.Widget         # верхний регистр
com.example.my_widget      # underscore
.com.example.widget        # точка в начале
com..example.widget        # пустая часть
```

### `defaultBounds`

Координаты нормализованы относительно экрана overlay:

```json
{
  "x": 0.72,
  "y": 0.12,
  "width": 0.20,
  "height": 0.18
}
```

Значения:

- `x`: отступ от левого края, `0..1`;
- `y`: отступ от верхнего края, `0..1`;
- `width`: доля ширины экрана;
- `height`: доля высоты экрана.

Правила:

- `x`, `y`: `0..1`;
- `width`, `height`: `0.01..1`;
- `x + width <= 1`;
- `y + height <= 1`.

В runtime bounds дополнительно нормализуются, а width/height ограничиваются минимумом `0.04`. Уже сохранённые экземпляры не перемещаются автоматически после изменения `defaultBounds`.

### `minimumSize`

```json
{
  "minimumSize": {
    "width": 280,
    "height": 140
  }
}
```

Ограничивает интерактивный resize. Это не гарантирует, что старые сохранённые раскладки автоматически увеличатся после обновления модуля. CSS должен оставаться адаптивным и защитным.

---

## 6. Настройки модуля

Визуальный редактор строит элементы управления напрямую из `manifest.settings`.

### Общие поля настройки

| Поле | Обязательно | Правила |
|---|---:|---|
| `key` | да | Начинается с буквы, далее буквы, цифры, `_`, `.`, `-`; максимум 64 символа; уникален внутри manifest. |
| `label` | да | 1–80 символов. |
| `type` | да | `boolean`, `range`, `number`, `color` или `select`. |
| `default` | да | Строка, конечное число или boolean соответствующего типа. |
| `min` | условно | Конечное число. Рекомендуется для `range` и `number`. |
| `max` | условно | Конечное число, не меньше `min`. |
| `step` | условно | Положительное конечное число. |
| `options` | для select | 1–50 вариантов с уникальными значениями. |
| `help` | нет | 1–240 символов. |

### Boolean

```json
{
  "key": "showNames",
  "label": "Show driver names",
  "type": "boolean",
  "default": true
}
```

### Range

```json
{
  "key": "opacity",
  "label": "Panel opacity",
  "type": "range",
  "default": 0.9,
  "min": 0.2,
  "max": 1,
  "step": 0.05
}
```

### Number

```json
{
  "key": "warningAt",
  "label": "Warning threshold",
  "type": "number",
  "default": 8,
  "min": 1,
  "max": 100,
  "step": 1
}
```

### Color

```json
{
  "key": "accent",
  "label": "Accent",
  "type": "color",
  "default": "#f2c94c"
}
```

Validator принимает hex-цвета длиной 3–8 цифр. Для предсказуемой работы color picker используйте шестизначный формат `#RRGGBB`.

### Select

```json
{
  "key": "mode",
  "label": "Position mode",
  "type": "select",
  "default": "auto",
  "options": [
    { "label": "Automatic", "value": "auto" },
    { "label": "Overall", "value": "overall" },
    { "label": "Class", "value": "class" }
  ]
}
```

Значения option могут быть строками или числами.

### Важное поведение сохранения

- Настройки сохраняются отдельно для каждого экземпляра.
- Defaults из manifest копируются при создании нового экземпляра.
- Изменение default в новой версии не перезаписывает пользовательские настройки старых экземпляров.
- После добавления нового setting старые экземпляры могут не содержать этот ключ.
- Всегда накладывайте сохранённые значения поверх внутренних defaults.
- Автоматической миграции удалённых или переименованных ключей нет.
- По возможности сохраняйте старые ключи либо поддерживайте оба имени в коде.

Рекомендуемый шаблон:

```js
const DEFAULTS = {
  accent: "#f2c94c",
  showNames: true,
  opacity: 0.92,
};

let settings = { ...DEFAULTS };

function applyIncomingSettings(value) {
  settings = { ...DEFAULTS, ...settings, ...(value || {}) };
}
```

---

## 7. Runtime и модель sandbox

Обычный модуль загружается в iframe примерно с такой конфигурацией:

```text
sandbox="allow-scripts"
```

Следствия:

- JavaScript разрешён.
- Node.js недоступен.
- `require` недоступен.
- `process` недоступен.
- Electron IPC недоступен.
- Прямого доступа к файловой системе нет.
- `allow-same-origin` не предоставляется.
- Нельзя полагаться на `localStorage`, IndexedDB или постоянный origin.
- Нельзя управлять DOM родительского окна.
- Поддерживаемый канал связи — `postMessage`.

Ресурсы обслуживаются через:

```text
apex-module://<manifest.id>/<relative-path>
```

Используйте относительные ссылки:

```html
<link rel="stylesheet" href="style.css" />
<script src="module.js"></script>
<img src="assets/icon.svg" alt="" />
```

Host нормализует пути и блокирует выход за пределы директории модуля.

### Не рассчитывайте на runtime fetch

Базовый поддерживаемый вариант — связанные локальные файлы и host messages. Из-за sandboxed opaque origin не следует считать browser storage и fetch/CORS стабильной частью module API. Статические данные лучше включать в JS или подключать напрямую через HTML/CSS.

---

## 8. Сообщения host → module

Host отправляет сообщения через `window.postMessage`.

### Порядок после загрузки

После события `load` iframe host отправляет:

1. `apex:init`;
2. `apex:visibility`;
3. последний `apex:frame`, если он уже есть.

В дальнейшем приходят:

- `apex:frame` — новые кадры телеметрии;
- `apex:settings` — изменения настроек экземпляра;
- `apex:visibility` — изменения runtime/edit visibility.

Нельзя считать, что телеметрия уже существует в момент `apex:init`.

### `apex:init`

```js
{
  type: "apex:init",
  protocolVersion: 5,
  moduleId: "com.example.apexhud.widget",
  instanceId: "widget-8c934f12",
  settings: {
    accent: "#f2c94c",
    opacity: 0.92
  },
  source: "iracing" | "mock" | "none" | string
}
```

Используйте для:

- сохранения `instanceId` для диагностики;
- применения persisted settings;
- определения источника телеметрии;
- инициализации статического интерфейса.

### `apex:frame`

```js
{
  type: "apex:frame",
  protocolVersion: 5,
  sequence: 12345,
  timestamp: "2026-07-23T14:30:00.000Z",
  payload: {
    source: "iracing",
    player: { /* только если scope запрошен */ },
    standings: { /* только если scope запрошен */ }
  }
}
```

Свойства:

- `sequence` монотонно растёт для опубликованных snapshots.
- `timestamp` — ISO 8601.
- `payload.source` присутствует всегда.
- В payload включаются только scopes из manifest.
- В будущих версиях могут появляться неизвестные поля — их нужно игнорировать.

### `apex:settings`

```js
{
  type: "apex:settings",
  settings: {
    opacity: 0.75,
    showNames: false
  }
}
```

Сейчас у этого сообщения нет `protocolVersion`. Рассматривайте `settings` как текущее полное состояние настроек и объединяйте его с внутренними defaults.

### `apex:visibility`

```js
{
  type: "apex:visibility",
  visible: true,
  editMode: false
}
```

Значение:

- `visible: false` — overlay отключён или скрыт runtime policy; дорогую работу нужно приостановить.
- `visible: true, editMode: false` — обычный режим гонки.
- `visible: true, editMode: true` — визуальный редактор; live-телеметрия может отсутствовать.

---

## 9. Сообщения module → host

### Диагностический лог

```js
window.parent.postMessage({
  type: "apex:log",
  level: "warn",
  message: "No player entry was found in standings"
}, "*");
```

Уровни:

```text
debug
info
warn
error
```

Host ограничивает сообщение 2000 символами и добавляет префикс с ID модуля.

Не логируйте каждый telemetry frame.

### Ready message

Тип протокола содержит:

```js
window.parent.postMessage({
  type: "apex:ready",
  moduleId: "com.example.apexhud.widget"
}, "*");
```

ApexHUD 0.10.0 не требует ready-handshake и сейчас не выполняет действие по этому сообщению. Его можно отправлять для будущей совместимости, но инициализация модуля не должна ждать подтверждения.

### Неподдерживаемые исходящие действия

Модуль пока не может напрямую:

- менять сохранённые настройки экземпляра;
- просить host изменить размер;
- добавлять или удалять другие виджеты;
- переключать раскладки;
- выполнять Electron-команды;
- получать scopes, не указанные в manifest.

---

## 10. Надёжный обработчик сообщений

```js
(() => {
  "use strict";

  const SUPPORTED_PROTOCOL = 5;
  const DEFAULTS = {
    accent: "#f2c94c",
    opacity: 0.92,
  };

  let settings = { ...DEFAULTS };
  let visible = true;
  let editMode = false;
  let lastSequence = -1;

  window.addEventListener("message", (event) => {
    // Из-за sandbox origin может быть opaque, поэтому проверяем source window,
    // а не полагаемся только на event.origin.
    if (event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (
      (message.type === "apex:init" || message.type === "apex:frame") &&
      message.protocolVersion !== SUPPORTED_PROTOCOL
    ) {
      showUnsupportedProtocol(message.protocolVersion);
      return;
    }

    switch (message.type) {
      case "apex:init":
      case "apex:settings":
        settings = {
          ...DEFAULTS,
          ...settings,
          ...(message.settings || {}),
        };
        applySettings();
        break;

      case "apex:visibility":
        visible = Boolean(message.visible);
        editMode = Boolean(message.editMode);
        document.documentElement.classList.toggle("module-hidden", !visible);
        document.documentElement.classList.toggle("module-editing", editMode);
        break;

      case "apex:frame":
        if (!visible || message.sequence === lastSequence) return;
        lastSequence = message.sequence;
        render(message.payload || {});
        break;
    }
  });

  function applySettings() {
    document.documentElement.style.setProperty(
      "--accent",
      String(settings.accent)
    );
    document.documentElement.style.setProperty(
      "--opacity",
      String(Number(settings.opacity) || 0.92)
    );
  }

  function render(payload) {
    // Читайте только объявленные scopes и проверяйте все значения.
  }

  function showUnsupportedProtocol(received) {
    document.body.textContent = `Unsupported ApexHUD protocol: ${received}`;
  }
})();
```

CSS для скрытия:

```css
html.module-hidden {
  visibility: hidden;
}
```

---

## 11. Справочник telemetry scopes

Телеметрический сервис по умолчанию публикует 30 кадров в секунду. Модуль не обязан полностью перерисовываться 30 раз в секунду.

### Общее поле source

В каждом frame payload присутствует:

```ts
source: "iracing" | "mock" | "none" | string
```

- `iracing` — live shared-memory iRacing.
- `mock` — встроенный симулятор данных.
- `none` — активного источника нет.
- В будущем возможны другие значения; неизвестные строки нужно принимать спокойно.

### 11.1 `connection`

```ts
interface ConnectionState {
  connected: boolean;
  status: string;
  tickRate: number;
  framesDropped: number;
  simulatorWindow: {
    processRunning: boolean;
    windowFound: boolean;
    isVisible: boolean;
    isMinimized: boolean;
    isForeground: boolean;
  };
}
```

| Поле | Значение |
|---|---|
| `connected` | Telemetry bridge имеет активный источник. |
| `status` | Человекочитаемый diagnostic status; не парсите как стабильный enum. |
| `tickRate` | Tick rate исходной телеметрии. |
| `framesDropped` | Счётчик пропущенных кадров. |
| `processRunning` | Процесс iRacing обнаружен. |
| `windowFound` | Найдено окно симулятора. |
| `isVisible` | Окно видимо. |
| `isMinimized` | Окно свёрнуто. |
| `isForeground` | Симулятор находится на переднем плане. |

Запрашивайте состояние окна только если оно реально нужно. Основную auto-hide policy уже применяет host.

### 11.2 `session`

```ts
interface SessionState {
  sessionNumber: number;
  state: number;
  sessionType: string;
  sessionName: string;
  eventType: string;
  trackName: string;
  trackLengthMeters: number;
  timeRemainingSeconds: number;
  hasTimeLimit: boolean;
  lapsRemaining: number;
  hasLapLimit: boolean;
  flags: number;
  isReplayPlaying: boolean;
  isInGarage: boolean;
}
```

| Поле | Единица / значение |
|---|---|
| `sessionNumber` | Индекс текущей сессии; `-1` может означать отсутствие данных. |
| `state` | Raw numeric session state. Считайте opaque, если не поддерживаете собственную таблицу соответствий. |
| `sessionType` | Например Practice, Qualifying, Race. Сравнивайте без учёта регистра и допускайте новые значения. |
| `sessionName` | Отображаемое имя сессии. |
| `eventType` | Тип события из session metadata. |
| `trackName` | Отображаемое название трассы. |
| `trackLengthMeters` | Длина трассы в метрах; `0`, если неизвестна. |
| `timeRemainingSeconds` | Оставшиеся секунды только при `hasTimeLimit=true`. |
| `hasTimeLimit` | Есть ли реальный лимит времени. |
| `lapsRemaining` | Оставшиеся круги только при `hasLapLimit=true`. |
| `hasLapLimit` | Есть ли реальный лимит кругов. |
| `flags` | Raw bitmask флагов iRacing. Нельзя определять единственный флаг простым сравнением числа. |
| `isReplayPlaying` | Активно воспроизведение replay. |
| `isInGarage` | Игрок находится в garage state. |

ApexHUD нормализует unlimited sentinels iRacing. Если лимита нет, numeric value равен `0`, а соответствующий `has*Limit` — `false`.

### 11.3 `player`

```ts
interface PlayerState {
  carIndex: number;
  name: string;
  carNumber: string;
  position: number;
  classPosition: number;
  lap: number;
  lapDistancePercent: number;
  speedMetersPerSecond: number;
  fuelLiters: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isOnTrack: boolean;
}
```

| Поле | Единица / значение |
|---|---|
| `carIndex` | Индекс машины iRacing; `-1`, если неизвестен. Это наиболее надёжный ключ идентификации. |
| `name` | Имя гонщика. |
| `carNumber` | Номер машины в виде строки. |
| `position` | Согласованная общая позиция; `0` означает отсутствие данных. |
| `classPosition` | Согласованная позиция в классе; `0` означает отсутствие данных. |
| `lap` | Текущий счётчик круга. |
| `lapDistancePercent` | Прогресс текущего круга, ограничен `0..1`. |
| `speedMetersPerSecond` | Скорость в м/с. Для км/ч умножить на `3.6`, для mph — на `2.236936`. |
| `fuelLiters` | Топливо в литрах. |
| `lastLapSeconds` | Последний круг в секундах; `0`, если неизвестен. |
| `bestLapSeconds` | Лучший круг в секундах; `0`, если неизвестен. |
| `incidentCount` | Текущий счётчик инцидентов сессии. |
| `onPitRoad` | Игрок на pit road. |
| `isOnTrack` | Игрок считается находящимся на трассе. |

### 11.4 `vehicle`

```ts
interface VehicleState {
  speedMetersPerSecond: number;
  gear: number;
  rpm: number;
  shiftLightFirstRpm?: number;
  shiftRpm: number;
  shiftLightLastRpm?: number;
  shiftLightBlinkRpm?: number;
  throttle: number;
  brake: number;
  clutch: number;
  steeringWheelAngleRadians: number;
  onPitRoad: boolean;
  trackSurface: number;
}
```

| Поле | Единица / значение |
|---|---|
| `speedMetersPerSecond` | Скорость в м/с. |
| `gear` | Raw gear iRacing; обычно `-1` — задняя, `0` — нейтраль, положительные числа — передачи вперёд. |
| `rpm` | Текущие обороты двигателя. |
| `shiftLightFirstRpm` | RPM начала штатных shift lights; может отсутствовать или быть `0`. |
| `shiftRpm` | Рекомендуемый car-specific shift threshold; может быть `0`. |
| `shiftLightLastRpm` | Последний постоянный threshold shift lights; может отсутствовать или быть `0`. |
| `shiftLightBlinkRpm` | Car-specific blink threshold; может отсутствовать или быть `0`. |
| `throttle` | `0..1`. |
| `brake` | `0..1`. |
| `clutch` | `0..1`. |
| `steeringWheelAngleRadians` | Знаковый угол руля в радианах. Если экранная шкала имеет обратное направление, инвертируйте только на уровне отображения. |
| `onPitRoad` | Машина на pit road. |
| `trackSurface` | Raw numeric track-surface value. Считайте opaque без собственной mapping table. |

Рекомендуемый fallback для shift thresholds:

```js
const shift = positive(vehicle.shiftRpm) || positive(vehicle.shiftLightLastRpm);
const first = positive(vehicle.shiftLightFirstRpm) || shift * 0.86;
const blink = positive(vehicle.shiftLightBlinkRpm) || shift * 1.04;
```

Не запускайте мигание передачи задолго до штатного car-specific blink threshold.

### 11.5 `timing`

```ts
interface TimingState {
  currentLap: number;
  completedLaps: number;
  currentLapSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  deltaToBestSeconds: number;
  deltaAvailable: boolean;
  currentLapValid: boolean;
  validity: "valid" | "invalid" | "unavailable" | string;
}
```

| Поле | Значение |
|---|---|
| `currentLap` | Номер текущего круга. |
| `completedLaps` | Количество завершённых кругов. |
| `currentLapSeconds` | Время текущего круга; `0`, если неизвестно. |
| `lastLapSeconds` | Последний круг; `0`, если неизвестен. |
| `bestLapSeconds` | Лучший круг; `0`, если неизвестен. |
| `deltaToBestSeconds` | Знаковая персональная дельта к лучшему кругу. Отрицательное значение — быстрее. |
| `deltaAvailable` | Доступна ли валидная дельта и reference. |
| `currentLapValid` | Convenience boolean, true только для `valid`. |
| `validity` | `valid`, `invalid`, `unavailable` либо будущее значение. |

Не показывайте `0.000` как реальную дельту при `deltaAvailable=false`.

### 11.6 `fuel`

```ts
interface FuelState {
  levelLiters: number;
  usePerHourLiters: number;
  estimatedPerLapLiters: number;
  estimatedLapsRemaining: number;
  requiredToFinishLiters: number;
  addToFinishLiters: number;
  samples: number;
  estimateReady: boolean;
}
```

| Поле | Значение |
|---|---|
| `levelLiters` | Текущий уровень топлива. |
| `usePerHourLiters` | Текущая/source оценка расхода в час. |
| `estimatedPerLapLiters` | Обученная средняя оценка расхода на круг. |
| `estimatedLapsRemaining` | Оценка оставшихся кругов на текущем топливе. |
| `requiredToFinishLiters` | Оценка топлива до финиша. |
| `addToFinishLiters` | Оценка количества для дозаправки. |
| `samples` | Число принятых samples. |
| `estimateReady` | Готова ли оценка для нормального отображения. |

До `estimateReady=true` показывайте спокойное состояние обучения, а не псевдоточную цифру.

### 11.7 `radar`

```ts
interface RadarState {
  spotterState: string;
  active: boolean;
  contacts: RadarContact[];
}

interface RadarContact {
  carIndex: number;
  side: "left" | "right" | "unknown" | string;
  longitudinalMeters: number;
  closingSpeedMetersPerSecond: number;
  overlap: number;
  threat: "nearby" | "warning" | "critical" | "fast-approach" | string;
  confidence: number;
  isApproaching: boolean;
}
```

| Поле | Значение |
|---|---|
| `spotterState` | Нормализованное состояние: `clear`, `car-left`, `car-right`, `both-sides`, `two-left`, `two-right`, `off`. |
| `active` | Есть side requirement или candidate contact. |
| `carIndex` | Индекс соперника. Отрицательные значения могут обозначать synthetic contact, когда iRacing сообщил боковую машину, но сопоставить конкретный car index не удалось. |
| `side` | Слева, справа или неизвестно. |
| `longitudinalMeters` | Приблизительная знаковая дистанция вдоль трассы. Положительная — впереди, отрицательная — сзади. |
| `closingSpeedMetersPerSecond` | Положительное значение означает уменьшение абсолютной дистанции. |
| `overlap` | Приблизительная глубина нахождения бок о бок `0..1`, а не точное пересечение world-space geometry. |
| `threat` | Нормализованная степень угрозы. Допускайте новые значения. |
| `confidence` | Приблизительная уверенность сопоставления контакта. |
| `isApproaching` | Контакт находится сзади и быстро приближается. |

Текущий публичный протокол не предоставляет точные world X/Y/orientation всех соперников. Геометрия радара является приближением на основе spotter state и lap progress.

### 11.8 `relative`

```ts
interface RelativeState {
  entries: RelativeEntry[];
}

interface RelativeEntry {
  carIndex: number;
  carNumber: string;
  driverName: string;
  carClassName: string;
  position: number;
  relation: "ahead" | "behind" | string;
  distanceMeters: number;
  estimatedGapSeconds: number;
  onPitRoad: boolean;
  isPlayer: boolean;
}
```

| Поле | Значение |
|---|---|
| `entries` | До 12 ближайших машин, кроме игрока, внутри relative window. |
| `relation` | Впереди или сзади по wrapped lap progress. |
| `distanceMeters` | Знаковая дистанция: положительная впереди, отрицательная сзади. |
| `estimatedGapSeconds` | Приближение на основе текущей скорости игрока, не официальный timing gap. |
| `position` | Текущая общая позиция, если известна. |

Relative предназначен для spatial awareness. Не выдавайте `estimatedGapSeconds` за официальный разрыв scoring system.

### 11.9 `standings`

```ts
interface StandingsState {
  mode: "overall" | "class" | string;
  entries: StandingEntry[];
}

interface StandingEntry {
  carIndex: number;
  position: number;
  classPosition: number;
  carNumber: string;
  driverName: string;
  teamName: string;
  carClassId: number;
  carClassName: string;
  iRating: number;
  license: string;
  lap: number;
  lapDistancePercent: number;
  gapToLeaderSeconds: number;
  intervalSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isPlayer: boolean;
  status: "running" | "pit" | "out" | string;
}
```

| Поле | Значение |
|---|---|
| `position` | Уплотнённая общая позиция после удаления stale/non-participating roster entries. |
| `classPosition` | Уплотнённая позиция внутри `carClassId`. |
| `carClassId` | Надёжный ключ группировки класса. |
| `carClassName` | Отображаемое имя класса. |
| `lap` | Наиболее достоверный счётчик прогресса круга. |
| `lapDistancePercent` | `0..1`. |
| `gapToLeaderSeconds` | В гонке — scoring gap, если доступен; в Practice/Qualifying — проигрыш лучшему best lap. `0` может означать лидера или отсутствие данных. |
| `intervalSeconds` | Разрыв до предыдущей строки в опубликованном порядке; `0` может означать отсутствие данных. |
| `lastLapSeconds` | `0`, если неизвестен. |
| `bestLapSeconds` | `0`, если неизвестен. |
| `incidentCount` | Доступный incident count; для соперников может зависеть от session results. |
| `isPlayer` | Флаг игрока. Дополнительно сравнивайте `carIndex` с `player.carIndex`. |
| `status` | `running`, `pit`, `out` или новое значение. |

Гоночные позиции стабилизируются примерно 350 мс, чтобы отфильтровать одно-кадровые скачки на timing line. Practice и Qualifying сортируются в первую очередь по best lap.

### Определение мультикласса

```js
function classCount(entries) {
  return new Set(
    entries
      .filter((entry) => Number.isFinite(entry.carClassId))
      .map((entry) => entry.carClassId)
  ).size;
}
```

Для группировки используйте `carClassId`, для отображения — `carClassName`.

---

## 12. Семантика данных и защитный рендеринг

### Недоступные числовые значения

Для многих положительных величин ApexHUD использует `0` как отсутствие данных: lap times, shift thresholds и некоторые gaps. Проверяйте контекстные flags, если они есть.

```js
function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
```

### Не парсите человекочитаемые строки как enum

`connection.status`, `sessionName`, `eventType`, имена и команды — отображаемые строки.

### Принимайте новые enum values

```js
const severityClass = {
  nearby: "nearby",
  warning: "warning",
  critical: "critical",
  "fast-approach": "approach",
}[contact.threat] || "unknown";
```

### Идентификация игрока

Рекомендуемый fallback:

```js
const playerEntry = entries.find((entry) =>
  entry.isPlayer || entry.carIndex === player.carIndex
);
```

Не определяйте игрока только по имени.

### Форматирование времени круга

```js
function formatLap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}
```

### Форматирование gap

```js
function formatGap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return `+${seconds.toFixed(seconds < 10 ? 3 : 1)}`;
}
```

---

## 13. Видимость и режим редактирования

Обрабатывайте `apex:visibility`.

Рекомендуемое поведение:

- Скрывать root при `visible=false`.
- Останавливать timers, animations и тяжёлые расчёты.
- Сохранять runtime state для быстрого возврата.
- В edit mode показывать стабильное representative empty state, а не схлопываться до нулевого размера.
- Не рисовать собственную edit border — ApexHUD добавляет editor chrome.
- Не использовать edit mode для хранения данных.

Пример:

```js
let visible = true;

function setVisibility(message) {
  visible = Boolean(message.visible);
  document.documentElement.classList.toggle("module-hidden", !visible);

  if (!visible) {
    stopAnimation();
  } else {
    resumeAnimation();
  }
}
```

---

## 14. Несколько экземпляров и сохранение состояния

Каждый iframe получает уникальный `instanceId` в `apex:init`.

### Правила

- Runtime state должен жить внутри конкретного iframe.
- Не считайте настройки глобальными для module ID.
- Не полагайтесь на общую browser storage.
- При необходимости включайте `instanceId` в diagnostic log.
- Дублированные экземпляры независимо получают одинаковые telemetry frames.

```js
let instanceId = "unknown";

if (message.type === "apex:init") {
  instanceId = String(message.instanceId || "unknown");
}
```

---

## 15. Наследование Base Layout

ApexHUD использует Base Layout и дочерние session layouts:

```text
Base Layout
Test Drive
Practice
Qualifying
Race
Replay
```

Модулю не нужен специальный код наследования, но разработчик должен понимать влияние на persistence.

### Поведение

- Модуль, добавленный в Base Layout, наследуется дочерними слоями.
- Дочерний слой может переопределить bounds, settings, z-index и enabled.
- Удаление inherited-модуля в дочернем слое создаёт tombstone, поэтому он не появится там заново.
- Новый instance в Base появляется в дочерних слоях, если конкретный instance не был явно удалён.
- Модуль, добавленный только в дочерний слой, остаётся локальным для него.
- При копировании layout source материализуется, а в target сохраняются необходимые overrides.

### Влияние обновлений модуля

- Изменение JS/CSS влияет на все экземпляры после reload.
- Изменение `defaultBounds` влияет только на новые экземпляры.
- Изменение defaults в manifest влияет только на новые экземпляры.
- Существующие per-instance settings сохраняются.
- Новый manifest setting требует fallback в коде, потому что старые instances могут его не содержать.

---

## 16. Рендеринг и производительность

Telemetry service по умолчанию отправляет 30 Hz. Большинство UI не нуждается в полной перерисовке 30 раз в секунду.

### Рекомендуемая частота

| Тип UI | Частота |
|---|---:|
| Передача, RPM, педали, radar | 20–30 Hz |
| Delta bar | 20–30 Hz |
| Relative movement | 10–20 Hz |
| Standings table | 5–10 Hz |
| Session clock | 4–10 Hz |
| Static labels/settings | только при изменении |

### Переиспользуйте DOM

Плохо:

```js
root.innerHTML = buildEntireTable(entries);
```

на каждом кадре.

Лучше:

- один раз создать стабильные rows;
- менять text nodes и CSS variables;
- ключевать строки по `carIndex`;
- создавать/удалять rows только при изменении состава.

### Используйте sequence и throttle

```js
let lastPaintAt = 0;
let pendingPayload;

function onFrame(message) {
  pendingPayload = message.payload;
  const now = performance.now();
  if (now - lastPaintAt < 100) return; // 10 Hz
  lastPaintAt = now;
  render(pendingPayload);
}
```

Для плавного движения храните последний payload и рисуйте через `requestAnimationFrame`.

### Предпочтительные изменения

Используйте:

- `transform`;
- `opacity`;
- CSS variables;
- обновление SVG attributes;
- стабильную geometry.

Избегайте:

- повторных layout measurements в циклах;
- тяжёлых box-shadow и blur;
- синхронной тяжёлой сортировки каждый frame;
- неограниченных массивов;
- постоянных декоративных animations.

### Ограничивайте history buffers

```js
history.push(sample);
if (history.length > maximumSamples) {
  history.splice(0, history.length - maximumSamples);
}
```

### Приостанавливайте скрытый модуль

При `visible=false` по возможности останавливайте animation frames и timers.

---

## 17. Гоночный UX и визуальный дизайн

Гоночный HUD воспринимается периферическим зрением. Состояние должно считываться раньше, чем водитель осознанно прочитает текст.

### Иерархия

1. Одно главное значение.
2. Один state color или shape.
3. Короткий контекст.
4. Детали только при необходимости.

### Хороший glanceable design

- Большая стабильная цифра передачи.
- Большая позиция и маленькое уточнение class/overall.
- Battle box на три строки вместо таблицы на двадцать.
- Фиксированная ширина gaps.
- Сильное выделение игрока.
- Короткие labels.
- Изменение цвета только на реальном action threshold.

### Плохой интерфейс во время гонки

- Длинные фразы.
- Мелкий low-contrast text.
- Несколько одинаково важных значений.
- Постоянное движение.
- Декоративные gradients, конкурирующие с данными.
- Огромный header внутри маленького widget.
- Ранние warning colors, создающие ложную срочность.

### Визуальная система ApexHUD

Базовые цвета:

```text
Panel:          rgba(0,0,0,.90)
Primary text:   #f5f5f5
Secondary text: rgba(255,255,255,.55)
Player/action:  #f2c94c
Positive:       #36c96b
Negative:       #ef4444
Neutral blue:   #179fc4
```

Typography:

```css
font-family: "Bahnschrift", "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
font-variant-numeric: tabular-nums;
```

Рекомендации:

- Opacity панели примерно 0.82–0.94.
- Outer radius 0–3 px для стиля timing equipment.
- Не использовать glow, bloom и backdrop blur.
- Компактные строки и стабильные ширины columns.
- Длинные имена обрезать ellipsis.
- Critical state не должен кодироваться только цветом.
- Проверять на ярком небе, траве, тёмном кокпите и ночью.
- Empty state должен быть спокойным и понятным.

### Адаптивный CSS

```css
.value {
  font-size: clamp(24px, 28cqh, 58px);
}

.name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

Модуль должен работать и в `minimumSize`, и в более широком пользовательском размере.

---

## 18. Локализация

### Содержимое модуля

Модуль может включать собственные переводы и выбирать язык через `navigator.language`:

```js
const locale = String(navigator.language || "en").toLowerCase();
const language = locale.startsWith("ru") ? "ru" : "en";
```

Все переводы должны быть локальными.

### Локализация строк manifest

В ApexHUD 0.10.0 schema содержит по одной строке `name`, `description`, `label` и `help`. Host пока не поддерживает localized maps и не отправляет выбранный язык Control Center в `apex:init`.

Рекомендации:

- Для Community manifest использовать простой международный английский.
- Видимый контент самого модуля при необходимости локализовать внутри.
- Нельзя динамически изменить labels host-generated settings UI из модуля.

---

## 19. Безопасность и CSP

### Рекомендуемый CSP

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';"
/>
```

Такой CSP требует внешние локальные JS/CSS вместо inline scripts/styles.

### Правила безопасности

- Не использовать `eval` и `new Function`.
- Не импортировать remote scripts.
- Не загружать remote fonts.
- Полностью избегать network access.
- Считать telemetry text недоверенными display data и назначать через `textContent`.
- Если генерируется HTML, экранировать имена и labels.
- Проверять форму входящего сообщения.
- Проверять `event.source === window.parent`.
- Ограничивать размер и частоту diagnostic logs.
- Не включать токены, credentials и private endpoints.

Безопасный вывод:

```js
nameElement.textContent = String(entry.driverName || "Unknown");
```

Небезопасный:

```js
nameElement.innerHTML = entry.driverName;
```

### Sandbox не делает код доверенным

Модуль остаётся исполняемым JavaScript. Исходники сторонних модулей нужно проверять. Sandbox убирает Node/Electron/filesystem privileges, но не превращает неизвестный код в безопасный автоматически.

---

## 20. Рабочий процесс разработки

### Требования к репозиторию ApexHUD

```text
Node.js >= 22.12
npm >= 10
.NET 8 SDK для telemetry service
```

### Установка зависимостей

```powershell
npm ci --include=dev --foreground-scripts
```

### Dev mode

```powershell
.\scripts\dev.ps1
```

### Проверка protocol и manifests

```powershell
npm run verify
```

Или только manifest:

```powershell
npm --workspace @apexhud/protocol run build
node .\scripts\verify-manifests.mjs
```

Repository verifier сканирует встроенные папки внутри `modules/` и пропускает директории с `_`. Локальные user modules валидируются приложением при reload каталога.

### Рекомендуемый цикл

1. Изменить файлы.
2. Перезагрузить каталог, если изменился manifest или package structure.
3. Удалить и добавить instance заново только при проверке новых manifest defaults.
4. Открыть визуальный редактор.
5. Проверить minimum и большой размер.
6. Проверить mock telemetry.
7. Проверить live iRacing.
8. Посмотреть Electron DevTools console и `[module:<id>]` logs.

### Visual preview

Команда:

```powershell
npm run preview:modules
```

открывает visual harness встроенных модулей. Это проверка внешнего вида, а не замена реального host lifecycle, sandbox, persistence и live telemetry. Для custom module временно добавьте его в preview page либо тестируйте через реальный ApexHUD editor.

### Проверяйте protocol mismatch

Надёжный модуль должен показать понятное unavailable state, а не упасть при неподдерживаемой версии протокола.

---

## 21. Чек-лист тестирования

### Lifecycle

- [ ] Загружается без телеметрии.
- [ ] Обрабатывает `source: none`.
- [ ] Работает с mock source.
- [ ] Работает с live source.
- [ ] Применяет settings из `apex:init`.
- [ ] Применяет последующие `apex:settings`.
- [ ] Скрывается и приостанавливается при `visible=false`.
- [ ] Показывает стабильное состояние в edit mode.
- [ ] Переживает reload iframe.

### Данные

- [ ] Не падает при отсутствии ожидаемого scope в тестовом payload.
- [ ] Защитно обрабатывает `0`, отрицательные и non-finite values.
- [ ] Обрабатывает неизвестные enum strings.
- [ ] Обрабатывает длинные имена гонщиков, команд и трасс.
- [ ] Идентифицирует игрока через fallback по `carIndex`.
- [ ] Работает в single-class и multiclass.
- [ ] Обрабатывает pit и out statuses.
- [ ] Обрабатывает пустые standings/relative/radar arrays.

### Layout

- [ ] Работает в `minimumSize`.
- [ ] Работает на 1920×1080.
- [ ] Работает на 2560×1440.
- [ ] Работает на ultrawide.
- [ ] Одновременно работают два instances.
- [ ] Editor chrome не виден в race mode.
- [ ] Контент не вылезает за iframe.

### Визуал

- [ ] Читается на ярком и тёмном фоне.
- [ ] Главное значение различимо периферическим зрением.
- [ ] Важные columns не двигаются.
- [ ] Critical color имеет дополнительный text/shape cue.
- [ ] Нет декоративного пульса, glow и blur.
- [ ] Нет случайного белого или непрозрачного фона.

### Производительность

- [ ] History arrays ограничены.
- [ ] Таблица не перестраивается полностью 30 раз/с без причины.
- [ ] Нет console log на каждый frame.
- [ ] Timers останавливаются при скрытии.
- [ ] CPU остаётся стабильным в длинной сессии.

### Пакет

- [ ] Manifest проходит validation.
- [ ] Entry существует.
- [ ] Все пути относительные.
- [ ] Модуль работает offline.
- [ ] Нет `node_modules`.
- [ ] Нет секретов и machine-specific paths.
- [ ] Для Community есть preview до 2.5 MB.
- [ ] Включены LICENSE и README.

---

## 22. Публикация в Community-каталоге

Дефолтный каталог:

```text
https://github.com/EugeneK32/apexhud-community-modules.git
```

Дефолтная ветка:

```text
main
```

### Поддерживаемая структура каталога

Папки в корне:

```text
repository/
  module-a/
    manifest.json
  module-b/
    manifest.json
```

Или внутри `modules/`:

```text
repository/
  modules/
    module-a/
      manifest.json
    module-b/
      manifest.json
```

Сканируются только непосредственные дочерние директории. Папки модулей могут быть обычными директориями или Git submodules.

### Рекомендуемая структура отдельного module repository

```text
manifest.json
index.html
style.css
module.js
preview.webp
README.md
LICENSE
```

Если catalog repository использует submodules, корень каждого submodule должен одновременно быть корнем модуля с `manifest.json`.

### Preview

Рекомендация:

```text
preview.webp
960 × 540
16:9
<= 2.5 MB
```

Распознаваемые пути Community catalog:

```text
preview.webp
preview.png
preview.jpg
preview.jpeg
assets/preview.webp
assets/preview.png
assets/preview.jpg
```

Для максимальной совместимости используйте `preview.webp` в корне.

Preview показывается в каталоге/библиотеке и не загружается в race overlay, если сам HTML его не подключает.

### Установка и обновление

- Catalog shallow-clone выполняется вместе с recursive submodules.
- Установка копирует файлы в user modules directory.
- `.git` не копируется.
- ApexHUD создаёт `.apexhud-community.json` для маркировки источника.
- Update атомарно заменяет установленную папку.
- Uninstall удаляет установленную копию, но не catalog cache.
- Автопроверка может запускаться после старта и каждые шесть часов.

### Сравнение версий

Текущее сравнение простое и числовое: version делится по `.`, `+`, `-`, затем сравниваются integer components.

Рекомендуется:

```text
1.0.0
1.1.0
2.0.0
```

Не рассчитывайте на строгий SemVer prerelease ordering:

```text
1.0.0-beta.10
```

### Требования к branch

Настроенная ветка должна существовать на remote, например `origin/main`. Если репозиторий использует другую default branch, её нужно указать в настройках.

### Рекомендации для Community review

- Уникальный reverse-DNS ID, принадлежащий автору.
- Понятный screenshot/preview.
- Открытые исходники.
- Не публиковать только непрозрачный minified bundle без source.
- Строгий CSP.
- Offline operation.
- Отсутствие telemetry exfiltration.
- Changelog для заметных изменений.

---

## 23. Версионирование и совместимость

### Protocol version

ApexHUD 0.10.0 отправляет protocol version `5` в `apex:init` и `apex:frame`.

Модуль должен:

- игнорировать неизвестные поля объектов;
- проверять используемые значения;
- спокойно обрабатывать неподдерживаемую версию;
- документировать минимальную версию ApexHUD.

Рекомендуемая строка в README:

```text
Requires ApexHUD 0.10.0 or later (telemetry protocol v5).
```

### Manifest version

`schemaVersion` не связан с telemetry protocol version.

Текущие значения:

```text
manifest schema: 1
telemetry protocol: 5
```

### Module version

Используйте numeric SemVer-like version:

```text
MAJOR.MINOR.PATCH
```

- MAJOR — несовместимые изменения поведения/settings.
- MINOR — новые совместимые возможности.
- PATCH — bug fixes и visual corrections.

### Совместимость settings

Для сохранения существующих layouts:

- Не меняйте `manifest.id` после публикации.
- Избегайте переименования setting keys.
- Сохраняйте типы values.
- По возможности принимайте старые values.
- Добавляйте internal defaults для новых keys.

### Совместимость entry

Изменение `entry` допустимо, если новый файл существует. Host перечитает manifest и сформирует новый URL.

---

## 24. Полноценный пример модуля

Рядом с руководством включён полный пример `Battle Focus`:

```text
docs/examples/battle-focus/
```

Он демонстрирует:

- валидный manifest;
- scopes `player`, `session`, `standings`;
- per-instance settings;
- protocol v5;
- fallback идентификации игрока;
- автоматический single-class/multiclass режим;
- стабильный DOM на три строки;
- visibility handling;
- защитное форматирование чисел;
- glanceable CSS в стиле ApexHUD;
- строгий CSP.

Для установки скопируйте всю папку в user modules directory и перезагрузите catalog.

---

## 25. Диагностика проблем

### Модуль не появился в библиотеке

Проверьте:

1. Папка — непосредственный child modules root.
2. Имя папки не начинается с `_`.
3. `manifest.json` — валидный JSON.
4. `schemaVersion` равен `1`.
5. `id` — валидный lowercase reverse-DNS.
6. `scopes` непустой и содержит поддерживаемые значения.
7. `entry` существует.
8. Нет duplicate ID.
9. Выполнен reload modules или restart.
10. В main-process console нет `[modules]` warning.

### Модуль виден, но пустой

Проверьте:

- HTML правильно подключает CSS/JS.
- CSP разрешает локальные файлы.
- `html` и `body` имеют размер.
- В JS нет syntax error.
- Модуль не требует frame до init.
- Нужный scope объявлен.
- Root не остался скрытым после visibility state.

Базовый CSS:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}
```

### Появляется белый фон

Явно сделайте прозрачными все root layers:

```css
html,
body,
#app,
.widget-root {
  background: transparent !important;
}
```

У canvas уберите background fill и очищайте:

```js
ctx.clearRect(0, 0, canvas.width, canvas.height);
```

Не рисуйте placeholder panel в normal runtime, если он не является частью дизайна.

### Настройки не меняются

- Обрабатывайте и `apex:init`, и `apex:settings`.
- Объединяйте с defaults.
- Применяйте CSS variables после каждого update.
- Не ожидайте, что host перезагрузит iframe после каждого setting change.

### Новый setting undefined в старом layout

Это ожидаемо. Старый instance хранит старый settings object. Нужен internal fallback.

### Изменение `defaultBounds` не сработало

Это ожидаемо для существующих instances. При тестировании удалите и добавьте instance заново либо сбросьте layout.

### Preview не отображается в Community

Используйте:

```text
preview.webp
```

в корне модуля. Проверьте:

- файл закоммичен и запушен;
- он находится в настроенной branch;
- размер меньше 2.5 MB;
- catalog обновлён корректно;
- если используются submodules, обновлён pointer на commit.

### Update не определяется

- Увеличьте `manifest.version` численно.
- Запушьте catalog repository или новый submodule commit.
- Проверьте branch.
- Нажмите **Проверить обновления**.

### Не приходит поле телеметрии

- Проверьте scope в manifest.
- Проверьте protocol v5.
- Защитно обрабатывайте partial test payload.
- При разработке при необходимости смотрите `/snapshot` telemetry service.

### Позиции скачут

Для официального order используйте `standings.position`, а не собственную сортировку только по `lap + lapDistancePercent`. Эти значения обновляются неатомарно на timing line.

### Relative gap отличается от scoring gap

Это ожидаемо. `relative.estimatedGapSeconds` — spatial estimate. Для официального timing используйте gaps из standings.

---

## 26. Текущие ограничения API

На ApexHUD 0.10.0 публичный API модулей не предоставляет:

- точные world X/Y coordinates и orientation соперников;
- геометрию карты трассы;
- определения поворотов;
- полное историческое хранилище телеметрии;
- изменение layout по инициативе модуля;
- сохранение settings по инициативе модуля;
- произвольные host commands;
- localized maps для manifest strings;
- negotiation API возможностей protocol;
- официальный npm SDK для module code;
- гарантированную browser storage;
- network access как поддерживаемую возможность.

Не следует имитировать отсутствующий API через неподдерживаемый Electron или filesystem access.

---

## 27. Чек-лист релиза

### Идентичность и совместимость

- [ ] Стабильный уникальный module ID.
- [ ] Version увеличена.
- [ ] Минимальная версия ApexHUD/protocol указана.
- [ ] Существующие setting keys сохранены.

### Manifest

- [ ] Schema version 1.
- [ ] Понятные name и description.
- [ ] Запрошены только нужные scopes.
- [ ] Bounds валидны.
- [ ] Minimum size протестирован.
- [ ] Settings проходят validation.

### Runtime

- [ ] Protocol v5 обработан.
- [ ] Init, frame, settings и visibility обработаны.
- [ ] Неизвестные values не ломают модуль.
- [ ] Несколько instances работают.
- [ ] Нет зависимости от browser storage.

### Визуал

- [ ] Информация читается во время езды.
- [ ] Читается на ярких и тёмных сценах.
- [ ] Geometry стабильна.
- [ ] Нет случайного белого фона.
- [ ] Нет лишних animation/glow/blur.

### Производительность

- [ ] Memory bounded.
- [ ] Разумная render rate.
- [ ] Hidden state останавливает работу.
- [ ] Нет per-frame logging.

### Безопасность

- [ ] Строгий CSP.
- [ ] Нет remote dependencies.
- [ ] Нет eval.
- [ ] Untrusted text выводится через `textContent`.
- [ ] Нет секретов.

### Community package

- [ ] Есть `preview.webp`.
- [ ] Preview <= 2.5 MB.
- [ ] Есть README и LICENSE.
- [ ] Catalog/submodule commit обновлён.
- [ ] Install и update протестированы через catalog.

---

## Канонические исходники контракта

Для точной реализации ApexHUD 0.10.0 смотрите:

```text
packages/protocol/src/index.ts
apps/desktop/src/main/moduleCatalog.ts
apps/desktop/src/main/communityModuleService.ts
apps/desktop/src/renderer/overlay/index.ts
services/telemetry/Models/TelemetrySnapshot.cs
services/telemetry/Processing/TelemetryProcessor.cs
modules/_template/
docs/VISUAL_SYSTEM.md
```

TypeScript definitions в `packages/protocol/src/index.ts` являются основным машиночитаемым контрактом.
