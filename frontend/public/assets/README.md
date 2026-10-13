# Artwork provenance

These assets were generated with the built-in image generator from the user-approved PixelPlaza mockup, then copied unchanged into the project. They are actual raster assets, not CSS scenery. The original generation was performed on 2026-10-13.

- `plaza.png`: recreate only the cozy environment; remove header, sidebar, characters and text. Preserve fountain, cottages, trees, benches, paths and lower-left pond.
- `cat.png`: isolated front-facing peach cat, complete body/tail, crisp pixel style and transparent background.
- `sprout.png`: isolated round green sprout with paired leaves, eyes and feet, transparent background.
- `mushroom.png`: isolated coral mushroom cap and cream body, complete sprite with transparent background.
- `robot.png`: isolated blue robot with dark visor, pale eyes, short antenna and legs, transparent background.

`frontend/src/sprite-bounds.json` identifies the solid sprite area for Phaser texture frames; the PNGs themselves are not modified. Movement uses position updates, a small walking bounce and directional flip rather than a generated animation atlas.
