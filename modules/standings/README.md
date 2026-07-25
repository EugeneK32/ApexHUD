# Race Standings 4.0.0

Author: **Eugene Konovalov**  
Requires ApexHUD 0.10.0 or later, telemetry protocol v5.

## What changed

- The visual editor now always shows representative multiclass test data, even when iRacing telemetry is unavailable.
- The module was visually rebuilt with denser racing typography, stable columns, class bars, position-change indicators, player highlighting, pit/out states, licence/iRating cards and class-aware fastest-lap colouring.
- Standings can be shown overall, by the player's class, grouped by class, or selected automatically.
- Driver selection can prioritise leaders, the player's nearby battle, or a centred player window.
- Header, row density, class-header treatment, driver-name formatting, visible columns and timing/gap modes are configurable.
- Background, rows, header, player row, text, dividers, state colours and six class colours are configurable.
- Existing 3.x instance settings are migrated in code where practical (`opacity`, `compact`, and `showLastLap`).

## Visual editor behaviour

When ApexHUD sends `apex:visibility` with `editMode: true`, the widget switches to a stable built-in demo session. This makes every setting immediately visible and prevents the editor from showing an empty panel.

Normal runtime still uses only the telemetry scopes declared in `manifest.json`. The demo data is never mixed into live driving data.

## Files

- `manifest.json` — module metadata and 41 editor settings.
- `index.html` — sandbox-safe entry point with strict CSP.
- `style.css` — responsive visual system.
- `module.js` — ApexHUD lifecycle, rendering and settings handling.
- `windowing.js` — driver selection and multiclass row allocation.
- `demo-data.js` — deterministic visual-editor sample field.
- `preview.webp` — Community catalog preview.

## Installation

Copy the whole `standings` folder into the ApexHUD modules directory, reload the module catalog, then remove and re-add the widget when you need the new manifest defaults on an existing layout.


## 4.0.1 compatibility fix

The runtime scripts are loaded as classic local scripts so the module works in ApexHUD's sandboxed iframe and custom `apex-module://` protocol.
