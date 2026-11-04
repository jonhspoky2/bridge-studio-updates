# Bridge Studio v0.22.0 — Game Systems: Quests & Local Progress

Release status: candidate. **The published and publisher-signed version is still v0.21.1 until CI, signing and staged GitHub Pages checks pass.**

## Scope completed in this slice

Bridge Studio already has a functional shop, currency, stackable items, visual scripting, interactable objects, and Play/HTML export. This slice adds a reusable **Quest Core**, rather than replacing those systems.

- Author quests in the existing UI tab: ID, title, event (`interact`, `collect`, `buy`), object/item source, quantity required and reward in coins or catalog item.
- Reward can be claimed **once** after the objective is completed; a full inventory blocks item rewards without granting partial coin rewards.
- `Q` key opens a quest log, showing live progress and a button to claim. Custom UI buttons with action `quests` also work.
- Add a sample game interaction to the current scene without deleting objects: yellow quest button near Spawn, 3×E goal and 20-coin reward.
- Shop purchases advance `buy` quest goals, collectible events advance `collect` quest goals, and E/click advance `interact` quest goals.
- Project `.rwscene` includes quest *definitions* and a project ID. It does not contain the player's save data.
- Optional `settings.saveProgress` stores per-project money, inventory, purchases, collected item IDs and quest state in browser `localStorage`. Saving is disabled by default for existing projects; sample demo enables it.
- Resuming in the **same website origin and browser profile** restores the game state after reloading the exported HTML.
- Restart resets current-session state intentionally. This is a local single-player save, not a secure server-side or multiplayer save.
- Existing `BridgeEconomy` gains a validated `restore` method and a purchase-event hook; old scenes are compatible.
- Keep standalone HTML available without a WARPGAME-specific backend. WARPGAME profile still has a hard 3 MB HTML limit.

## Architectural boundaries

- `src/quest_core.js` — pure deterministic quest engine; no DOM/Three.js and unit tested.
- `src/economy_core.js` — existing shop/inventory, now with safe restoration and purchase notifications.
- `src/gameplay_core.js` — optional event hook (backward compatible).
- `src/game_runtime.js` — quest HUD, Q key, reward claims, optional browser save, Play/HTML integration.
- `src/studio.js`, `src/studio_template.html` — quest editor and sample, with existing D-01 design language.
- `tools/build_studio.py` — bundles Quest Core from source.

## Known limitations / validation

- Local save depends on access to `localStorage`. A sandboxed Play iframe may have no storage permission; *standalone exported HTML* must be used for the persistence acceptance test. Storage is per browser origin, not shared across domains, devices or other browsers. No player accounts, cloud sync, encryption or anti-cheat are added.
- Quest progress counts successful game events. Existing user-authored JavaScript remains separate from this no-code quest feature.
- Runtime tests: `tests/quest-v022.cjs` and `tests/quest-v022-browser.cjs`. Browser covers .rwscene, E/Q, single claim, save/reload and WARPGAME HTML size.
- Existing Gameplay v0.20/0.21, Terrain/Sculpt, UI Foundation and HTML export regressions remain mandatory.
- Real Windows Bridge.exe installation and hardware GPU tests are not verified by CI.

## Next v0.22 slices

Improve inventory item-use/actions, reusable quest chains, objective HUD and optional exportable game templates after this core is stable. The overall ten-part architecture stays in `SUBPROJECTS.md`.
