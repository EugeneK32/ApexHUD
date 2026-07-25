# Race Relative

A compact relative timing panel for ApexHUD, rebuilt from scratch around the visual hierarchy of modern sim-racing overlays.

- **Author:** Eugene Konovalov
- **Version:** 6.0.1
- **Requires:** ApexHUD telemetry protocol v6
- **Scopes:** `session`, `player`, `environment`, `relative`, `standings`

## Design

The player is always kept in the centre whenever space permits. Cars ahead are ordered from farther to nearer above the player; cars behind are ordered from nearer to farther below the player.

The module automatically reduces the number of visible rows when resized. At the declared minimum size it remains useful instead of shrinking a seven-row desktop table into unreadable text.

## Data

ApexHUD `relative.estimatedGapSeconds` is an approximate spatial gap, not an official scoring interval. Standings data is joined by `carIndex` to add position, class, licence, iRating and PIT/OUT state.

## Visual editor

When ApexHUD sends `editMode: true`, representative protocol-v6 demo data is rendered automatically. No live simulator connection is required.

## Installation

Copy the `relative` directory into the ApexHUD modules directory, reload the module catalogue and add a new instance to the layout. Existing instances may keep settings from older versions, so adding a fresh instance is recommended when evaluating the new defaults.

## 6.0.1 layout correction

Rows now use fixed compact density instead of dividing all available height by the number of visible cars. Class-only filtering and short relative lists therefore remain table-sized and badges no longer overlap.
