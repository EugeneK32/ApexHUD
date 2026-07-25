# Racing-focused visual design

[Russian version](../ru/visual-design.md)

A race HUD is not a dashboard to study. It must communicate state during brief peripheral glances.

- Prioritize one dominant value per widget.
- Use stable geometry; avoid rows jumping as labels change.
- Reserve color for meaning, not decoration. Neutral state should remain quiet.
- Prefer large tabular numerals and short labels.
- Avoid glow, blur, excessive transparency layers, and animation without information value.
- Critical warnings may pulse, but routine values must not flicker.
- Do not flash shift guidance before the car's actual threshold. Protocol v6 provides `shiftIndicatorPercent`, `shiftPowerPercent`, car RPM thresholds, and `revLimiterActive`.
- A blue/downshift suggestion is heuristic and must be clearly different from a simulator-issued command.
- Test at actual racing size over moving scenery, not only in an enlarged preview.
- Support opacity, scale, units, and compact modes only when they improve real use.

For tables, show the player and immediate battle context even outside top N. Multiclass position must label class versus overall unambiguously. For training widgets, preserve traces but clip SVG/canvas drawing inside bounds.
