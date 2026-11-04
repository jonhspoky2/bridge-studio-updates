# Bridge Studio v0.20.0 — Gameplay Engine: timers and counters

Status: release candidate; preserve live signed v0.19.4 until full QA and signing are complete.

## Existing foundation (not rewritten)

The project already has a serializable visual graph editor, node links and events, NPC/door/teleport/pickup/health components, Scene Editor, Play/Stop, .rwscene saves and WARPGAME HTML. This release extends those modules.

## New vertical slice

- New graph trigger **Timer / По таймеру** with configurable interval **0.1–3600 seconds**.
- Deterministic **tick(dt)** advancing in the *existing* game frame; no browser setInterval or background worker.
- **Изменить счётчик** node with **Add**/**Set**, bounded numeric values and safe key storage.
- **Если счётчик ≥** conditional node with yes/no graph links.
- In the Logic tab the interval control appears only for timer graphs; object source is disabled because timers are scene-global.
- **Демо: таймер и счётчик** button adds a complete reusable graph to the CURRENT project rather than destroying it: every 3 timed activations, award 5 coins and reset the counter.
- Debug runtime exposes counters with existing graph trace; shared Play and HTML runtime.
- Old scenes with no timers/counters remain backward-compatible. Existing .rwscene graph format remains unchanged.

## Safety and limits

- Graph limit 100, nodes 80 and links 160 per graph, steps per activation 96.
- Up to 4 timer firings per graph per update; delta time bounded to 0.25 second.
- Counter names allow ASCII/Cyrillic alphanumeric identifiers of 1–40 chars. Counter values clamped to [-1,000,000; 1,000,000]. No prototype pollution.
- Timer interval [0.1, 3600] seconds, and invalid timer/counter fields detected by project validation.
- Timer state/counters reset on restarting the game; normal respawn does not erase progression.

## QA matrix

1. Node: timer startup and recurrence, branching and rewards, reset, disabled timer, huge dt handling, valid Cyrillic names, invalid configuration, prototype safety, legacy project.
2. Browser: editor creates example, interval edited, .rwscene preserves graph, Play creates coins on timeout, Stop preserves project, WARPGAME HTML produces identical behavior under offline network routing.
3. Baseline: Terrain physics, materials, Sculpt UI and exported HTML regressions.
4. Security: Play sandbox and signed update format not modified.
5. Publish: sign candidate using authorized publisher key only after CI green; verify hash/signature, activate manifest and GitHub Pages; Windows Bridge.exe smoke-test remains a separate real-device gate.

## Large project structure

Long-term development consists of Editor Core, Gameplay Engine, Character/Physics, World/Terrain, Graphics/Rendering, Asset/Animation Studio, UI/VFX/Audio, Game Systems/Kits, Build/Platform SDK, QA/Updates. v0.20 focuses on Gameplay Engine without dropping the other nine tracks.

## Next slice

v0.21 visual conditions/actions: named persistent variables, reusable component presets, gameplay interaction events, reusable game-kit building blocks. The local gameplay state in this release is NOT cloud persistence.
