<div align="center">

# ApexHUD

**Открытая, модульная и локальная платформа оверлеев для iRacing под Windows.**

Собирайте собственный HUD, автоматически меняйте его между типами сессий и расширяйте независимыми HTML/CSS/JavaScript-модулями.

![Статус](https://img.shields.io/badge/status-early%20beta-f59e0b)
![Платформа](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4)
![.NET](https://img.shields.io/badge/.NET-8.0-512bd4)
![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-339933)
![Протокол](https://img.shields.io/badge/telemetry-protocol%20v6-7c3aed)
![Лицензия](https://img.shields.io/badge/license-MPL--2.0-blue)

[English](README.md) · [Документация](docs/README.ru.md) · [Разработка модулей](docs/ru/module-development.md)

</div>

> [!IMPORTANT]
> ApexHUD активно развивается и пока находится в ранней бете. Репозиторий уже пригоден для разработки, тестирования и вкладов сообщества, но публичные сборки ещё не подписаны и не имеют автоматического обновления.

## Что такое ApexHUD

ApexHUD — настраиваемая платформа оверлеев для iRacing. Локальный сервис на .NET читает shared-memory телеметрию, рассчитывает гоночные данные и передаёт их в прозрачное Electron-окно. Каждый виджет независим, настраиваем и заменяем.

Основные принципы:

- **Читаемость во время езды.** Критичная информация должна восприниматься боковым зрением.
- **Раскладка принадлежит гонщику.** Любой виджет можно переместить, изменить, продублировать или отключить.
- **Открытая расширяемость.** Community-виджеты — обычные статические web-пакеты с проверяемым manifest и ограниченным telemetry API.
- **Локальная работа.** Телеметрия остаётся на компьютере; bridge слушает только `127.0.0.1`.

## Возможности

- Прозрачный click-through overlay и визуальный редактор прямо поверх игры.
- Профили HUD для разных задач: Racing, Practice, Minimal, Streaming и другие.
- Режимы Test Drive, Practice, Qualifying, Race и Replay.
- Общий **Base Layout**, наследуемый дочерними раскладками.
- Точечные overrides, локальные модули и tombstones для намеренно удалённых inherited-модулей.
- Копирование любой итоговой раскладки между профилями и режимами.
- Sandboxed HTML/CSS/JavaScript-модули.
- Git-каталог Community с превью, установкой и обновлениями.
- Корректные позиции и standings с поддержкой мультикласса.
- Protocol v6 со scopes для электроники, пит-стопа, погоды, движения, тайминга, топлива, радара, relative и standings.
- Реальный сигнал срабатывания ABS, сила brake cut, настройки TC, brake bias, pit/rev limiter и декодированные предупреждения двигателя.
- Raw и обработанные педали, штатный shift-indicator percentage, диапазон руля и motion-данные для тренировочных модулей.
- Полная документация на английском и русском; Control Center локализован с английским fallback.

## Встроенные виджеты

| Виджет | Назначение |
|---|---|
| **Proximity Radar** | Прозрачное предупреждение о машинах рядом по spotter state iRacing. |
| **Race Standings** | Общий или мультиклассовый порядок, интервалы, пит и обязательное отображение игрока. |
| **Relative** | Ближайшие машины впереди и сзади. |
| **Position** | Крупная общая или классовая позиция. |
| **Personal Delta** | Текущая личная дельта и валидность круга. |
| **Lap Times** | Текущий, последний и лучший круг. |
| **Race Dashboard** | Скорость, передача и штатные пороги переключения. |
| **Driver Inputs** | Графики руля, газа, тормоза и сцепления. |
| **Fuel Strategy** | Топливо, изученный расход и расчёт до финиша. |
| **Session Header** | Трасса, сессия, флаги, время и круги. |
| **Race Control** | Флаги, штрафы и инструкции пит-лейна. |
| **Incidents** | Компактный счётчик инцидентов. |

Дополнительные виджеты устанавливаются из Community-каталога или копируются в локальную папку modules.

## Модель раскладок

Каждый профиль HUD содержит Base Layout и дочерние режимы:

```text
Профиль HUD: Racing
  Base Layout
  Test Drive
  Practice
  Qualifying
  Race
  Replay
```

Дочерние раскладки хранят только отличия:

- изменённые позицию, размер, настройки, видимость или z-index;
- модули, добавленные только в этот режим;
- tombstones для inherited-модулей, намеренно удалённых из режима.

Поэтому изменение непереопределённого свойства Base распространяется в дочерние режимы, новый Base-модуль появляется в них автоматически, а удалённый из конкретного режима модуль не возвращается.

Подробнее: [Раскладки и наследование](docs/ru/layouts.md).

## Community-каталог

Репозиторий по умолчанию:

```text
https://github.com/EugeneK32/apexhud-community-modules.git
```

ApexHUD использует Git из `PATH`, `APEXHUD_GIT_PATH` или PortableGit в `bin\git\cmd\git.exe`. Поддерживаются обычные папки модулей и Git submodules.

Подробнее: [Community-модули](docs/ru/community-modules.md).

## Требования

- Windows 10 или Windows 11;
- iRacing;
- .NET 8 SDK;
- Node.js `22.12.0` или новее;
- npm 10 или новее;
- Git для Community-каталога.

iRacing должен работать в оконном или borderless fullscreen режиме. ApexHUD намеренно не внедряет DLL и не ставит DirectX hook, поэтому exclusive fullscreen штатным desktop-окном не перекрывается.

## Включение телеметрии iRacing

В файле:

```text
Documents\iRacing\app.ini
```

должно быть:

```ini
irsdkEnableMem=1
```

После изменения перезапустите iRacing.

## Запуск из исходников

В PowerShell из корня репозитория:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
.\scripts\dev.ps1
```

Запуск только desktop без telemetry service:

```powershell
.\scripts\dev.ps1 -NoTelemetry
```

### Глобальные сочетания

| Сочетание | Действие |
|---|---|
| `Ctrl+Shift+F10` | Включить или завершить визуальное редактирование. |
| `Ctrl+Shift+F11` | Включить или выключить overlay. |
| `Ctrl+Shift+F12` | Открыть Control Center. |

## Проверка и сборка

```powershell
npm run verify
dotnet build .\services\telemetry\ApexHUD.Telemetry.csproj
```

Если отсутствуют локальные `tsc`, Vite или Electron:

```powershell
npm ci --include=dev --foreground-scripts
```

Сборка установщика и portable-пакета:

```powershell
.\scripts\build.ps1
```

Подробнее: [Разработка и сборка](docs/ru/development.md).

## Разработка модулей

Модуль — автономный статический web-пакет:

```text
my-widget/
  manifest.json
  index.html
  style.css
  module.js
  preview.webp
  README.md
  README.ru.md
  LICENSE
```

Минимальный manifest:

```json
{
  "schemaVersion": 1,
  "id": "com.example.apexhud.my-widget",
  "name": "My Widget",
  "description": "Краткое описание.",
  "version": "1.0.0",
  "author": "Your Name",
  "entry": "index.html",
  "scopes": ["player", "driverAids"],
  "defaultBounds": { "x": 0.72, "y": 0.12, "width": 0.2, "height": 0.16 },
  "settings": []
}
```

Scopes protocol v6:

```text
connection  session  player  vehicle  driverAids  pit  environment
motion      timing   fuel    radar   relative    standings
```

Модули работают в sandboxed iframe без Node.js, Electron IPC и прямого доступа к файловой системе. Host передаёт только scopes, заявленные в manifest.

Полный документ: [Разработка модулей](docs/ru/module-development.md).

## Архитектура

```text
iRacing shared memory
        │
        ▼
.NET 8 telemetry service
  ├─ Session YAML и roster
  ├─ standings, relative, radar, lap validity и fuel engines
  ├─ driver aids, pit, environment и motion normalization
  └─ локальный HTTP/WebSocket API
        │
        ▼
Electron desktop host
  ├─ Control Center
  ├─ прозрачный overlay и визуальный редактор
  ├─ наследование и хранение раскладок
  ├─ Git-каталог Community
  └─ фильтрация scopes и module sandbox
        │
        ▼
HTML/CSS/JavaScript-виджеты
```

Стандартные endpoints:

```text
ws://127.0.0.1:47931/ws
GET http://127.0.0.1:47931/health
GET http://127.0.0.1:47931/snapshot
```

Подробнее: [Архитектура](docs/ru/architecture.md) и [Telemetry protocol](docs/ru/telemetry-protocol.md).

## Структура репозитория

```text
apps/desktop/                  Electron host, UI, editor и packaging
services/telemetry/            .NET adapter iRacing и derived engines
packages/protocol/             Общие types и validators protocol v6
modules/                       Встроенные виджеты и шаблон
config/default-layout.json     Заводская раскладка
scripts/                       Setup, dev, verify и build
docs/en/                       Английская документация
docs/ru/                       Русская документация
tools/                         Инструменты разработки
```

## Безопасность и приватность

- Telemetry endpoints слушают только loopback.
- В Electron включены context isolation и renderer sandbox, Node integration выключен.
- Assets модулей обслуживаются через ограниченный custom protocol.
- Manifest проверяется до загрузки.
- Модуль получает только явно запрошенные scopes.
- Layout-файлы сохраняются через временный файл и atomic replace.

Community-модуль всё равно является исполняемым JavaScript. Проверяйте исходники и устанавливайте только доверенный код. Подробнее: [Безопасность](docs/ru/security.md).

## Ограничения

- Exclusive DirectX fullscreen не поддерживается.
- iRacing не отдаёт точные live world-space X/Y/orientation всех соперников через используемый публичный feed, поэтому radar остаётся улучшенной spotter-аппроксимацией.
- Relative gap, fuel и другие оценки требуют валидных samples и не являются официальными scoring-данными.
- Универсального достоверного сигнала фактического вмешательства traction control нет. Protocol v6 отдаёт доступность, enabled state и уровни TC, но не притворяется, что имеет `tcActive`.
- Публичные сборки пока не подписаны и не обновляются автоматически.

## Участие в разработке

Перед pull request прочитайте [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md) и выполните:

```powershell
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

Особенно полезны исправления телеметрии, улучшение читаемости в гонке, тестирование Windows DPI/multi-monitor, модули, переводы и документация.

## Лицензия

Исходный код ApexHUD распространяется по лицензии **MPL-2.0**, если для отдельных компонентов явно не указано иное. Подробнее см. [LICENSE](LICENSE) и [документацию по лицензированию](docs/ru/licensing.md).

Сервис телеметрии использует IRSDKSharper, распространяемую по лицензии **GPL-3.0**. На IRSDKSharper продолжают распространяться условия её собственной лицензии. Информация о сторонних компонентах приведена в [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Название, логотип и другие элементы фирменного стиля ApexHUD не предоставляются по лицензии исходного кода. Подробнее см. [TRADEMARKS.ru.md](TRADEMARKS.ru.md).

ApexHUD — независимый проект сообщества, не связанный с iRacing.com Motorsport Simulations, LLC, не одобренный и не спонсируемый этой компанией. iRacing и связанные с ним товарные знаки принадлежат их соответствующим правообладателям.

Copyright © 2026 Eugene Konovalov и участники проекта ApexHUD.
