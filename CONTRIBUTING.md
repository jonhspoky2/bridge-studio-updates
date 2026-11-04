# Contributing to Bridge Studio

**Project status: frozen by original author; community-maintained work is welcome.**

Bridge Studio is no longer under active feature development by its original maintainer (as of November 4, 2026). This repository remains public so others can study, fork, improve and potentially maintain it. Issues and pull requests are welcome, but **reviews, merges, fixes, security updates and release schedules are not guaranteed**.

## How to help

1. Read [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [COMMUNITY_HANDOFF.md](COMMUNITY_HANDOFF.md).
2. Fork this repository and create a feature branch based on the latest `main`.
3. Make a small, reviewable change that does not break current `.rwscene` projects.
4. Run the reproducible source build and the appropriate Node or browser integration tests.
5. Open a pull request explaining the feature or bug, the test evidence and known limitations. Include screenshots for graphics, UI and rendering changes.
6. Coordinate with other potential maintainers using GitHub Issues rather than creating overlapping branches.

## Local build

```sh
python3 tools/build_studio.py --output studio.html
```

The generated `studio.html` is the editor. It is **not automatically an authenticated or signed Windows update**. The separate Windows host/update service is not automatically installed by running the HTML file.

Example unit checks:

```sh
node tests/terrain-core.cjs
node tests/quest-v022.cjs
node tests/quest-collect-regression.cjs
```

Browser tests use Chromium, Playwright and Three.js r128; see [TESTING.md](TESTING.md) and [the CI workflow](.github/workflows/terrain-source.yml) for the tested environment.

## Important compatibility and release boundaries

- Keep Three.js **r128** compatibility unless a migration plan, evidence and backward-compatibility tests are provided.
- The **3,000,000-byte** size budget applies to the *exported WARPGAME HTML game*, not to the editor, models on disk, or `.rwscene`.
- Preserve existing `.rwscene` format/version and add migration tests for schema changes.
- Keep testable Build, Play and exported-HTML behavior aligned.
- The official `updates/manifest.txt` channel is **publisher signed**. Do not modify, replace or publish a manifest/payload as an official Bridge Studio update without authorization from the signing-key owner.
- Never commit API tokens, certificates, credentials, signing keys or private game/user data.
- A pull request is *not* a signed published patch or an official Windows installation.

## Rights and attribution

Code made available under [the MIT License](LICENSE) may be forked, modified and redistributed, including commercially, provided the copyright notice and license are preserved. Contributions offered to the project should be compatible with MIT. Third-party fonts, code, models, textures and audio must carry compatible licenses and their required notices. Do not copy proprietary Roblox game models, branding, sounds or other assets into this repository.

The **Bridge Studio** project is independent and is not endorsed by Roblox, Three.js or WARPGAME.

## Suggested first contributions

- Improve GLB/glTF animation and skinning support; currently the custom loader only renders static geometry.
- Improve graphical quality using **original authored GLB models** and transparent screenshot comparisons.
- Add reproducible asset import tests, old-scene fixtures and Windows smoke-test instructions.
- Clean up superseded stacked draft PRs and update stale release-state documents.
- Improve performance and exported HTML diagnostics without increasing the WARPGAME budget.
