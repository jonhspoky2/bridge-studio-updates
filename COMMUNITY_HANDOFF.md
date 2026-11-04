# Bridge Studio — community handoff (2026-11-04)

> **Original author: [jonhspoky2](https://github.com/jonhspoky2). Copyright © 2026 jonhspoky2.**
>
> **Project status: frozen / seeking volunteer maintainers.** The existing repository remains accessible to the community. No promise of future updates, support or project stewardship is made.

## What is Bridge Studio?

Bridge Studio is a local-first 3D game editor built around Three.js r128 and WebGL. It is intended to provide a lightweight Roblox Studio-like editing workflow for building games that can be exported as a single HTML file for WARPGAME. It was not intended to reproduce Unity's entire feature set.

- Build/Play editor with WASD navigation, mouse selection, Move/Rotate/Scale and Terrain tools.
- Visual gameplay logic, timers, signals, counters and components (doors, NPC conversations, collectibles, triggers, checkpoints, etc.).
- Terrain sculpting and painting, graphics/lighting presets and PBR material library.
- GLB model import, prefabs, library export/import and `.rwscene` project saves.
- Quest, collection, local economy/inventory and opt-in local progress-save systems.
- Embedded HTML game output with WARPGAME profile subject to a strict **3,000,000-byte limit**; editor itself is not subject to this limit.
- Local Windows host integration with a signed update channel; the host/installer may require additional assets and build instructions not present in this repository.

**Latest published signed updater manifest at handoff:** v0.22.2 (`updates/manifest.txt`). The community should not confuse unreleased branches/PRs with published official patches.

## Implementation map

| Path | Responsibility |
| --- | --- |
| `src/studio_template.html` | Editor HTML, layout, CSS and embedded module includes |
| `src/studio.js` | Main editor state, scene operations, UI, importing and exporting |
| `src/game_runtime.js` | Play and exported-game runtime |
| `src/gltf_loader.js` | Custom lightweight glTF/GLB importer |
| `src/gameplay_core.js` | Visual gameplay triggers, state and logic |
| `src/quest_core.js` / `economy_core.js` | Quests, collecting and economy |
| `src/terrain_*.js` | Terrain data, sculpting and painting |
| `tools/build_studio.py` | Reproducible single-file editor build |
| `tests/` | Node and Chromium browser integration tests |
| `updates/` | Archived signed patch assets and signed updater manifest; **do not modify to make a community release** |

There is no automatic migration to the latest Three.js API. Code is explicitly tied to **r128**.

### Reproduce the editor

```sh
python3 tools/build_studio.py --output studio.html
```

Some browser features require a local host. The Windows updater relies on host-specific authorization and publisher signing; opening generated HTML in a normal browser is not a substitute for installation testing.

### Automated test examples

```sh
node tests/terrain-core.cjs
node tests/terrain-slope.cjs
node tests/quest-v022.cjs
node tests/quest-collect-regression.cjs
```

For Playwright / Chromium test setup and full CI commands, use `TESTING.md` and `.github/workflows/terrain-source.yml`. Passing CI does not certify Windows GPU behavior or real-user WARPGAME authentication.

## Known gaps and potential volunteer projects

1. **Animations and skinned GLB meshes**: The custom `gltf_loader.js` explicitly warns that animated/skinned glTF currently imports only static geometry. For Roblox-quality character motion, skeletal animation, clip blending and a proper animation pipeline are required.
2. **Art and content quality**: Current graphics settings do not include a professional original model library. Prioritize original GLB assets and an end-to-end scene over adding more settings.
3. **Monolithic editor code**: `src/studio.js` is large; carefully extract modules with regression tests, without invalidating existing source includes or exports.
4. **Windows QA**: No complete guarantee for user-specific installed Bridge.exe, GPU drivers, display scaling or update/rollback paths.
5. **Maintenance debt**: Historical `PROJECT_STATE.md` and `ROADMAP.md` contain old version statuses. Some older draft PRs remain open even though their code was included in release PR #27; avoid cherry-picking them blindly.
6. **Rendering candidate**: PR [#28](https://github.com/jonhspoky2/bridge-studio-updates/pull/28) contains shadow quality, distance, bias and Build/Play/HTML parity work. It was not included in v0.22.2 at the time of handoff and should be reviewed before reimplementation.

## Release boundary and security

The canonical GitHub Pages update channel expects a valid **RSA-3072** publisher signature, with size/hash verification. **The private signing key is not part of the open-source project and is not granted under MIT.**

Community forks can build and distribute their own versions under MIT using their own update channels, names, identities and keys. They **must not** claim that a fork's unsigned or independently signed binaries are official updates issued by the original author. Never disable existing signature validation just to make a branch look like an official patch.

## What a successful successor project would deliver

- One original styled demonstration game with original GLB art, animated characters and effects.
- Repeatable Build / Play / exported HTML rendering.
- Valid `.rwscene` files with backward-compatible migrations.
- Measured FPS, memory, draw calls and export sizes, plus visual screenshots.
- Reliable Windows smoke tests and clear user installation guidance.

## Intellectual property and trademarks

**Code copyright © 2026 [jonhspoky2](https://github.com/jonhspoky2)**, licensed under **MIT** (see [LICENSE](LICENSE)). The original copyright/license notice must be preserved when the code is redistributed. Third-party assets and libraries retain their respective rights and licenses. Roblox and WARPGAME are mentioned as compatibility/market context, not as endorsements. Any externally sourced media must be separately checked before redistribution.

### Русское резюме

Проект **Bridge Studio заморожен**. Репозиторий оставлен открытым, чтобы желающие могли изучать исходники, делать форки и развивать редактор. Автор и правообладатель кода: **jonhspoky2 (© 2026)**. Лицензия MIT разрешает модификацию и публикацию при сохранении уведомления об авторских правах и текста лицензии. Подписанные официальные патчи больше не выходят автоматически. Для развития используйте отдельные ветки и PR; возможна самостоятельная поддержка форка.
