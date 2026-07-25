# Radar model

[Russian version](../ru/radar.md)

ApexHUD radar is an enhanced spotter visualization, not a world-coordinate scanner. Its authoritative side state comes from iRacing `CarLeftRight`. Lap-distance arrays help associate candidate cars and estimate signed longitudinal separation.

`overlap` in protocol v6 is a normalized `0..1` estimate of side-by-side depth. It is not physical intersection, collision probability, or metres. User-facing settings should avoid the technical word when possible and use labels such as nearby/warning/critical distance.

Contacts can be synthetic when iRacing reports a car on a side but no candidate can be matched confidently. Modules must tolerate negative `carIndex`, unknown side/threat strings, and multiple contacts on one side.

The built-in radar is rendered natively by the overlay instead of inside an iframe to guarantee a transparent background. Normal race mode must draw only car markers; editor selection outlines belong to the editor host, not the radar surface.
