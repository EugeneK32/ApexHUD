# Battle Focus — documentation example

This module accompanies the English and Russian ApexHUD module development guides.

It is intentionally written without npm or a framework and demonstrates:

- manifest schema v1;
- telemetry protocol v5;
- `session`, `player` and `standings` scopes;
- automatic overall/class selection;
- robust player detection by `isPlayer` or `carIndex`;
- per-instance settings;
- visibility and edit-mode handling;
- a bounded 10 Hz rendering rate;
- strict CSP and local-only assets;
- Russian/English visible-content localization through `navigator.language`.

## Install

Copy the entire `battle-focus` directory into the ApexHUD user modules folder, reload the module library, then add **Battle Focus** in the visual editor.

## Compatibility

Requires ApexHUD 0.10.0 or later and telemetry protocol v5.
