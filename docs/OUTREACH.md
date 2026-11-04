# Bridge Studio — public discovery & community outreach kit

**Status:** source publicly released, **frozen since 2026-11-04**, looking for independent maintainers. Copyright © 2026 [jonhspoky2](https://github.com/jonhspoky2); [MIT license](../LICENSE).

**Canonical links**

- GitHub source: https://github.com/jonhspoky2/bridge-studio-updates
- Landing page: https://jonhspoky2.github.io/bridge-studio-updates/
- Experimental browser preview: https://jonhspoky2.github.io/bridge-studio-updates/updates/v0.22.2/studio.html
- Real screenshots: https://github.com/jonhspoky2/bridge-studio-updates/blob/main/docs/SHOWCASE.md
- Community handoff: https://github.com/jonhspoky2/bridge-studio-updates/blob/main/COMMUNITY_HANDOFF.md
- Maintainer issue: https://github.com/jonhspoky2/bridge-studio-updates/issues/30

## Recommended GitHub repository metadata

The GitHub repository settings must be changed by its administrator. A README cannot substitute for repository-level Topics.

**Name:** `bridge-studio` (optional; GitHub typically redirects old repository URLs when renamed, but verify deployment paths and updater URLs first; do **not** rename without checking signed update compatibility).

**Description (paste into About):**

> Bridge Studio — open-source Three.js r128 / WebGL 3D game editor with terrain, visual scripting, GLB and HTML export. MIT; community maintainers welcome.

**Homepage (paste into About):**

> https://jonhspoky2.github.io/bridge-studio-updates/

**GitHub Topics:**

`threejs`, `webgl`, `3d`, `game-editor`, `game-development`, `open-source`, `mit-license`, `gltf`, `javascript`, `warpgame`

Do not use `unity` or `roblox` as first-party identifiers, and do not imply affiliation. The current repository name is part of the official update-hosting path; renaming it could break links if redirects or GitHub Pages deployment are not configured.

## Hacker News — submission draft

**Suggested title:** Show HN: Bridge Studio – a small open-source 3D editor built with Three.js r128

**URL:** https://github.com/jonhspoky2/bridge-studio-updates

**First comment (post as yourself):**

> I built an experimental 3D editor around Three.js r128 and WebGL, originally to simplify creating HTML games for a platform with a strict 3 MB exported-game limit. It includes terrain editing, Build/Play, visual gameplay logic, GLB import, a small quest system, and a single-file HTML export pipeline.
>
> The editor is functional but has clear limitations: skeletal GLB animation isn't supported in the custom importer, the source is fairly monolithic, and the Windows host/GPU paths need more testing. I've frozen my own development and published the source under MIT so anyone interested can fork it or take over maintenance.
>
> Screenshots, source and a browser-preview link are in the README. If you try it, I'd appreciate technical feedback, especially on glTF animation support, Three.js architecture and sustainable testing.
>
> © 2026 jonhspoky2.

**Important:** Hacker News [Show HN guidelines](https://news.ycombinator.com/showhn.html) require something visitors can actually try. Test the browser preview or source build before submitting, and be available to answer questions. Don't ask anyone to artificially upvote. No post has been submitted automatically.

## Reddit / Three.js developer community — draft

**Suggested title:** I open-sourced my frozen Three.js 3D game editor (MIT). Looking for anyone who wants to continue it.

**Body:**

> I built Bridge Studio, a local-first 3D editor based on Three.js r128/WebGL. It has a Build/Play viewport, terrain sculpting/painting, basic GLB assets and PBR materials, visual scripting, quests and HTML game export.
>
> The project is experimental, not a finished Roblox Studio alternative. The biggest missing pieces are animated/skinned glTF support, higher-quality example assets and Windows GPU testing.
>
> I'm pausing development and have released the code under MIT with the original author credited. The repository includes screenshots, a reproducible Python build, Node/Playwright tests and community handoff documentation.
>
> Source: https://github.com/jonhspoky2/bridge-studio-updates
>
> Screenshots: https://github.com/jonhspoky2/bridge-studio-updates/blob/main/docs/SHOWCASE.md
>
> I'd welcome constructive code review, forks or anyone interested in maintaining it. No obligation to work under my account: a fork is fine.

**Post only where permitted** by the particular community's up-to-date self-promotion rules, and participate in the discussion. Do not mass-post across unrelated subreddits. No external Reddit post has been published automatically.

## Dev.to / developer blog — article outline

**Title:** I froze my Three.js 3D game editor and open-sourced it: what works and what doesn't

1. The motivation: make simple HTML 3D game creation accessible without a heavyweight engine.
2. The actual architecture: Three.js r128, `.rwscene` JSON, local Build/Play, source-file expansion into one HTML.
3. Concrete screenshots from `docs/design-d01/`; label them as Chromium/SwiftShader captures.
4. The hard restriction: exported WARPGAME HTML <=3,000,000 bytes.
5. Failures and limitations: custom glTF loader lacks skeletal animation; source monolith; missing original art.
6. Invitation to fork and build upon the MIT source, with `CONTRIBUTING.md`, automated tests and maintainer issue.

## Русский — краткое объявление для сообществ

**Заголовок:** Отдаю в open source свой 3D-редактор Bridge Studio на Three.js / WebGL (MIT)

> Я заморозил Bridge Studio — экспериментальный редактор 3D-игр, который создавал для WARPGAME. Он умеет редактировать сцены и Terrain, запускать Play, импортировать базовые GLB, собирать визуальную игровую логику и экспортировать HTML.
>
> Исходники теперь публичные под MIT. Автор: jonhspoky2 (© 2026). Проект не претендует на готовый аналог Roblox Studio: полноценная скелетная анимация GLB и качественный набор ассетов пока отсутствуют.
>
> Если кому-то интересно развивать движок или сделать свой форк — добро пожаловать. В репозитории есть код, скриншоты, инструкции сборки и тесты.
>
> GitHub: https://github.com/jonhspoky2/bridge-studio-updates
>
> Для связи в проекте: https://github.com/jonhspoky2/bridge-studio-updates/issues/30

## Visibility tracking (do not fabricate engagement)

Record a baseline of stars, forks and external contributions before and after each authorized post. Avoid repeatedly checking hourly; weekly review is sufficient. Follow real conversations, code contributions and issues, not only vanity metrics.

**Important rights note:** MIT permits third parties to fork, use, change and redistribute code, including commercially, provided the license and author notice are retained. It does not require contributors to hand control back to the original author.
