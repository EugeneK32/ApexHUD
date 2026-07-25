# Changelog

## 6.0.1

- Fixed the row sizing model: visible rows no longer stretch to fill the entire module.
- Fixed oversized typography when only one or two nearby cars pass filtering.
- Reworked compact columns so licence, iRating and gap cannot overlap at 336 px width.
- Preserved adaptive row trimming at small heights.

# Changelog

## 6.0.0

- Rebuilt the module from scratch.
- Added a flat RaceLab-inspired row layout with strong position, driver and gap hierarchy.
- Added adaptive row capacity based on the actual widget height.
- Reduced minimum size to 220 × 150 px.
- Added protocol-v6 visual-editor demo data.
- Added standings enrichment by `carIndex`.
- Added all-classes and player-class filtering.
- Added time, distance and automatic relative modes.
- Added optional signed and unsigned gap presentation.
- Added overall/class position selection.
- Added configurable header, footer, columns, typography and colours.
- Added graceful protocol mismatch and empty-data states.
- Preserved compatibility fallbacks for several older setting keys.
