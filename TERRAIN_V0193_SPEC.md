# Bridge Studio v0.19.3 — Terrain slope collision

Status: **candidate on feature branch**, NOT a signed live release. v0.19.2 manifest remains active.

## Reproduction
Prior `walkHeightfield()` accepted `climb=.45` at *every* horizontal substep, independently of triangle slope. A 60–89° hill could be ascended through repeated tiny displacements. Runtime also marked all terrain landings as grounded.

## Changes
- Add triangle-exact `sampleSurface()` with upward unit normal and slope angle. Surface interpolation matches rendered Terrain triangles.
- Keep the existing continuous horizontal sweep and object blockers, but disallow positive progress into any triangle with slope above the configured limit.
- Expose project `maxWalkableSlopeDeg` (0–89°, default 45°), persisted in `.rwscene`; old documents remain readable.
- Allow tangent movement on steep hills; apply gravity-driven downhill `slideHeightfield()` without uphill snap.
- A steep contact no longer grants `grounded` or jump reset.
- Use the same `src/game_runtime.js` and `src/terrain_core.js` in Play and WARPGAME export.

## Automated QA
- `node tests/terrain-slope.cjs`: 0°, 15°, 30°, 44°, 45°, 46°, 60°, 80°, 89°; exact normals, configurable 30°, solid blockers, downhill slide, 20/30/60/144 FPS, seams.
- `node tests/terrain-walk.cjs`: existing cliff/ridge regressions.
- `node tests/terrain-browser.cjs`: isolated Play and exported HTML both reject forward movement up a 60° slope.
- Rebuild with `python3 tools/build_studio.py --output <candidate.html>`; v0.19.2 deterministic reference must remain unchanged.

## Release gates
1. CI green for syntax, unit tests, browser WebGL, Play/Export.
2. Static/manual inspection of gameplay behavior, frame-to-frame sliding, boundary cases and backward compatibility.
3. Authenticated signing using the existing publisher private key in a protected environment; no public key disclosure.
4. Verify exact SHA-256, file size, signature, rollback, GitHub Pages and Windows Bridge.exe installation.
5. Activate v0.19.3 **only after** the above gates. Never publish an unsigned manifest.

## Next roadmap
v0.20 World Building: vegetation, high-quality assets, brush placement, batching, prefabs and GPU/3 MB export budgets.
