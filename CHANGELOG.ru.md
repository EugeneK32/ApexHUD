# История изменений

Здесь перечислены все заметные изменения ApexHUD. Пока проект находится в ранней beta-стадии, версии следуют semantic versioning.

## [0.11.0] — 2026-07-25

### Добавлено

- Telemetry protocol v6.
- Scopes `driverAids`, `pit`, `environment` и `motion` для модулей.
- Доступность ABS, фактическое вмешательство ABS и величина снижения тормозного давления.
- Настройки TC, brake bias, состояние pit/rev limiter и декодированные предупреждения двигателя.
- Raw-значения газа и тормоза, ручник, диапазон руля, проценты shift indicator и shift power.
- Выбор pit service/repair, погода и влажность трассы, локальная динамика машины, дополнительные lap delta и расширенные данные игрока.
- Полный парный комплект документации и GitHub-файлов на английском и русском языках.

### Исправлено

- Manifest schema теперь принимает все scopes, которые поддерживает runtime.
- Необязательная телеметрия передаётся через nullable-поля и признаки доступности, а не через вводящие в заблуждение нули.
- Доступность pit limiter определяется и по активному биту `EngineWarnings`, даже когда control toggle отсутствует.

### Изменено

- Документация организована в `docs/en` и `docs/ru`; удалены legacy patch notes и устаревшие preview-документы.
- License metadata во всём проекте унифицирована как `MPL-2.0`.

## 0.10.0 — 2026-07-23

### HUD, ориентированный на гонку

- Порядок машин теперь в первую очередь следует опубликованной iRacing позиции, а не вычисленному прогрессу круга. Это устраняет краткие скачки вроде P2 → P4 около линии старта/финиша.
- Добавлена стабилизация overall/class position на 350 мс: одиночные сбойные кадры игнорируются, реальные обгоны отображаются быстро.
- Position автоматически показывает позицию в классе в мультиклассовой сессии, сохраняя overall position как вторичную информацию.
- Заводской Race Standings стал удобнее для периферического зрения: 12 гонщиков, без iRating, лицензии и последнего круга по умолчанию. Пользовательские настройки не перезаписываются.
- Из пользовательских настроек радара убран внутренний термин `overlap`; параметры описывают дальность обнаружения и опасное нахождение бок о бок.

### Подсказка переключения передач

- Телеметрия читает `DriverCarSLFirstRPM`, `DriverCarSLShiftRPM`, `DriverCarSLLastRPM` и `DriverCarSLBlinkRPM`.
- Race Dashboard становится жёлтым при первом shift light, оранжевым при штатной точке переключения и мигает красным только у simulator blink threshold.
- Добавлена спокойная голубая подсказка низких оборотов, когда может потребоваться понижение передачи. Это эвристика, а не точная команда конкретной машины.

### Control Center

- Home упрощён до карточки сессии, карточки активного HUD и одного основного действия редактирования.
- Layout groups представлены пользователю как HUD profiles, а session layers — как session modes.
- Установленные и доступные виджеты разделены на «Мои виджеты» и «Каталог».
- Из карточек установленных виджетов убран шум о количестве использований; действия с папкой и перезагрузкой перенесены в overflow menu.
- URL и ветка Git спрятаны в дополнительные настройки.
- Репозиторий Community по умолчанию: `https://github.com/EugeneK32/apexhud-community-modules.git`; старые placeholder URL мигрируют автоматически.

## 0.9.0 — 2026-07-23

- Вкладка Modules превращена в библиотеку установленных виджетов; размещение выполняется только из визуального редактора.
- Добавлены preview установленных виджетов и понятные источники Built-in, Community и Local.
- Community-виджеты получают metadata при установке и правильно определяются после перезапуска.
- Улучшен визуальный язык Control Center: больше читаемость, меньше технических подписей и перегруженных действий.
- Управление HUD profiles перенесено в компактное меню.
- Иконка ApexHUD применяется к окнам, taskbar, tray, сборке и sidebar Control Center.
- Добавлена документация по замене иконки приложения.

## 0.8.0 — 2026-07-23

### UX Control Center

- Страница Layouts перестроена как понятный двухшаговый сценарий: сначала выбирается набор HUD, затем Base Layout или режим сессии.
- Удалён лишний список **Modules in layer**; размещение остаётся в визуальном редакторе, а раздел Modules явно показывает выбранную раскладку.
- Наследование Base показано самой структурой интерфейса вместо длинных пояснений.
- Копирование между layout перенесено в компактный дополнительный блок с понятными Source и Target.
- Увеличены шрифт, контраст и отступы, уменьшено количество вложенных карточек и визуального шума.

### Локализация

- Добавлен сохраняемый выбор языка: английский, русский, немецкий, французский, испанский, итальянский, португальский (Бразилия), польский, упрощённый китайский и японский.
- При первой миграции выбирается поддерживаемый язык операционной системы.
- Язык применяется сразу в Control Center и игровом визуальном редакторе.

### Визуальный редактор

- Toolbar и inspector сделаны более плоскими и читаемыми в стиле Control Center.
- Нативные select заменены на собственные dropdown внутри окна, что исправило периодически некликабельные пункты в прозрачном always-on-top окне.
- Системный color dialog заменён на встроенный picker насыщенности/яркости, оттенка и HEX. Он не закрывается при перетаскивании и обновляет модуль в реальном времени.
- Из toolbar убран лишний factory reset; дочерние режимы показывают только релевантное действие **Reset to Base**.

## 0.7.0 — 2026-07-23

### Наследование layout

- Пользовательский Default переименован в **Base Layout**, workspace обновлён до schema v3.
- Дочерние session layouts хранят локальные модули, изменения отдельных свойств и tombstones удалённых inherited-модулей вместо независимых полных копий.
- Изменения позиции, настроек и enabled в Base распространяются автоматически, пока конкретное свойство не переопределено в дочернем layout.
- Удалённые в дочернем layout Base-модули не возвращаются; новые Base-модули появляются автоматически.
- Добавлено понятное копирование Source → Target для любых layouts и любых групп.
- Schema v2 и legacy `layout.json` мигрируют без потери существующих раскладок.

### Community-каталог

- Добавлена отдельная вкладка Community с настраиваемым Git repository.
- Поддерживаются shallow clone/fetch, recursive submodules, preview, install/update/remove и проверка обновлений раз в шесть часов.
- Git ищется в PATH, `APEXHUD_GIT_PATH` или optional PortableGit в `bin/git/cmd/git.exe`.
- Установленные модули остаются sandboxed и копируются без `.git` metadata.

### Исправлено

- Исправлен инвертированный steering trace в Driver Inputs.
- Исправлено исчезновение race overlay после Done в игровом редакторе: сохранение layout завершается до выхода, а временная потеря foreground больше не очищает состояние сессии.
- Некорректная packaging icon заменена на валидную multi-resolution Windows ICO.
- Build больше не уничтожает рабочий `node_modules` при каждом запуске; переустановка зависимостей выполняется явно или при отсутствии TypeScript.

### Визуальные модули

- Подключён обновлённый визуал встроенных модулей для этого релиза.

## 0.6.0 — 2026-07-22

### Control Center

- Control Center разделён на четыре вкладки: Overview, Layouts, Modules и Settings.
- Длинная перегруженная страница заменена на спокойный flat desktop UI с постоянной сводкой сессии и workspace.
- Добавлены поиск модулей и фильтры Race, Timing, Driving и Utility.
- Ручные layout groups и автоматические session profiles показаны как отдельные понятия.

### Радар

- Встроенный радар рисуется напрямую в прозрачном overlay host вместо iframe, что устранило белую Chromium-подложку.
- Остались только компактные прямоугольники игрока и контактов — без panel, card, canvas fill и фона машины игрока.
- Уменьшены прямоугольники и расстояние между боковыми контактами.

### Standings

- SessionInfo parser читает `ResultsPositions` текущей сессии и spectator state.
- Race order отбрасывает spectators и stale roster entries, которые не участвовали в текущей сессии.
- После фильтрации позиции уплотняются, поэтому zero-lap ghost car больше не превращает реальный P2 в P3.
- Добавлены automatic multiclass, grouped-by-class и независимые class positions.
- Строка игрока закрепляется в overall, player-class и grouped multiclass modes.

### Driver Inputs

- SVG traces ограничены внутри viewBox: полностью выжатая педаль больше не выходит за верхнюю границу.
- Strokes обрезаются самим SVG вместо overflow наружу.

## 0.5.3 — 2026-07-22

- Восстановлена гарантия присутствия игрока в Race Standings.
- Игрок определяется по актуальному `player.carIndex`, даже если stale standings frame не содержит `isPlayer`.
- Добавлены fallback по уникальному номеру машины и имени для редких стартовых кадров без car index.
- Добавлены regression tests для закрепления и подсветки игрока без backend flag.

## 0.5.2 — 2026-07-22

- Proximity Radar полностью прозрачен в race и edit mode; остаются только компактные прямоугольники машин.
- Уменьшены stock bounds и размеры прямоугольников; нетронутые настройки 0.5.1 мигрируют автоматически, пользовательские размещения сохраняются.
- В Control Center добавлена команда **Copy Default → current**.
- В toolbar игрового редактора добавлена команда **Copy Default**.
- Копирование использует deep clone, поэтому изменения конкретного сценария не затрагивают Default.

## 0.5.1 — 2026-07-22

- Исправлены вызовы конструктора `StandingEntry` после добавления `IncidentCount`.
- Строка игрока получает `PlayerCarMyIncidentCount`; для соперников используется `0`, потому что iRacing не предоставляет их incidents.
- Исправлено построение mock standings.

## 0.5.0 — 2026-07-22

### Добавлено

- Layout workspace schema v2 с вручную выбранными layout groups.
- Автоматические profiles Default, Test Drive, Practice, Qualifying, Race и Replay внутри каждой группы.
- Действия создания, дублирования, переименования и удаления групп, копирования/сброса profiles и выбора редактируемого profile.
- Автоматическое скрытие overlay по реальному состоянию окна iRacing: не foreground, только minimized или never.
- Windows monitor окна симулятора в telemetry service.
- Прокручиваемые графики Driver Inputs для газа, тормоза, сцепления и steering.
- Модули Position, Race Control, Lap Times и Incidents.
- Live incident count в protocol/player state и Race Control.
- Factory profiles с разными наборами модулей для test drive, practice, qualifying, race и replay.

### Изменено

- Protocol обновлён до v3: добавлены simulator-window state, event/session names и явные `hasTimeLimit`/`hasLapLimit`.
- Session Header показывает `OPEN` и `∞` для unlimited sessions вместо sentinel values iRacing.
- Fuel calculations игнорируют sentinel `32767` laps и `~604800 s` time.
- Нетронутый stock Driver Inputs перенесён от Race Dashboard, чтобы избежать overlap.
- Relative может полностью скрывать panel, если рядом нет машин.
- Новые установки получают scenario-specific layouts; старые композиции `layout.json` сохраняются во всех profiles мигрированной группы Main.

### Исправлено

- `168:00:00` и `32767` больше не отображаются как реальные ограничения сессии.
- HUD скрывается после минимизации iRacing или перехода в другое приложение.
- Active group сохраняется при автоматическом переключении profile.

## 0.4.1

- Race Standings больше не остаётся на статической заглушке `0 CARS / DEMO`: виджет не использует ES-module import, заблокированный opaque sandboxed iframe.
- Radar iframe больше не оставляет белый прямоугольник без бокового контакта; host скрывает весь frame до появления машины слева или справа.
- Убрана активация минималистичного радара по неизвестному rear approach — он появляется только для spotter-confirmed боковых машин.
- Добавлены явные transparent backgrounds iframe/document и regression tests.
- В чистый source включено исправление компиляции double/float в `RelativeEngine`.

## 0.4.0 — 2026-07-22

### Изменено

- Все восемь встроенных виджетов переведены на flat broadcast-style visual system.
- Удалены glow, blur, radial decoration, большие rounded cards и декоративные gradients.
- Standings переработан в плотный timing tower с белыми position cells, class-coloured car numbers, компактными licence/iRating chips и спокойной подсветкой игрока.
- Relative превращён в компактную таблицу с position, class color, driver, pit state и gap.
- Proximity Radar упрощён до прозрачных LMU-style rectangles: нейтральная машина игрока, жёлтые/оранжевые ближайшие и красные критические контакты.
- Уменьшен factory radar footprint, rear-approach markers выключены по умолчанию.
- Personal Delta, Session Header, Fuel Strategy, Driver Inputs и Race Dashboard сделаны плоскими без потери данных и настроек.
- Module template и visual preview board переведены на тот же дизайн-язык.

### Добавлено

- Документация визуальной системы: typography, spacing, color semantics и рекомендации авторам модулей.
- Layout migration заменяет только нетронутые stock colors/sizes, сохраняя пользовательские значения.
- Regression test не позволяет glow-heavy CSS вернуться во встроенные виджеты.

## 0.3.0 — 2026-07-22

### Добавлено

- Personal Delta с зелёной/красной дельтой к собственному лучшему кругу и индикатором clean/invalid lap.
- Модули Relative, Race Dashboard, Driver Inputs, Fuel Strategy и Session Header.
- Protocol v2 scopes: `vehicle`, `timing`, `fuel`, `relative`.
- Обучение расходу топлива и оценка запаса/дозаправки до финиша.
- Трекер current-lap validity по incident counter игрока; SDK delta-valid bit хранится отдельно от чистоты круга.
- Проверка fullscreen compatibility и one-click переход iRacing на borderless fullscreen с backup настроек.
- One-time migration добавляет новые встроенные виджеты без перезаписи существующих позиций.

### Изменено

- Overlay появляется при подключении shared-memory stream iRacing, включая garage, replay и pre-grid; `IsOnTrack` больше не обязателен.
- Session YAML обновляется при изменении `SessionInfoUpdate`, включая вход и выход гонщиков в open practice.
- Standings строит временные строки из активных `CarIdx*` arrays, пока имена ещё загружаются.
- Practice и qualifying используют best-lap ordering, если official positions недоступны.
- Delta показывает красный `INVALID`, если текущий круг испорчен, вместо stale number.

### Исправлено

- Исправлены пустые standings, если ApexHUD пропустил initial session-info callback или roster practice изменился после запуска.
- Overlay больше не остаётся скрытым, когда симулятор запущен, но игрок физически не находится в машине.

## 0.2.1 — 2026-07-21

- Overlay поднят до Electron always-on-top level `screen-saver`, Z-order периодически восстанавливается.
- Race overlay не получает focus вне layout editing.
- Standings всегда содержит игрока; если он ниже top group, последние строки сохраняют игрока и ближайшего полезного соседа.
- Добавлены regression tests выбора окна standings.

## 0.2.0 — 2026-07-21

- Race overlay скрывается вне live on-track state.
- Proximity Radar переработан в компактный прозрачный indicator.
- Исправлены stale asynchronous layout saves, которые возвращали позиции других виджетов.
- Electron IPC регистрируется до загрузки renderer windows.
- Sandbox preload переведён на CommonJS.

## 0.1.1 — 2026-07-21

- Исправлены ошибки компиляции C# type inference и mock switch expression.
- Environment-specific npm URLs заменены на переносимые, установка сделана deterministic.

## 0.1.0 — 2026-07-21

- Первый Electron host, .NET telemetry bridge, module runtime, layout editor, radar и standings.
