# Reparto 4 — Godot Web

Reparto 4 is a Godot 4.7 project exported as a static web game and embedded in
the Vue arcade. The portal and its other games remain on Vue/TypeScript.

## Play and export

Open this folder in Godot 4.7, or run the project with `godot --path
godot/reparto4`. To regenerate the version served by the portal, install the
matching Godot Web export templates and run `npm run export:reparto4` from the
repository root. The export is written to `public/games/reparto4/`.

The browser build uses the single-threaded WebAssembly template for broad
compatibility with static hosting. It needs a modern browser with WebGL 2.

## Gameplay slice

The opening offers a skippable, interactive story tutorial. Learn movement,
identify the Degente with the flashlight, sneak past it, and collect a battery;
press `T` to leave the tutorial at any time. During the main exploration, the
Degente patrols and pursues the player when it sees light or hears a sprint.
The flashlight can interrupt it, but consumes battery.

Collect the security badge and fuse to open the emergency exit. Four documents
reveal why patient Luca Valli disappeared from the official evacuation records;
press `J` to pause and reread collected evidence. The level uses procedural
geometry and PBR surfaces as a playable prototype, not photorealistic or
production-ready character assets.

## Textures

The PBR textures under `textures/reparto4/` are copied from
`public/textures/reparto4/`. Their Poly Haven CC0 sources and usage are
documented in `public/textures/reparto4/README.md`.
