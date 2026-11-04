# Bridge Studio — ten major subprojects

Project intent: a local Windows 3D authoring environment for quickly creating complete, high-quality Roblox-like games. **Do not attempt to duplicate Unity**. The user creates a gameplay-ready scene with quality visuals and exports HTML independently of WARPGAME; a WARPGAME adapter remains optional.

| ID | Subproject | Scope and completion target |
| --- | --- | --- |
| 01 | Editor Core | Explorer, Inspector, scene tools, camera, Undo/Redo, project files, Build/Play |
| 02 | Gameplay Engine | Serializable event graphs, components, timers, variables, visual condition/actions, interaction chains |
| 03 | Character & Physics | Controller, movement, collision, slope handling, NPC, AI, vehicles, animation |
| 04 | World & Terrain | Terrain, brush editing, vegetation, water, roads, large-world placement |
| 05 | Graphics & Rendering | Stylized lighting, shadows, PBR materials, post-FX, graphic style presets and performance |
| 06 | Asset & Animation Studio | GLB imports, reusable prefabs, animation clips, quality-reviewed asset sets |
| 07 | UI, VFX & Audio | UI constructor, particles, audio, polished game HUDs and rewards |
| 08 | Game Systems & Kits | RNG, Simulator, Tycoon, Obby, inventories, economy, quests and persistence |
| 09 | Build & Platform SDK | Offline/standalone HTML, WARPGAME 3 MB output profile, platform adapters |
| 10 | QA & Updates | Browser integration tests, screenshots, performance, signed patches, rollback |

Each track owns a specification, tests, a shippable vertical slice and integration contracts. **One Windows application**, one repository and backwards-compatible project schema remain the default. The 3 MB limit applies solely to the WARPGAME HTML artifact.

## Release approach

- Maintain a shipping baseline in `main`. All work starts from latest verified source, not a rewrite.
- Prefer playable vertical slices over disconnected demos.
- Do not publish an unsigned `updates/manifest.txt`; security validation and rollback are core release requirements.
- Acceptance requires real Play, exported HTML and .rwscene read/write, and visual QA whenever the task touches rendering/assets.
- Do not claim Windows Bridge.exe validation without evidence from a local Windows run.
- Graphics/Asset tracks may advance alongside Gameplay, but new asset kits require proof of visual quality, not placeholder primitives.

## Current execution order

- v0.20.0: Gameplay Engine timers and counters (see `GAMEPLAY_V020_SPEC.md`).
- v0.21: visual actions/conditions, gameplay component presets.
- Then co-develop Graphics and Asset Studio quality baseline, Character/Physics, and UI/VFX/Audio against an actual playable Game Kit.
- Preserve the independent HTML runtime and the signed update system through all milestones.
