# Проверки

## Запуск

Для браузерной серии нужны Node.js, Playwright, Chromium с WebGL и локальный three.min.js версии r128. Из корня репозитория задайте THREE_R128 с путём к библиотеке. CHROMIUM_BIN задаёт исполняемый файл браузера, SWIFTSHADER=1 включает программный рендер. BRIDGE_EXAMPLES может указывать на examples из полного архива v0.18.0.

```sh
node tests/patch-save-v0182.cjs
node tests/build-v0183.cjs
```

Тесты используют loopback-адрес через перехват запросов. Внешние сервисы WARPGAME, включая авторизацию, не участвуют. Старые Python-тесты из архива привязаны к его путям, payload и окружению. Их наличие не считается прохождением на текущем выпуске.

## Фактически пройдено

| Область | Сценарий и результат |
|---|---|
| Регрессия обновлений | Повторный прогон patch-save-v0182 прошёл все проверки. Дополнительно v0.18.2 с изменённой сценой отклонила установку по «Нет, отмена», затем записала файл через реальный writable stream в браузерном хранилище и перезагрузила v0.18.3. Ответы хоста в этой UI-проверке моделируются. |
| Редактор | Создание куба, Undo/Redo, импорт реального GLB, загрузка .rwscene. После Play/Stop глубокое сравнение документа совпало. |
| Совместимость | coin-rush-project.rwscene и gameplay-lab.rwscene из v0.18.0 прошли открытие, скачивание файла и повторное открытие. Проверены ID, дополнительные метаданные и состояние всего повторно открытого документа. |
| Экспорт | Игра WARPGAME открылась в Chromium с Three.js r128 и SwiftShader. Персонаж встал на поверхность и переместился по клавише W. На сцене с многобайтным текстом итоговые 3 000 000 байт разрешены, 3 000 001 байт остановлен; выше порога оба Standalone скачиваются. |
| Ядра | Архивные Node-тесты gameplay и economy прошли, их исходники совпадают с соответствующими встроенными ядрами v0.18.3 после удаления краевых пробелов. Проверены ветвление, разовый подбор, урон и задержка, лечение, чекпоинт, телепорт, NPC, смерть, ограничения покупки и сброс состояния. |
| Синтаксис | JavaScript из исполняемых и текстовых script-блоков HTML v0.18.3 проверен через node --check. |
| Установщик | BridgeUpdateService.cs из v0.18.0 с исходным публичным XML-ключом собран и запущен под Mono. Получены подписанный манифест и HTML с локального HTTP-канала; изменение байта staged-файла остановило активацию. Неизменённый файл активирован. Отдельный процесс выбрал v0.18.3, откат вернул v0.18.2. |

## Границы результатов

Один прогон на сцене из 11 объектов дал HTML в 96 810 байт. Время от навигации до готовности редактора составило 266 мс, от команды Build до чтения скачанного файла — 102 мс. Это измерения небольшого сценария в программном рендере. Нет репрезентативного профиля FPS, GPU-памяти, draw calls и полигонов больших карт.

На Windows установите v0.18.3 из v0.18.2 с изменённой тестовой сценой, сначала отменив диалог. Затем сохраните, установите, перезапустите приложение и откройте сохранённый проект. Проверьте номер версии, Play и управление с русской раскладкой. Публикация игры на WARPGAME и полноценный запуск Bridge.exe требуют отдельной проверки.

### Короткая выборка графических измерений

Параметры: Chromium 149, SwiftShader, окно 1440 × 900, 40 requestAnimationFrame подряд. Считались WebGL drawArrays/drawElements и примитивы TRIANGLES. Числа ниже — одна последовательная выборка. Второе измерение выполнялось уже после прогрева. По FPS нельзя делать вывод о масштабировании или о производительности видеокарт Windows.

| Сцена | FPS | Вызовы рисования/кадр | Треугольники/кадр | Использованный JS heap |
|---|---:|---:|---:|---:|
| Стартовая сцена, 9 объектов | 21 | 58 | 6 996 | 6 МиБ |
| Та же сцена плюс 50 кубов | 46 | 158 | 8 196 | 12 МиБ |

50 последовательных нажатий «+ Куб» из JS заняли 104 мс без ожидания кадра между ними. JS heap не включает GPU-память или память всего процесса. Для сравнения изменений движка нужны повторные измерения после одинакового прогрева на одних и тех же сохранённых сценах.

## v0.18.4

Запуск: `node tests/play-v0184.cjs` с теми же THREE_R128, CHROMIUM_BIN и SWIFTSHADER. Тест сначала вызывает Python-сборщик и сравнивает все байты с релизным HTML. Затем импортирует проект с тестовым start-скриптом. На v0.18.3 он изменил поле названия редактора, прочитал localStorage и отправил один POST на имитацию __updates/apply. На v0.18.4 DOM, localStorage и путь хоста недоступны; POST не поступил даже с заранее известным URL. Верхнее окно осталось на месте. Проверены физическая клавиша KeyW с символами w и ц, два запуска Play, Stop и сохранение исходной сцены. Внешних HTTP-запросов не было.

Дополнительно на payload v0.18.4 прошли сценарии build-v0183: старые .rwscene, GLB, Undo/Redo, экспорт с движением и точная граница размера. C#-сервис под Mono применил подписанный переход v0.18.3 → v0.18.4, отклонил повреждённый файл, после перезапуска выбрал v0.18.4 и откатился на v0.18.3. Реальный Bridge.exe и аппаратный WebGL на Windows здесь не запускались.

## v0.19.0 — Terrain Sculpting

- Исходники: `src/terrain_core.js`, `src/terrain_sculpt.js`, `src/studio.js`, `src/studio_template.html`.
- Автоматические проверки: `tests/terrain-core.cjs`, `tests/terrain-sculpt.cjs`, `tests/terrain-sculpt-performance.cjs`, `tests/terrain-browser.cjs`, `tests/terrain-sculpt-browser.cjs`.
- `python3 tools/build_studio.py --check updates/v0.19.0/studio.html` воспроизводит 325029 байт. SHA-256: `9a5501c0a88a603b16ab58f56fcdafbf69b85c5fd85e6c7b910563f8771c2da8`.
- Релизные браузерные проверки: четыре кисти, синхронизация швов, Undo/Redo с обычными объектами, Escape, отмена мазка без ложной грязной сцены, сохранение/загрузка `.rwscene`, Play/Stop, готовый WARPGAME HTML (под 3 000 000 байт).
- Материалы и эффекты Terrain на данном этапе только базовые, без кистей покраски. Визуальная QA проверяет видимую форму высот, не качество готовой карты.
- Профиль 4×4 по 32 сегмента в CI: P95 обновления геометрии с 22,597 до 4,734 мс после оптимизации. Синтетическое измерение, не значение FPS пользователя.
- Штатная RSA-подпись манифеста v0.19.0 проверена локально публичным ключом, полученным из ключа издателя; закрытый ключ не публиковался.
- **Остаётся:** запуск реального Bridge.exe на Windows, подтверждение установки v0.19.0 пользователем и проверка на WARPGAME с реальной авторизацией.


## v0.19.3 — Terrain slope physics release

- CI источников, Play, HTML-экспорта: `https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41750299079` — success.
- Контроль подписи RSA/SHA-256 локально с действующим публичным ключом обновлятора — success.
- GitHub Actions проверка SHA-256 и размера подписанного патча: `https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41750692295` — success.
- GitHub Pages deployment манифеста v0.19.3: `https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41750692968` — success.
- Windows Bridge.exe: установка/физика в пользовательском GPU-окружении — **не проверено**, требуется smoke test.


## v0.19.4 — Slow slope sliding (release)

- Контроль геометрии и порога 37°/40°, ограничение скорости 1.8 и сохранение climb limit 45° — CI.
- Browser Play: проверено медленное сползание на склоне 40° (длительность теста учитывает медленный SwiftShader). Play и WARPGAME HTML на склоне 60° без взбирания — success.
- CI: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41752335617 — success; main https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41752603972 — success.
- Подпись RSA/PKCS#1 v1.5 SHA256 проверена локально публичным ключом издателя; SHA-256 и размер в GitHub Actions https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41752803028 — success.
- GitHub Pages v0.19.4: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41752802204 — success.
- Реальный Windows Bridge.exe и установка обновления: **не проверено**.


## Bridge Studio v0.21.0 — Visual Scripting QA

- Unit `tests/gameplay-v021.cjs`: signal routing, 3 clicks, graph-only doors, exact/greater/less comparisons, restart, recursion safety, invalid input and legacy graphs — passed.
- Browser `tests/gameplay-v021-browser.cjs`: visual demo, object creation, .rwscene save, three E interactions, door opening, one-time reward, standalone exported HTML — passed.
- CI on feature branch: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41759348496 — success.
- Main branch CI: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41759793024 — success.
- Payload SHA-256 `3b06b4355f6121fefd6162fb9f417dd7d81c75d3d9da14ce1ed5990f656e9b3b`, 371401 bytes. RSA-3072/SHA-256 signature validated with existing publisher key.
- Signed manifest check: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41760013054 — success.
- GitHub Pages: https://github.com/jonhspoky2/bridge-studio-updates/actions/runs/41760013090 — success.
- Unverified: Windows Bridge.exe installation and GPU gameplay on the user's machine.
