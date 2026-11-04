# Graphics Foundation — shadow-quality increment (v0.23)

Status: development candidate; **not included in signed v0.22.2**.

## Rendering contract

- Three.js r128, `PCFSoftShadowMap` in editor, Play, and standalone game.
- `settings.lighting.shadowQuality`: `low` (512²), `balanced` (1024²), `high` (2048²). An unknown value safely resolves to `balanced`.
- `settings.lighting.shadowDistance`: orthographic half-width of the directional shadow camera. Range 12–100 world units, default 30. Smaller values improve nearby texel density, but clip distant shadows.
- `settings.lighting.shadowBias`: depth bias clamped to ±0.005, default -0.0005.
- `settings.lighting.shadowNormalBias`: surface normal offset clamped to 0–0.12, default 0.02.
- Existing `settings.lighting.shadows=false` still switches off shadow rendering. No new settings are required in a legacy `.rwscene`.
- Changes to map resolution dispose the prior GPU render target; changing bias, distance, or sun orientation does not reallocate shadow textures.
- New settings survive `.rwscene` serialization and are embedded in Play and WARPGAME HTML export; no new external resources required.

## Verification

- Node: `node tests/graphics-shadow-quality.cjs` validates old/default settings, malicious values, clamping, resource disposal, and camera projection updates.
- Browser: `node tests/graphics-foundation-browser.cjs` imports a legacy scene, selects high-quality shadows, saves a new `.rwscene`, checks Build and Play state, exports WARPGAME HTML, compares the rendered shadow configuration, and reloads the scene.
- Visual evidence: CI saves `tests/screenshots/graphics-shadow-build.png` and `graphics-shadow-play.png` to its screenshots artifact. Screenshots use software SwiftShader; they **do not** demonstrate real Windows GPU quality or performance.

## Unresolved visual quality risks / acceptance checks

1. On Windows GPU, inspect near/far shadow clipping at distance 12, 30, and 100, including a large Terrain with elevated geometry.
2. Compare acne, peter-panning and false self-shadowing using wood, metal, vegetation GLB and steep Terrain. Default bias is a compromise, not universally correct for every GLB scale.
3. Benchmark FPS and shadow GPU memory for 512/1024/2048 on a real scene; high quality uses up to four times the pixels of balanced. Do not default to high without a performance baseline.
4. Inspect both Build and Play screenshots for the same settings. Shadows may differ slightly because the editor camera and player camera are positioned differently.
5. User must validate installation in Bridge.exe separately after the feature is signed and published.

This is a **rendering quality control** improvement, not a replacement for high-quality authored 3D assets, environmental art, or post-processing.
