# Bridge Studio v0.21.0 — Visual Scripting: Signals & Gate Logic

**Purpose:** keep building the original universal game editor, not just visual assets. This release extends the already working 0.20 gameplay graph runtime and editor.

## Implemented vertical slice
- New `signal` graph event and `emitSignal` visual action allow independent graphs to communicate by a safe, named signal (Latin or Cyrillic identifiers).
- Counter-conditional `ifCounter` supports `>=` (default for legacy graphs), `=`, and `<=`. Existing counters, flags and timers are preserved.
- `activation: "graph"` makes interactive components graph-only; doors can no longer be opened directly by E or touch in this mode.
- Reusable two-graph **Three presses to unlock** prefab demonstration adds a button and a graph-only door to the *current* scene, without replacing the project. Three E presses -> a counter condition -> open door -> signal -> a second graph grants 10 coins. A fourth press does not grant another reward.
- Signal names and comparator modes can be edited in the Logic Inspector and persist in `.rwscene`.
- Same runtime in Play and exported HTML. No new remote service, plugin or backend. No WARPGAME-only runtime assumptions.

## Safety
- Signal and counter names are bounded to 40 characters and validated; no arbitrary JS eval for visual graph execution.
- Existing max 96 graph traversal steps and recursion-depth cap 8 guard against recursive signal chains.
- Counter state and graph signal triggers reset on Restart; legacy graph comparison defaults to >= when `compare` is missing.
- Existing Windows signed-patch protocol, RSA key, manifest format, Terrain, and standalone HTML remain unchanged.

## Acceptance tests
1. `node tests/gameplay-v021.cjs`: emit, route, three-press flow, graph-only door, conditional equality, repetition protection, reset, invalid names and operators, recursive signal guard, old graphs.
2. `node tests/gameplay-v021-browser.cjs`: create the demo in a clean project, inspect signal UI, save `.rwscene`, Play three E presses (no early reward), door movement and one reward, WARPGAME HTML export and equivalent game behavior.
3. Existing 0.20, Terrain, material, sculpt and browser regression tests.
4. Only after full CI passes: sign the exact CI candidate with publisher RSA-3072 private key, verify SHA-256 and signature with the public key, deploy immutable payload, then switch live manifest and verify GitHub Pages.
5. Real Windows Bridge.exe install and GPU smoke-test remain separate user-side gates; don't claim they ran.

## Follow-on work
v0.22 Game Systems: inventories, quests, repeatable gameplay templates and stateful systems, while preserving Graphics, Asset Studio, Physics and editor milestones in `SUBPROJECTS.md`.
