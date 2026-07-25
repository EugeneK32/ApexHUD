# Changelog

All notable changes to ApexHUD are documented here.

## [0.11.1](https://github.com/EugeneK32/ApexHUD/compare/v0.11.0...v0.11.1) (2026-07-25)

# Changelog

All notable changes are documented here. The project follows semantic versioning while in early beta.

## [0.11.0] - 2026-07-25

### Added
- Telemetry protocol v6.
- `driverAids`, `pit`, `environment`, and `motion` module scopes.
- Live ABS availability/intervention and ABS brake-cut amount.
- TC configuration, brake bias, pit/rev limiter state, and decoded engine warnings.
- Raw throttle/brake, handbrake, steering range, shift-indicator and shift-power percentages.
- Pit service/repair selections, weather/wetness, local motion, extra lap deltas, and richer player metadata.
- Complete paired English/Russian GitHub documentation and governance files.

### Fixed
- Manifest schema now accepts every scope supported by the runtime.
- Optional telemetry is represented with availability/nullability instead of misleading zero values.
- Pit limiter availability recognizes an active engine-warning bit even when the control toggle variable is absent.

### Changed
- Repository documentation was reorganized into `docs/en` and `docs/ru`; legacy patch notes and obsolete preview documents were removed.
- License metadata is consistently `MPL-2.0`.

## 0.10.0 — 2026-07-23

### Race-first HUD

- Race order now follows iRacing's authoritative live position before lap progress, preventing timing-line calculations from briefly moving P2 to P4.
- Added a 350 ms scoring stabiliser for transient overall/class position changes; real passes still appear quickly while one-frame jumps are ignored.
- Position widget automatically shows class position in multiclass sessions and keeps overall position as secondary context.
- Race Standings factory preset now prioritises peripheral readability: 12 drivers and no iRating/licence/last-lap columns by default. Existing customised tables are preserved.
- Radar terminology no longer exposes the internal word “overlap”; settings describe detection range and side-by-side danger directly.

### Shift guidance

- Telemetry now reads `DriverCarSLFirstRPM`, `DriverCarSLShiftRPM`, `DriverCarSLLastRPM` and `DriverCarSLBlinkRPM` from iRacing.
- Race Dashboard turns yellow at the first shift light, orange at the normal shift cue and flashes red only at the simulator's own blink threshold.
- Added a restrained blue low-RPM hint when a lower gear is likely useful. It is explicitly treated as a heuristic, not a car-specific command.

### Control Center

- Simplified Home into one session card, one active-HUD card and a single primary edit action.
- Reframed layout groups as user-facing HUD profiles and session layers as session modes.
- Combined installed and downloadable widgets into “My widgets” and “Catalog” views.
- Removed per-layout usage noise from installed widget cards; advanced folder/reload actions moved into an overflow menu.
- Git repository/branch settings are now collapsed as advanced settings instead of occupying a main card.
- Default community repository is `https://github.com/EugeneK32/apexhud-community-modules.git`; old placeholder URLs migrate automatically.

## 0.9.0 — 2026-07-23

- Reworked the Modules tab into a library of installed widgets; widgets are placed only from the visual editor.
- Added previews for installed widgets and clear Built-in, Community, and Local source labels.
- Community widgets receive installation metadata and remain correctly identified after restart.
- Refined the Control Center visual language for better readability and fewer technical labels or overloaded actions.
- Moved HUD-profile management into a compact menu.
- Applied the ApexHUD icon to windows, taskbar, tray, packaging, and the Control Center sidebar.
- Added an application-icon replacement guide.

## 0.8.0 — 2026-07-23

### Control Center UX

- Rebuilt the Layouts page as a guided two-step flow: choose a layout set, then choose Base Layout or a session layout.
- Removed the redundant **Modules in layer** list from Layouts; module placement remains in the visual editor and the Modules tab now clearly shows its target layout.
- Made Base inheritance visible through the interface structure instead of relying on explanatory paragraphs.
- Moved cross-layout copying into a compact advanced disclosure with clear Source and Target sides.
- Increased typography size, contrast and spacing while reducing nested cards and visual noise.

### Localisation

- Added persisted interface language selection with English, Russian, German, French, Spanish, Italian, Brazilian Portuguese, Polish, Simplified Chinese and Japanese.
- Existing installations choose the operating-system language on first migration when supported.
- Localisation applies immediately to Control Center and the in-game visual editor.

### Visual editor

- Reworked the editor toolbar and inspector into a flatter, more readable interface matching Control Center.
- Replaced native toolbar and module-setting selects with in-window dropdowns, fixing options that intermittently could not be clicked in the transparent always-on-top window.
- Replaced the native system colour dialog with an inline saturation/value, hue and HEX picker. It stays open while dragging and updates the module live.
- Removed the redundant factory-reset action from the main toolbar; session layouts expose only the relevant **Reset to Base** action.

## 0.7.0 — 2026-07-23

### Layout inheritance

- Renamed the user-facing Default layer to **Base Layout** and upgraded workspace storage to schema v3.
- Child session layers now store local modules, property-level overrides and removal tombstones instead of independent full snapshots.
- Base position/settings/enabled changes propagate automatically unless that property was overridden in the child.
- Modules removed from a child stay removed; newly added Base modules appear automatically.
- Added a clear source/target copy workflow for any layer in any group, including cross-group copies.
- Migrates schema v2 snapshots and legacy `layout.json` without discarding existing layouts.

### Community catalog

- Added a dedicated Community tab backed by a configurable Git repository.
- Supports shallow clone/fetch, recursive Git submodules, preview images, install/update/remove and six-hour update checks.
- Detects system Git, `APEXHUD_GIT_PATH` or optional PortableGit in `bin/git/cmd/git.exe`.
- Installed modules remain sandboxed and are copied without `.git` metadata.

### Fixed

- Corrected the inverted steering trace in Driver Inputs.
- Fixed the race overlay disappearing after pressing Done in the in-game editor: layout saving is flushed before exit and temporary foreground loss no longer clears session activity.
- Replaced the invalid packaging icon with a valid multi-resolution Windows ICO.
- Build no longer destroys a working `node_modules` on every run; dependency reinstall is explicit or only performed when TypeScript is missing.

### Visual modules

- Integrated the refreshed built-in module visuals supplied for this release.

## 0.6.0 — 2026-07-22

### Control Center

- Rebuilt Control Center around four separate tabs: Overview, Layouts, Modules and Settings.
- Replaced the long overloaded page with a restrained flat desktop UI and persistent session/workspace summary.
- Added module search and category filters for Race, Timing, Driving and Utility widgets.
- Kept manual layout groups and automatic session profiles visible as separate concepts.

### Radar

- Built-in radar is now rendered directly in the transparent overlay host instead of an iframe. This removes the remaining Chromium white backing surface.
- The radar contains only compact player/contact rectangles; no panel, card, canvas fill or player background remains.
- Reduced rectangle sizes and tightened side spacing.

### Standings

- SessionInfo parsing now reads current-session ResultsPositions and spectator state.
- Race running order filters spectators and stale roster entries that never participated in the current session.
- Race positions are compacted after stale entries are removed, preventing a zero-lap ghost car from leaving the real P2 shown as P3.
- Added automatic multiclass mode, explicit grouped-by-class mode and independent class-position counters.
- Player pinning remains active in overall, player-class and grouped multiclass views.

### Driver Inputs

- Clamped SVG traces inside the chart viewBox, so a fully pressed pedal no longer draws beyond the top edge.
- The chart now clips its own strokes instead of allowing SVG overflow.

## 0.5.3 — 2026-07-22

- Restored the Race Standings guarantee that the local player is always visible.
- The widget now identifies the player from the live `player.carIndex` snapshot even when a stale or incomplete standings frame omits `isPlayer`.
- Added unique car-number and driver-name fallbacks for rare startup frames where the car index is temporarily unavailable.
- Added regression tests for pinning and highlighting the player when the backend flag is missing.

## 0.5.2 — 2026-07-22

- Proximity Radar is fully transparent in race and edit modes; only compact car rectangles remain.
- Reduced the stock radar footprint and rectangle sizes. Untouched 0.5.1 radar bounds migrate automatically while custom placements remain unchanged.
- Added **Copy Default → current** to Control Center.
- Added **Copy Default** to the in-game layout editor toolbar.
- Default-profile copying uses a deep clone, so scenario-specific corrections never mutate the Default profile.

## 0.5.1 — 2026-07-22

- Fixed `StandingEntry` constructor calls after adding `IncidentCount`.
- The player's standing row now receives `PlayerCarMyIncidentCount`; opponent rows use `0` because iRacing does not expose per-opponent incident counts.
- Fixed mock standings construction.

## 0.5.0 — 2026-07-22

### Added

- Layout workspace schema v2 with manually selected layout groups.
- Automatic profiles inside every group for Default, Test Drive, Practice, Qualifying, Race and Replay.
- Control Center actions to create, duplicate, rename and delete groups; copy/reset individual profiles; and choose the profile being configured.
- Automatic overlay hiding based on the real iRacing window state, with policies for foreground, minimized-only and never.
- Windows simulator-window monitor in the telemetry service.
- Scrolling Driver Inputs graph for throttle, brake and clutch, plus a steering position line.
- Position, Race Control, Lap Times and Incidents modules.
- Live incident count in protocol/player state and Race Control.
- Factory profiles with different useful module sets for test drive, practice, qualifying, race and replay.

### Changed

- Protocol raised to v3 with simulator-window state, event/session names and explicit `hasTimeLimit`/`hasLapLimit` fields.
- Session Header now renders `OPEN` and `∞` for unlimited sessions instead of iRacing sentinel values.
- Fuel calculations ignore the unlimited-laps (`32767`) and unlimited-time (`~604800 s`) sentinels.
- Untouched stock Driver Inputs is moved away from Race Dashboard to avoid the previous overlap.
- Relative can hide its entire panel when no nearby cars exist.
- Fresh installs receive scenario-specific layouts; old `layout.json` compositions are preserved by copying them into every profile of the migrated `Main` group.

### Fixed

- Fixed `168:00:00` and `32767` being displayed as real session limits.
- Fixed the HUD remaining on the desktop after iRacing was minimized or another application became foreground.
- Preserved the active group during automatic profile switching.

## 0.4.1

- Fixed Race Standings remaining on its static `0 CARS / DEMO` shell. The widget no longer uses an ES-module import that Chromium blocks inside ApexHUD's opaque sandboxed iframe.
- Fixed the radar iframe leaving a white rectangle when no side-by-side car exists. The host now hides the entire radar frame until a left/right contact is present.
- Removed unknown rear-approach activation from the minimalist radar; it now appears only for spotter-confirmed left/right cars.
- Added explicit transparent iframe/document backgrounds and regression tests for both issues.
- Included the `RelativeEngine` double/float compilation fix in the clean source.

All notable ApexHUD changes are documented here.

## 0.4.0 — 2026-07-22

### Changed

- Rebuilt all eight built-in widgets around a flat broadcast-style visual system.
- Removed glow, blur, radial decoration, large rounded cards and ornamental gradients from the HUD.
- Reworked Standings into a dense television-style timing tower with white position cells, class-coloured car numbers, compact licence/iRating chips and a restrained player highlight.
- Reworked Relative into a compact alternating-row timing panel with position, class colour, driver, pit state and gap.
- Simplified Proximity Radar to transparent LMU-style rectangles: neutral player car, yellow/orange nearby cars and red critical overlap.
- Reduced the factory radar footprint and disabled rear-approach markers by default.
- Flattened Personal Delta, Session Header, Fuel Strategy, Driver Inputs and Race Dashboard while retaining their existing data and settings.
- Updated the module template and visual preview board to use the same design language.

### Added

- Visual-system documentation for typography, spacing, colour semantics and module authoring.
- Layout migration that replaces only untouched stock colours/sizes while preserving user-customized values.
- Regression test preventing glow-heavy CSS effects from returning to built-in widgets.

## 0.3.0 — 2026-07-22

### Added

- Personal Delta module with green/red delta to the player's own best lap and a clean/invalid lap indicator.
- Relative, Race Dashboard, Driver Inputs, Fuel Strategy and Session Header modules.
- Protocol v2 scopes: `vehicle`, `timing`, `fuel` and `relative`.
- Fuel-consumption learner and finish/refill estimates.
- Current-lap validity tracker using the player's per-session incident counter, with the SDK delta-valid bit kept separate from lap cleanliness.
- Fullscreen compatibility inspection and a one-click, backed-up conversion of iRacing monitor settings to borderless fullscreen.
- One-time layout migration that adds new built-in widgets without overwriting existing widget positions.

### Changed

- The overlay now appears whenever the iRacing simulator shared-memory stream is connected, including garage, replay and pre-grid screens. It no longer waits for `IsOnTrack`.
- Session YAML is refreshed whenever `SessionInfoUpdate` changes, including drivers joining or leaving open practice.
- Standings can construct temporary rows from active `CarIdx*` arrays while driver names are still loading.
- Practice and qualifying standings fall back to best-lap ordering when official positions are unavailable.
- Delta shows `INVALID` in red when the current lap has been invalidated instead of displaying a misleading stale number.

### Fixed

- Fixed empty standings when ApexHUD missed the initial session-info callback or the practice roster changed after startup.
- Fixed the overlay remaining hidden while the simulator was running but the player was not physically in the car.

## 0.2.1 — 2026-07-21

- Raise the Windows overlay to Electron's `screen-saver` always-on-top level and periodically restore its Z-order.
- Keep the race overlay non-focusable outside layout editing.
- Standings always include the player. When the player is below the visible top group, the final rows retain the player and the nearest useful neighbour.
- Add regression tests for standings window selection.

## 0.2.0 — 2026-07-21

- Hide the race overlay outside a live on-track state.
- Redesign Proximity Radar as a compact transparent indicator.
- Fix stale asynchronous layout saves reverting other widget positions.
- Register Electron IPC before loading renderer windows.
- Convert the sandbox preload to CommonJS.

## 0.1.1 — 2026-07-21

- Fix C# type inference and mock switch-expression compilation errors.
- Replace environment-specific npm URLs and use deterministic installation.

## 0.1.0 — 2026-07-21

- Initial Electron host, .NET telemetry bridge, module runtime, layout editor, radar and standings.
