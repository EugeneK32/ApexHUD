# Layouts and inheritance

[Russian version](../ru/layouts.md)

A workspace contains HUD profiles. Every profile contains `default` (displayed as **Base Layout**) plus Test Drive, Practice, Qualifying, Race, and Replay children.

Base stores complete module instances. A child stores only local instances, `baseOverrides`, and `hiddenBaseInstanceIds`. Resolution starts with Base, removes tombstoned instances, applies property-level overrides, and appends local instances.

A child override is precise: changing only bounds does not freeze future Base settings. Adding a new Base instance makes it appear in all children unless an instance with that ID is already local or explicitly hidden. Removing a Base instance from a child creates a tombstone, so later Base edits do not resurrect it.

`Reset to Base` clears local instances, overrides, and tombstones. Copying a layout first resolves the source into a concrete document, then writes it into the target according to the target's inheritance rules. This allows copying across profiles without sharing object references.

Layout files are schema v3 workspaces containing schema v1 concrete documents. Migrations must preserve user coordinates and settings. Factory layout changes should target only untouched known defaults; never overwrite an intentionally customized layout.
