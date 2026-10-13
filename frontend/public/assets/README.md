# Artwork provenance

These assets were generated with the built-in image generator from the user-approved PixelPlaza mockup, then copied unchanged into the project. They are actual raster assets, not CSS scenery. The original generation was performed on 2026-10-13.

- `plaza.png`: recreate only the cozy environment; remove header, sidebar, characters and text. Preserve fountain, cottages, trees, benches, paths and lower-left pond.
- `cat.png`: isolated front-facing peach cat, complete body/tail, crisp pixel style and transparent background.
- `sprout.png`: isolated round green sprout with paired leaves, eyes and feet, transparent background.
- `mushroom.png`: isolated coral mushroom cap and cream body, complete sprite with transparent background.
- `robot.png`: isolated blue robot with dark visor, pale eyes, short antenna and legs, transparent background.

The original standalone sprites remain available as the first artwork version.

## Animated characters, version 2

`characters-v2.png` was generated on 2026-10-13 using the four original character PNGs as identity and palette references. The prompt requested a transparent eight-column, four-row animation sheet with more detailed pixel shading. Rows are Milo, Fern, Pip, and Bolt. Columns 0–3 contain neutral, breathing/eye movement, and blink poses; columns 4–7 contain alternating walking poses.

The generated source is 1774 × 887 RGBA. `scripts/prepare-art.py` exports registered 64 × 64 cells into `characters-garden.webp` and `characters-haunted.webp`; the corresponding character metadata records their shared foot anchors and body heights. Both UI portraits and Phaser use these atlases. Body heights are normalized, and idle timing includes eye movement and blinking. Occasional small hops and shifts are runtime motion of the accepted artwork, rather than additional drawn poses.

Eight generated directional source sheets are preserved under `art/source/`; `art/directional-inputs.json` records their original built-in image-generation outputs. Each runtime walking atlas has eight directions with eight poses per direction. Walk phase follows distance travelled, and dust is emitted at foot contacts. Reduced-motion preferences disable idle motion and particles.

`scripts/prepare-collision.py` derives shared collision masks from the runtime artwork. Character body silhouettes collide with the fountain and benches; tree masks cover the trunk and roots rather than the canopy. These masks are used by both the frontend and authoritative backend.

Lobby music is original Web Audio synthesis in `frontend/src/lobby-music.js`: a soft major-key triangle melody for Garden Plaza and a sparse minor-key sine bell melody for Haunted Hollow. No external music recordings are used.
