---
name: PixelPlaza
description: Cozy daytime pixel plaza with a quiet chat interface
colors:
  background: "#fbf5e5"
  text: "#443438"
  muted: "#75665b"
  primary: "#397a50"
  primary-hover: "#28663e"
  leave: "#ce5e54"
  border: "#d8c6aa"
typography:
  display:
    fontFamily: "Pixelify Sans, sans-serif"
    fontWeight: 600
    lineHeight: 1.03
  body:
    fontFamily: "Nunito, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
rounded:
  control: "8px"
  image: "16px"
spacing:
  small: "8px"
  base: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "12px 22px"
---
## Overview
The user approved the cozy pixel map and cream chat-sideboard mockup. Preserve this direction. Pixel assets carry the world; ordinary interface text stays clear and readable.
## Colors
Warm cream, cocoa text, garden-green primary controls and coral leave action. Character accents reflect the four sprites, not arbitrary decorative palettes.
## Typography
Pixelify Sans for the brand and introductory headings; Nunito for forms, chat and instructions. Match the selected mockup's pixel lettering rather than the generic face suggested by automatic font matching.
## Layout
72px desktop header. Lobby fills remaining viewport with map and 335px chat sidebar. Under 600px, 62px header with map above chat, no horizontal overflow, and touch walking controls. Landing leads to a name/character form and the lobby.
## Elevation & Depth
Keep the lobby flat and quiet. A soft offset shadow only frames the landing's world image. No glass or heavy HUD.
## Shapes
Small rounded controls, clear field borders, restrained scene frame. Preserve crisp pixel artwork with nearest-neighbor rendering.
## Components
Four character radios with visible selected/focus state. Chat supports loading/errors/empty state and wraps long text. Speech bubbles stay above the speaker for six seconds. Movement keys only act when the canvas is focused; touch controls act while held.
## Do's and Don'ts
Use genuine generated raster assets from the approved reference. Do not substitute drawn scenery or add inventories/quests. Keep API keys outside frontend code. Respect reduced-motion preferences by removing avatar bounce.

## Admin extension
`/admin` retains the cream/cocoa/green palette and existing typefaces. Sign-in centers a 400px form with Back to plaza above it and no logo header. Management uses a 248px left sidebar with Lobbies/Analytics navigation and flexible full-width content; Admin management is centered beneath the PixelPlaza wordmark. Room previews are 112px on desktop. On mobile the hamburger opens a right-side drawer, and room actions stack below each heading. Closing a lobby uses muted red and requires confirmation; opening uses green. Sign-out and player removal also require confirmation. Admin headings use Pixelify Sans; operational text uses Nunito, with tabular counts. Room frames use 12px radii and previews 8px. Errors use the alert treatment. No decorative effects or analytics mock charts.
