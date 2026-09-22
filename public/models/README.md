Drop the downloaded `.glb` (or `.gltf` + its assets) here as:

    retro-computer.glb

`components/RetroComputer.tsx` loads it from `/models/retro-computer.glb`. Until the
file exists, the terminal panel on the homepage shows a "no model found" placeholder
instead of crashing.

Before adding a downloaded asset here, confirm its license actually permits this use
(embedding in a shipped project) — Sketchfab licenses are set per-model by the
uploader and range from CC0 to fully restricted.
