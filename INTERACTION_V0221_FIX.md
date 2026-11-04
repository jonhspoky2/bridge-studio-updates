# Bridge Studio v0.22.1 — Quest Interaction & Manual Coins Hotfix

## Reproduction from installed Windows v0.22.0

User screenshot: Play quest journal showed **0/3** while coin counter was **3**. Walking near coins immediately collected them; E did not progress the intended quest.

## Root causes

1. Legacy `collect` object action fired unconditionally in every contact frame, without an explicit activation-mode setting.
2. E chose the absolute closest trigger object (including auto-pickup coins) rather than an actionable gameplay target / incomplete quest.
3. `action(q)` emitted an `interact` graph event while E subsequently called `gameplay.interact`, causing **two graph emissions** for some world objects.
4. There was no visible indication which object would react to E, leaving unclear why the quest counter remained unchanged.

## Implemented

- Default `collect` and Pickup components to **manual E / click**. Explicit `actionActivation:touch` or component `activation:touch` keeps proximity collection.
- Inspector exposes **Активация действия** (manual / touch), including old .rwscene object configs with no new field.
- E and click share one interaction route, prioritize a nearby incomplete quest target, and skip touch-only objects.
- Show prompt `[E] Задание · Квестовая кнопка ... · 0/3` in Play and exported HTML; quest progress also appears in objective.
- Quest demo places a brighter, larger golden button in front of Spawn.
- Only one `interact` graph signal is generated per manual action. Coin saves are persisted after the pick-up state is committed.
- Existing .rwscene remains backwards-compatible and needs no manual schema migration. Existing saved projects retain positions and object IDs.

## Acceptance

- Node: `tests/interaction-v0221.cjs` verifies legacy pickup no longer autocollects, repeated E does not duplicate, explicit touch remains valid.
- Browser: `tests/interaction-v0221-browser.cjs` places a legacy coin **on Spawn** and an incomplete quest button nearby; verifies no autocollection, E prioritizes quest three times, E then picks coin, interact graph fires once, Q grants a single reward, HTML export and local save restore.
- Regression: legacy Gameplay, Terrain, Sculpt, v0.22 quest and D-01 UI tests.
- Publish only after full CI, immutable HTML SHA-256 verification, publisher RSA signature verification, GitHub Pages availability and signed manifest activation.
- Windows Bridge.exe / GPU live validation remains a separate real-machine check.

## User test after installing

1. Open the existing Coin Rush project. Do not overwrite it with a new demo.
2. Start Play: move toward a coin. It should **not** be collected automatically.
3. Approach a coin until `[E] Подобрать ...` appears, then press E.
4. Go to the gold quest button near Spawn, wait for `[E] Задание · ...`, press E three times.
5. Open Q to verify progress 3/3, claim exactly once; confirm one-time reward and save/export behavior.
6. To restore automatic pickup for a specific object: Inspector > **Активация действия** > **Касание — автоматически**.

**Note:** A downloaded WARPGAME HTML game or browser session can only persist to the same origin/browser profile. Editor .rwscene stores definitions, not player save data.
