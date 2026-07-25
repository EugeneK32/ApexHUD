# Руководство по разработке модулей ApexHUD

**Целевая версия:** ApexHUD 0.10.0  
**Версия протокола телеметрии:** v5  
**Версия схемы manifest:** v1  
**Язык:** русский

Этот документ описывает полный публичный контракт модулей, реализованный в ApexHUD 0.10.0. Здесь разобраны локальные и встроенные модули, публикация в Community-каталоге, схема `manifest.json`, сообщения host-приложения, все telemetry scopes, настройки, наследование раскладок, безопасность, производительность, тестирование, визуальная система, совместимость и диагностика проблем.

> Модуль ApexHUD — это статическое веб-приложение, которое отображается внутри sandboxed iframe. Обычно модуль состоит из `manifest.json`, HTML entry point, CSS, JavaScript и локальных ресурсов. Сборщик необязателен.

---

## Содержание

1. [Основные понятия](#1-основные-понятия)
2. [Быстрый старт](#2-быстрый-старт)
3. [Расположение модулей и правила обнаружения](#3-расположение-модулей-и-правила-обнаружения)
4. [Рекомендуемая структура проекта](#4-рекомендуемая-структура-проекта)
5. [Полная справка по manifest](#5-полная-справка-по-manifest)
6. [Настройки модуля](#6-настройки-модуля)
7. [Runtime и модель sandbox](#7-runtime-и-модель-sandbox)
8. [Сообщения host → module](#8-сообщения-host--module)
9. [Сообщения module → host](#9-сообщения-module--host)
10. [Надёжный обработчик сообщений](#10-надёжный-обработчик-сообщений)
11. [Справочник telemetry scopes](#11-справочник-telemetry-scopes)
12. [Семантика данных и защитный рендеринг](#12-семантика-данных-и-защитный-рендеринг)
13. [Видимость и режим редактирования](#13-видимость-и-режим-редактирования)
14. [Несколько экземпляров и сохранение состояния](#14-несколько-экземпляров-и-сохранение-состояния)
15. [Наследование Base Layout](#15-наследование-base-layout)
16. [Рендеринг и производительность](#16-рендеринг-и-производительность)
17. [Гоночный UX и визуальный дизайн](#17-гоночный-ux-и-визуальный-дизайн)
18. [Локализация](#18-локализация)
19. [Безопасность и CSP](#19-безопасность-и-csp)
20. [Рабочий процесс разработки](#20-рабочий-процесс-разработки)
21. [Чек-лист тестирования](#21-чек-лист-тестирования)
22. [Публикация в Community-каталоге](#22-публикация-в-community-каталоге)
23. [Версионирование и совместимость](#23-версионирование-и-совместимость)
24. [Полноценный пример модуля](#24-полноценный-пример-модуля)
25. [Диагностика проблем](#25-диагностика-проблем)
26. [Текущие ограничения API](#26-текущие-ограничения-api)
27. [Чек-лист релиза](#27-чек-лист-релиза)

---

## 1. Основные понятия

### Пакет модуля

Пакет модуля — это отдельная директория с валидным `manifest.json` и всеми файлами, необходимыми для работы виджета. ApexHUD не требует npm, React или сборщика. Framework допустим, если результатом сборки являются статические и полностью автономные файлы.

### Описание модуля и экземпляр модуля

**Описание модуля** — пакет, идентифицируемый полем `manifest.id`.

**Экземпляр модуля** — конкретная размещённая копия модуля в HUD-раскладке. Одновременно может существовать несколько экземпляров одного модуля. У каждого экземпляра независимы:

- `instanceId`;
- положение и размер;
- признак включения;
- z-index;
- настройки.

Нельзя считать, что пользователь добавит ваш модуль только один раз.

### Host

Host — Electron-приложение ApexHUD. Оно:

- обнаруживает пакеты модулей;
- валидирует manifest;
- создаёт sandboxed iframe;
- строит интерфейс настроек из manifest;
- отправляет телеметрию и lifecycle-сообщения;
- сохраняет раскладки и настройки экземпляров.

### Scopes

Scope — именованный раздел телеметрии. Модуль перечисляет необходимые scopes в manifest. Host отправляет только эти объекты и обязательное поле `payload.source`.

Запрашивайте минимальный набор scopes, который действительно используется.

### Раскладки

Модуль не управляет раскладкой напрямую. ApexHUD отвечает за размещение, изменение размера, дублирование, наследование, удаление и сохранение.

---

## 2. Быстрый старт

### Вариант A: разработка внутри исходников ApexHUD

Скопируйте шаблон:

```powershell
Copy-Item .\modules\_template .\modules\my-widget -Recurse
```

Измените файлы:

```text
modules/my-widget/manifest.json
modules/my-widget/index.html
modules/my-widget/style.css
modules/my-widget/module.js
```

Запустите ApexHUD:

```powershell
npm install
.\scripts\dev.ps1
```

После изменения manifest или структуры пакета перезагрузите каталог модулей в Control Center.

### Вариант B: локальный пользовательский модуль

Надёжнее всего открыть правильную папку через интерфейс:

1. Откройте ApexHUD Control Center.
2. Перейдите в **Мои виджеты / Библиотека**.
3. Откройте меню `···`.
4. Выберите **Открыть папку модулей**.

В текущей Windows-сборке путь обычно выглядит примерно так:

```text
%APPDATA%\@apexhud\desktop\modules
```

Не зашивайте этот путь в установщики. ApexHUD использует Electron `app.getPath("userData")`, поэтому точная директория может измениться вместе с package identity или платформой.

Скопируйте туда папку модуля, перезагрузите каталог, откройте визуальный редактор и добавьте виджет.

### Минимальный пакет

```text
my-widget/
  manifest.json
  index.html
  style.css
  module.js
```

---

## 3. Расположение модулей и правила обнаружения

ApexHUD сканирует два источника:

1. Встроенные модули.
2. Пользовательские модули.

### В режиме разработки

```text
<repository>/modules/
<user-data>/modules/
```

### В собранном приложении

```text
<application-resources>/modules/
<user-data>/modules/
```

### Правила обнаружения

- Сканируются только непосредственные дочерние директории.
- Папки, начинающиеся с `_`, игнорируются.
- `manifest.json` должен находиться в корне папки модуля.
- Файл из `entry` должен существовать и быть обычным файлом.
- Невалидные модули пропускаются, ошибка пишется в Electron console.
- После обнаружения модули сортируются по отображаемому имени.
- Сначала сканируются встроенные модули.
- При повторяющемся `manifest.id` используется первое найденное описание, остальные игнорируются.
- Пользовательский модуль не может переопределить встроенный, просто использовав его ID.
- Имя папки не обязано совпадать с ID, но логическое соответствие упрощает поддержку.

### Зарезервированные ID

Не используйте ID встроенных модулей:

```text
com.apexhud.dashboard
com.apexhud.delta
com.apexhud.fuel
com.apexhud.incidents
com.apexhud.inputs
com.apexhud.lap-times
com.apexhud.position
com.apexhud.race-control
com.apexhud.radar
com.apexhud.relative
com.apexhud.session
com.apexhud.standings
```

`com.apexhud.radar` дополнительно обрабатывается host-приложением особым образом и рисуется native radar renderer вместо обычного iframe.

---

## 4. Рекомендуемая структура проекта

```text
com.example.apexhud.battle-focus/
  manifest.json
  index.html
  style.css
  module.js
  preview.webp
  README.md
  LICENSE
  assets/
    icon.svg
```

Для модуля, собранного framework-сборщиком:

```text
com.example.apexhud.widget/
  manifest.json
  index.html
  assets/
    index-a1b2c3.js
    index-d4e5f6.css
  preview.webp
  README.md
  LICENSE
```

Требования:

- Все runtime-зависимости должны лежать внутри папки модуля.
- Используйте относительные URL.
- Не зависите от CDN.
- Не публикуйте `node_modules`.
- Не публикуйте source maps с секретами и абсолютными локальными путями.
- Не распространяйте файлы шрифтов.

---

## 5. Полная справка по manifest

ApexHUD 0.10.0 использует schema version `1`.

### Полный пример

```json
{
  "schemaVersion": 1,
  "id": "com.example.apexhud.battle-focus",
  "name": "Battle Focus",
  "description": "Shows the nearest car ahead, the player and the nearest car behind.",
  "version": "1.0.0",
  "author": "Example Racing",
  "entry": "index.html",
  "scopes": ["player", "session", "standings"],
  "defaultBounds": {
    "x": 0.76,
    "y": 0.38,
    "width": 0.21,
    "height": 0.22
  },
  "minimumSize": {
    "width": 300,
    "height": 170
  },
  "settings": [
    {
      "key": "mode",
      "label": "Cars to compare",
      "type": "select",
      "default": "auto",
      "options": [
        { "label": "Automatic", "value": "auto" },
        { "label": "Overall", "value": "overall" },
        { "label": "My class", "value": "class" }
      ]
    },
    {
      "key": "showNames",
      "label": "Show driver names",
      "type": "boolean",
      "default": true
    },
    {
      "key": "accent",
      "label": "Player highlight",
      "type": "color",
      "default": "#f2c94c"
    },
    {
      "key": "opacity",
      "label": "Panel opacity",
      "type": "range",
      "default": 0.92,
      "min": 0.3,
      "max": 1,
      "step": 0.05
    }
  ]
}
```

### Поля верхнего уровня

| Поле | Обязательно | Валидация и поведение |
|---|---:|---|
| `schemaVersion` | да | Строго `1`. |
| `id` | да | Reverse-DNS ID: строчные буквы, цифры и дефисы; минимум одна точка; не более 120 символов. Пример: `com.example.apexhud.widget`. |
| `name` | да | 1–80 символов. Показывается в редакторе и библиотеке. |
| `description` | да | 1–300 символов. Пишите для обычного пользователя, а не как внутреннее техническое описание. |
| `version` | да | 1–40 символов. Строгий SemVer не проверяется, но Community-обновления лучше работают с цифровыми версиями. |
| `author` | да | 1–100 символов. |
| `entry` | да | Безопасный относительный путь через `/`, максимум 240 символов. Запрещены ведущий `/`, обратный слеш, пустые компоненты, `.`, `..`, NUL. |
| `scopes` | да | Непустой массив поддерживаемых scopes. |
| `defaultBounds` | да | Начальные нормализованные координаты и размер. |
| `minimumSize` | нет | Ограничение размера в пикселях при resize. Каждое измерение — от 40 до 10 000. |
| `settings` | да | Массив из 0–64 полей настроек. |

### Формат ID

Валидно:

```text
com.example.apexhud.widget
io.github.username.apexhud.my-widget
ru.company.apexhud.fuel-helper
```

Невалидно:

```text
my-widget                  # нет точки
Com.Example.Widget         # верхний регистр
com.example.my_widget      # underscore
.com.example.widget        # точка в начале
com..example.widget        # пустая часть
```

### `defaultBounds`

Координаты нормализованы относительно экрана overlay:

```json
{
  "x": 0.72,
  "y": 0.12,
  "width": 0.20,
  "height": 0.18
}
```

Значения:

- `x`: отступ от левого края, `0..1`;
- `y`: отступ от верхнего края, `0..1`;
- `width`: доля ширины экрана;
- `height`: доля высоты экрана.

Правила:

- `x`, `y`: `0..1`;
- `width`, `height`: `0.01..1`;
- `x + width <= 1`;
- `y + height <= 1`.

В runtime bounds дополнительно нормализуются, а width/height ограничиваются минимумом `0.04`. Уже сохранённые экземпляры не перемещаются автоматически после изменения `defaultBounds`.

### `minimumSize`

```json
{
  "minimumSize": {
    "width": 280,
    "height": 140
  }
}
```

Ограничивает интерактивный resize. Это не гарантирует, что старые сохранённые раскладки автоматически увеличатся после обновления модуля. CSS должен оставаться адаптивным и защитным.

---

## 6. Настройки модуля

Визуальный редактор строит элементы управления напрямую из `manifest.settings`.

### Общие поля настройки

| Поле | Обязательно | Правила |
|---|---:|---|
| `key` | да | Начинается с буквы, далее буквы, цифры, `_`, `.`, `-`; максимум 64 символа; уникален внутри manifest. |
| `label` | да | 1–80 символов. |
| `type` | да | `boolean`, `range`, `number`, `color` или `select`. |
| `default` | да | Строка, конечное число или boolean соответствующего типа. |
| `min` | условно | Конечное число. Рекомендуется для `range` и `number`. |
| `max` | условно | Конечное число, не меньше `min`. |
| `step` | условно | Положительное конечное число. |
| `options` | для select | 1–50 вариантов с уникальными значениями. |
| `help` | нет | 1–240 символов. |

### Boolean

```json
{
  "key": "showNames",
  "label": "Show driver names",
  "type": "boolean",
  "default": true
}
```

### Range

```json
{
  "key": "opacity",
  "label": "Panel opacity",
  "type": "range",
  "default": 0.9,
  "min": 0.2,
  "max": 1,
  "step": 0.05
}
```

### Number

```json
{
  "key": "warningAt",
  "label": "Warning threshold",
  "type": "number",
  "default": 8,
  "min": 1,
  "max": 100,
  "step": 1
}
```

### Color

```json
{
  "key": "accent",
  "label": "Accent",
  "type": "color",
  "default": "#f2c94c"
}
```

Validator принимает hex-цвета длиной 3–8 цифр. Для предсказуемой работы color picker используйте шестизначный формат `#RRGGBB`.

### Select

```json
{
  "key": "mode",
  "label": "Position mode",
  "type": "select",
  "default": "auto",
  "options": [
    { "label": "Automatic", "value": "auto" },
    { "label": "Overall", "value": "overall" },
    { "label": "Class", "value": "class" }
  ]
}
```

Значения option могут быть строками или числами.

### Важное поведение сохранения

- Настройки сохраняются отдельно для каждого экземпляра.
- Defaults из manifest копируются при создании нового экземпляра.
- Изменение default в новой версии не перезаписывает пользовательские настройки старых экземпляров.
- После добавления нового setting старые экземпляры могут не содержать этот ключ.
- Всегда накладывайте сохранённые значения поверх внутренних defaults.
- Автоматической миграции удалённых или переименованных ключей нет.
- По возможности сохраняйте старые ключи либо поддерживайте оба имени в коде.

Рекомендуемый шаблон:

```js
const DEFAULTS = {
  accent: "#f2c94c",
  showNames: true,
  opacity: 0.92,
};

let settings = { ...DEFAULTS };

function applyIncomingSettings(value) {
  settings = { ...DEFAULTS, ...settings, ...(value || {}) };
}
```

---

## 7. Runtime и модель sandbox

Обычный модуль загружается в iframe примерно с такой конфигурацией:

```text
sandbox="allow-scripts"
```

Следствия:

- JavaScript разрешён.
- Node.js недоступен.
- `require` недоступен.
- `process` недоступен.
- Electron IPC недоступен.
- Прямого доступа к файловой системе нет.
- `allow-same-origin` не предоставляется.
- Нельзя полагаться на `localStorage`, IndexedDB или постоянный origin.
- Нельзя управлять DOM родительского окна.
- Поддерживаемый канал связи — `postMessage`.

Ресурсы обслуживаются через:

```text
apex-module://<manifest.id>/<relative-path>
```

Используйте относительные ссылки:

```html
<link rel="stylesheet" href="style.css" />
<script src="module.js"></script>
<img src="assets/icon.svg" alt="" />
```

Host нормализует пути и блокирует выход за пределы директории модуля.

### Не рассчитывайте на runtime fetch

Базовый поддерживаемый вариант — связанные локальные файлы и host messages. Из-за sandboxed opaque origin не следует считать browser storage и fetch/CORS стабильной частью module API. Статические данные лучше включать в JS или подключать напрямую через HTML/CSS.

---

## 8. Сообщения host → module

Host отправляет сообщения через `window.postMessage`.

### Порядок после загрузки

После события `load` iframe host отправляет:

1. `apex:init`;
2. `apex:visibility`;
3. последний `apex:frame`, если он уже есть.

В дальнейшем приходят:

- `apex:frame` — новые кадры телеметрии;
- `apex:settings` — изменения настроек экземпляра;
- `apex:visibility` — изменения runtime/edit visibility.

Нельзя считать, что телеметрия уже существует в момент `apex:init`.

### `apex:init`

```js
{
  type: "apex:init",
  protocolVersion: 5,
  moduleId: "com.example.apexhud.widget",
  instanceId: "widget-8c934f12",
  settings: {
    accent: "#f2c94c",
    opacity: 0.92
  },
  source: "iracing" | "mock" | "none" | string
}
```

Используйте для:

- сохранения `instanceId` для диагностики;
- применения persisted settings;
- определения источника телеметрии;
- инициализации статического интерфейса.

### `apex:frame`

```js
{
  type: "apex:frame",
  protocolVersion: 5,
  sequence: 12345,
  timestamp: "2026-07-23T14:30:00.000Z",
  payload: {
    source: "iracing",
    player: { /* только если scope запрошен */ },
    standings: { /* только если scope запрошен */ }
  }
}
```

Свойства:

- `sequence` монотонно растёт для опубликованных snapshots.
- `timestamp` — ISO 8601.
- `payload.source` присутствует всегда.
- В payload включаются только scopes из manifest.
- В будущих версиях могут появляться неизвестные поля — их нужно игнорировать.

### `apex:settings`

```js
{
  type: "apex:settings",
  settings: {
    opacity: 0.75,
    showNames: false
  }
}
```

Сейчас у этого сообщения нет `protocolVersion`. Рассматривайте `settings` как текущее полное состояние настроек и объединяйте его с внутренними defaults.

### `apex:visibility`

```js
{
  type: "apex:visibility",
  visible: true,
  editMode: false
}
```

Значение:

- `visible: false` — overlay отключён или скрыт runtime policy; дорогую работу нужно приостановить.
- `visible: true, editMode: false` — обычный режим гонки.
- `visible: true, editMode: true` — визуальный редактор; live-телеметрия может отсутствовать.

---

## 9. Сообщения module → host

### Диагностический лог

```js
window.parent.postMessage({
  type: "apex:log",
  level: "warn",
  message: "No player entry was found in standings"
}, "*");
```

Уровни:

```text
debug
info
warn
error
```

Host ограничивает сообщение 2000 символами и добавляет префикс с ID модуля.

Не логируйте каждый telemetry frame.

### Ready message

Тип протокола содержит:

```js
window.parent.postMessage({
  type: "apex:ready",
  moduleId: "com.example.apexhud.widget"
}, "*");
```

ApexHUD 0.10.0 не требует ready-handshake и сейчас не выполняет действие по этому сообщению. Его можно отправлять для будущей совместимости, но инициализация модуля не должна ждать подтверждения.

### Неподдерживаемые исходящие действия

Модуль пока не может напрямую:

- менять сохранённые настройки экземпляра;
- просить host изменить размер;
- добавлять или удалять другие виджеты;
- переключать раскладки;
- выполнять Electron-команды;
- получать scopes, не указанные в manifest.

---

## 10. Надёжный обработчик сообщений

```js
(() => {
  "use strict";

  const SUPPORTED_PROTOCOL = 5;
  const DEFAULTS = {
    accent: "#f2c94c",
    opacity: 0.92,
  };

  let settings = { ...DEFAULTS };
  let visible = true;
  let editMode = false;
  let lastSequence = -1;

  window.addEventListener("message", (event) => {
    // Из-за sandbox origin может быть opaque, поэтому проверяем source window,
    // а не полагаемся только на event.origin.
    if (event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== "string") return;

    if (
      (message.type === "apex:init" || message.type === "apex:frame") &&
      message.protocolVersion !== SUPPORTED_PROTOCOL
    ) {
      showUnsupportedProtocol(message.protocolVersion);
      return;
    }

    switch (message.type) {
      case "apex:init":
      case "apex:settings":
        settings = {
          ...DEFAULTS,
          ...settings,
          ...(message.settings || {}),
        };
        applySettings();
        break;

      case "apex:visibility":
        visible = Boolean(message.visible);
        editMode = Boolean(message.editMode);
        document.documentElement.classList.toggle("module-hidden", !visible);
        document.documentElement.classList.toggle("module-editing", editMode);
        break;

      case "apex:frame":
        if (!visible || message.sequence === lastSequence) return;
        lastSequence = message.sequence;
        render(message.payload || {});
        break;
    }
  });

  function applySettings() {
    document.documentElement.style.setProperty(
      "--accent",
      String(settings.accent)
    );
    document.documentElement.style.setProperty(
      "--opacity",
      String(Number(settings.opacity) || 0.92)
    );
  }

  function render(payload) {
    // Читайте только объявленные scopes и проверяйте все значения.
  }

  function showUnsupportedProtocol(received) {
    document.body.textContent = `Unsupported ApexHUD protocol: ${received}`;
  }
})();
```

CSS для скрытия:

```css
html.module-hidden {
  visibility: hidden;
}
```

---

## 11. Справочник telemetry scopes

Телеметрический сервис по умолчанию публикует 30 кадров в секунду. Модуль не обязан полностью перерисовываться 30 раз в секунду.

### Общее поле source

В каждом frame payload присутствует:

```ts
source: "iracing" | "mock" | "none" | string
```

- `iracing` — live shared-memory iRacing.
- `mock` — встроенный симулятор данных.
- `none` — активного источника нет.
- В будущем возможны другие значения; неизвестные строки нужно принимать спокойно.

### 11.1 `connection`

```ts
interface ConnectionState {
  connected: boolean;
  status: string;
  tickRate: number;
  framesDropped: number;
  simulatorWindow: {
    processRunning: boolean;
    windowFound: boolean;
    isVisible: boolean;
    isMinimized: boolean;
    isForeground: boolean;
  };
}
```

| Поле | Значение |
|---|---|
| `connected` | Telemetry bridge имеет активный источник. |
| `status` | Человекочитаемый diagnostic status; не парсите как стабильный enum. |
| `tickRate` | Tick rate исходной телеметрии. |
| `framesDropped` | Счётчик пропущенных кадров. |
| `processRunning` | Процесс iRacing обнаружен. |
| `windowFound` | Найдено окно симулятора. |
| `isVisible` | Окно видимо. |
| `isMinimized` | Окно свёрнуто. |
| `isForeground` | Симулятор находится на переднем плане. |

Запрашивайте состояние окна только если оно реально нужно. Основную auto-hide policy уже применяет host.

### 11.2 `session`

```ts
interface SessionState {
  sessionNumber: number;
  state: number;
  sessionType: string;
  sessionName: string;
  eventType: string;
  trackName: string;
  trackLengthMeters: number;
  timeRemainingSeconds: number;
  hasTimeLimit: boolean;
  lapsRemaining: number;
  hasLapLimit: boolean;
  flags: number;
  isReplayPlaying: boolean;
  isInGarage: boolean;
}
```

| Поле | Единица / значение |
|---|---|
| `sessionNumber` | Индекс текущей сессии; `-1` может означать отсутствие данных. |
| `state` | Raw numeric session state. Считайте opaque, если не поддерживаете собственную таблицу соответствий. |
| `sessionType` | Например Practice, Qualifying, Race. Сравнивайте без учёта регистра и допускайте новые значения. |
| `sessionName` | Отображаемое имя сессии. |
| `eventType` | Тип события из session metadata. |
| `trackName` | Отображаемое название трассы. |
| `trackLengthMeters` | Длина трассы в метрах; `0`, если неизвестна. |
| `timeRemainingSeconds` | Оставшиеся секунды только при `hasTimeLimit=true`. |
| `hasTimeLimit` | Есть ли реальный лимит времени. |
| `lapsRemaining` | Оставшиеся круги только при `hasLapLimit=true`. |
| `hasLapLimit` | Есть ли реальный лимит кругов. |
| `flags` | Raw bitmask флагов iRacing. Нельзя определять единственный флаг простым сравнением числа. |
| `isReplayPlaying` | Активно воспроизведение replay. |
| `isInGarage` | Игрок находится в garage state. |

ApexHUD нормализует unlimited sentinels iRacing. Если лимита нет, numeric value равен `0`, а соответствующий `has*Limit` — `false`.

### 11.3 `player`

```ts
interface PlayerState {
  carIndex: number;
  name: string;
  carNumber: string;
  position: number;
  classPosition: number;
  lap: number;
  lapDistancePercent: number;
  speedMetersPerSecond: number;
  fuelLiters: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isOnTrack: boolean;
}
```

| Поле | Единица / значение |
|---|---|
| `carIndex` | Индекс машины iRacing; `-1`, если неизвестен. Это наиболее надёжный ключ идентификации. |
| `name` | Имя гонщика. |
| `carNumber` | Номер машины в виде строки. |
| `position` | Согласованная общая позиция; `0` означает отсутствие данных. |
| `classPosition` | Согласованная позиция в классе; `0` означает отсутствие данных. |
| `lap` | Текущий счётчик круга. |
| `lapDistancePercent` | Прогресс текущего круга, ограничен `0..1`. |
| `speedMetersPerSecond` | Скорость в м/с. Для км/ч умножить на `3.6`, для mph — на `2.236936`. |
| `fuelLiters` | Топливо в литрах. |
| `lastLapSeconds` | Последний круг в секундах; `0`, если неизвестен. |
| `bestLapSeconds` | Лучший круг в секундах; `0`, если неизвестен. |
| `incidentCount` | Текущий счётчик инцидентов сессии. |
| `onPitRoad` | Игрок на pit road. |
| `isOnTrack` | Игрок считается находящимся на трассе. |

### 11.4 `vehicle`

```ts
interface VehicleState {
  speedMetersPerSecond: number;
  gear: number;
  rpm: number;
  shiftLightFirstRpm?: number;
  shiftRpm: number;
  shiftLightLastRpm?: number;
  shiftLightBlinkRpm?: number;
  throttle: number;
  brake: number;
  clutch: number;
  steeringWheelAngleRadians: number;
  onPitRoad: boolean;
  trackSurface: number;
}
```

| Поле | Единица / значение |
|---|---|
| `speedMetersPerSecond` | Скорость в м/с. |
| `gear` | Raw gear iRacing; обычно `-1` — задняя, `0` — нейтраль, положительные числа — передачи вперёд. |
| `rpm` | Текущие обороты двигателя. |
| `shiftLightFirstRpm` | RPM начала штатных shift lights; может отсутствовать или быть `0`. |
| `shiftRpm` | Рекомендуемый car-specific shift threshold; может быть `0`. |
| `shiftLightLastRpm` | Последний постоянный threshold shift lights; может отсутствовать или быть `0`. |
| `shiftLightBlinkRpm` | Car-specific blink threshold; может отсутствовать или быть `0`. |
| `throttle` | `0..1`. |
| `brake` | `0..1`. |
| `clutch` | `0..1`. |
| `steeringWheelAngleRadians` | Знаковый угол руля в радианах. Если экранная шкала имеет обратное направление, инвертируйте только на уровне отображения. |
| `onPitRoad` | Машина на pit road. |
| `trackSurface` | Raw numeric track-surface value. Считайте opaque без собственной mapping table. |

Рекомендуемый fallback для shift thresholds:

```js
const shift = positive(vehicle.shiftRpm) || positive(vehicle.shiftLightLastRpm);
const first = positive(vehicle.shiftLightFirstRpm) || shift * 0.86;
const blink = positive(vehicle.shiftLightBlinkRpm) || shift * 1.04;
```

Не запускайте мигание передачи задолго до штатного car-specific blink threshold.

### 11.5 `timing`

```ts
interface TimingState {
  currentLap: number;
  completedLaps: number;
  currentLapSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  deltaToBestSeconds: number;
  deltaAvailable: boolean;
  currentLapValid: boolean;
  validity: "valid" | "invalid" | "unavailable" | string;
}
```

| Поле | Значение |
|---|---|
| `currentLap` | Номер текущего круга. |
| `completedLaps` | Количество завершённых кругов. |
| `currentLapSeconds` | Время текущего круга; `0`, если неизвестно. |
| `lastLapSeconds` | Последний круг; `0`, если неизвестен. |
| `bestLapSeconds` | Лучший круг; `0`, если неизвестен. |
| `deltaToBestSeconds` | Знаковая персональная дельта к лучшему кругу. Отрицательное значение — быстрее. |
| `deltaAvailable` | Доступна ли валидная дельта и reference. |
| `currentLapValid` | Convenience boolean, true только для `valid`. |
| `validity` | `valid`, `invalid`, `unavailable` либо будущее значение. |

Не показывайте `0.000` как реальную дельту при `deltaAvailable=false`.

### 11.6 `fuel`

```ts
interface FuelState {
  levelLiters: number;
  usePerHourLiters: number;
  estimatedPerLapLiters: number;
  estimatedLapsRemaining: number;
  requiredToFinishLiters: number;
  addToFinishLiters: number;
  samples: number;
  estimateReady: boolean;
}
```

| Поле | Значение |
|---|---|
| `levelLiters` | Текущий уровень топлива. |
| `usePerHourLiters` | Текущая/source оценка расхода в час. |
| `estimatedPerLapLiters` | Обученная средняя оценка расхода на круг. |
| `estimatedLapsRemaining` | Оценка оставшихся кругов на текущем топливе. |
| `requiredToFinishLiters` | Оценка топлива до финиша. |
| `addToFinishLiters` | Оценка количества для дозаправки. |
| `samples` | Число принятых samples. |
| `estimateReady` | Готова ли оценка для нормального отображения. |

До `estimateReady=true` показывайте спокойное состояние обучения, а не псевдоточную цифру.

### 11.7 `radar`

```ts
interface RadarState {
  spotterState: string;
  active: boolean;
  contacts: RadarContact[];
}

interface RadarContact {
  carIndex: number;
  side: "left" | "right" | "unknown" | string;
  longitudinalMeters: number;
  closingSpeedMetersPerSecond: number;
  overlap: number;
  threat: "nearby" | "warning" | "critical" | "fast-approach" | string;
  confidence: number;
  isApproaching: boolean;
}
```

| Поле | Значение |
|---|---|
| `spotterState` | Нормализованное состояние: `clear`, `car-left`, `car-right`, `both-sides`, `two-left`, `two-right`, `off`. |
| `active` | Есть side requirement или candidate contact. |
| `carIndex` | Индекс соперника. Отрицательные значения могут обозначать synthetic contact, когда iRacing сообщил боковую машину, но сопоставить конкретный car index не удалось. |
| `side` | Слева, справа или неизвестно. |
| `longitudinalMeters` | Приблизительная знаковая дистанция вдоль трассы. Положительная — впереди, отрицательная — сзади. |
| `closingSpeedMetersPerSecond` | Положительное значение означает уменьшение абсолютной дистанции. |
| `overlap` | Приблизительная глубина нахождения бок о бок `0..1`, а не точное пересечение world-space geometry. |
| `threat` | Нормализованная степень угрозы. Допускайте новые значения. |
| `confidence` | Приблизительная уверенность сопоставления контакта. |
| `isApproaching` | Контакт находится сзади и быстро приближается. |

Текущий публичный протокол не предоставляет точные world X/Y/orientation всех соперников. Геометрия радара является приближением на основе spotter state и lap progress.

### 11.8 `relative`

```ts
interface RelativeState {
  entries: RelativeEntry[];
}

interface RelativeEntry {
  carIndex: number;
  carNumber: string;
  driverName: string;
  carClassName: string;
  position: number;
  relation: "ahead" | "behind" | string;
  distanceMeters: number;
  estimatedGapSeconds: number;
  onPitRoad: boolean;
  isPlayer: boolean;
}
```

| Поле | Значение |
|---|---|
| `entries` | До 12 ближайших машин, кроме игрока, внутри relative window. |
| `relation` | Впереди или сзади по wrapped lap progress. |
| `distanceMeters` | Знаковая дистанция: положительная впереди, отрицательная сзади. |
| `estimatedGapSeconds` | Приближение на основе текущей скорости игрока, не официальный timing gap. |
| `position` | Текущая общая позиция, если известна. |

Relative предназначен для spatial awareness. Не выдавайте `estimatedGapSeconds` за официальный разрыв scoring system.

### 11.9 `standings`

```ts
interface StandingsState {
  mode: "overall" | "class" | string;
  entries: StandingEntry[];
}

interface StandingEntry {
  carIndex: number;
  position: number;
  classPosition: number;
  carNumber: string;
  driverName: string;
  teamName: string;
  carClassId: number;
  carClassName: string;
  iRating: number;
  license: string;
  lap: number;
  lapDistancePercent: number;
  gapToLeaderSeconds: number;
  intervalSeconds: number;
  lastLapSeconds: number;
  bestLapSeconds: number;
  incidentCount: number;
  onPitRoad: boolean;
  isPlayer: boolean;
  status: "running" | "pit" | "out" | string;
}
```

| Поле | Значение |
|---|---|
| `position` | Уплотнённая общая позиция после удаления stale/non-participating roster entries. |
| `classPosition` | Уплотнённая позиция внутри `carClassId`. |
| `carClassId` | Надёжный ключ группировки класса. |
| `carClassName` | Отображаемое имя класса. |
| `lap` | Наиболее достоверный счётчик прогресса круга. |
| `lapDistancePercent` | `0..1`. |
| `gapToLeaderSeconds` | В гонке — scoring gap, если доступен; в Practice/Qualifying — проигрыш лучшему best lap. `0` может означать лидера или отсутствие данных. |
| `intervalSeconds` | Разрыв до предыдущей строки в опубликованном порядке; `0` может означать отсутствие данных. |
| `lastLapSeconds` | `0`, если неизвестен. |
| `bestLapSeconds` | `0`, если неизвестен. |
| `incidentCount` | Доступный incident count; для соперников может зависеть от session results. |
| `isPlayer` | Флаг игрока. Дополнительно сравнивайте `carIndex` с `player.carIndex`. |
| `status` | `running`, `pit`, `out` или новое значение. |

Гоночные позиции стабилизируются примерно 350 мс, чтобы отфильтровать одно-кадровые скачки на timing line. Practice и Qualifying сортируются в первую очередь по best lap.

### Определение мультикласса

```js
function classCount(entries) {
  return new Set(
    entries
      .filter((entry) => Number.isFinite(entry.carClassId))
      .map((entry) => entry.carClassId)
  ).size;
}
```

Для группировки используйте `carClassId`, для отображения — `carClassName`.

---

## 12. Семантика данных и защитный рендеринг

### Недоступные числовые значения

Для многих положительных величин ApexHUD использует `0` как отсутствие данных: lap times, shift thresholds и некоторые gaps. Проверяйте контекстные flags, если они есть.

```js
function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
```

### Не парсите человекочитаемые строки как enum

`connection.status`, `sessionName`, `eventType`, имена и команды — отображаемые строки.

### Принимайте новые enum values

```js
const severityClass = {
  nearby: "nearby",
  warning: "warning",
  critical: "critical",
  "fast-approach": "approach",
}[contact.threat] || "unknown";
```

### Идентификация игрока

Рекомендуемый fallback:

```js
const playerEntry = entries.find((entry) =>
  entry.isPlayer || entry.carIndex === player.carIndex
);
```

Не определяйте игрока только по имени.

### Форматирование времени круга

```js
function formatLap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}
```

### Форматирование gap

```js
function formatGap(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return `+${seconds.toFixed(seconds < 10 ? 3 : 1)}`;
}
```

---

## 13. Видимость и режим редактирования

Обрабатывайте `apex:visibility`.

Рекомендуемое поведение:

- Скрывать root при `visible=false`.
- Останавливать timers, animations и тяжёлые расчёты.
- Сохранять runtime state для быстрого возврата.
- В edit mode показывать стабильное representative empty state, а не схлопываться до нулевого размера.
- Не рисовать собственную edit border — ApexHUD добавляет editor chrome.
- Не использовать edit mode для хранения данных.

Пример:

```js
let visible = true;

function setVisibility(message) {
  visible = Boolean(message.visible);
  document.documentElement.classList.toggle("module-hidden", !visible);

  if (!visible) {
    stopAnimation();
  } else {
    resumeAnimation();
  }
}
```

---

## 14. Несколько экземпляров и сохранение состояния

Каждый iframe получает уникальный `instanceId` в `apex:init`.

### Правила

- Runtime state должен жить внутри конкретного iframe.
- Не считайте настройки глобальными для module ID.
- Не полагайтесь на общую browser storage.
- При необходимости включайте `instanceId` в diagnostic log.
- Дублированные экземпляры независимо получают одинаковые telemetry frames.

```js
let instanceId = "unknown";

if (message.type === "apex:init") {
  instanceId = String(message.instanceId || "unknown");
}
```

---

## 15. Наследование Base Layout

ApexHUD использует Base Layout и дочерние session layouts:

```text
Base Layout
Test Drive
Practice
Qualifying
Race
Replay
```

Модулю не нужен специальный код наследования, но разработчик должен понимать влияние на persistence.

### Поведение

- Модуль, добавленный в Base Layout, наследуется дочерними слоями.
- Дочерний слой может переопределить bounds, settings, z-index и enabled.
- Удаление inherited-модуля в дочернем слое создаёт tombstone, поэтому он не появится там заново.
- Новый instance в Base появляется в дочерних слоях, если конкретный instance не был явно удалён.
- Модуль, добавленный только в дочерний слой, остаётся локальным для него.
- При копировании layout source материализуется, а в target сохраняются необходимые overrides.

### Влияние обновлений модуля

- Изменение JS/CSS влияет на все экземпляры после reload.
- Изменение `defaultBounds` влияет только на новые экземпляры.
- Изменение defaults в manifest влияет только на новые экземпляры.
- Существующие per-instance settings сохраняются.
- Новый manifest setting требует fallback в коде, потому что старые instances могут его не содержать.

---

## 16. Рендеринг и производительность

Telemetry service по умолчанию отправляет 30 Hz. Большинство UI не нуждается в полной перерисовке 30 раз в секунду.

### Рекомендуемая частота

| Тип UI | Частота |
|---|---:|
| Передача, RPM, педали, radar | 20–30 Hz |
| Delta bar | 20–30 Hz |
| Relative movement | 10–20 Hz |
| Standings table | 5–10 Hz |
| Session clock | 4–10 Hz |
| Static labels/settings | только при изменении |

### Переиспользуйте DOM

Плохо:

```js
root.innerHTML = buildEntireTable(entries);
```

на каждом кадре.

Лучше:

- один раз создать стабильные rows;
- менять text nodes и CSS variables;
- ключевать строки по `carIndex`;
- создавать/удалять rows только при изменении состава.

### Используйте sequence и throttle

```js
let lastPaintAt = 0;
let pendingPayload;

function onFrame(message) {
  pendingPayload = message.payload;
  const now = performance.now();
  if (now - lastPaintAt < 100) return; // 10 Hz
  lastPaintAt = now;
  render(pendingPayload);
}
```

Для плавного движения храните последний payload и рисуйте через `requestAnimationFrame`.

### Предпочтительные изменения

Используйте:

- `transform`;
- `opacity`;
- CSS variables;
- обновление SVG attributes;
- стабильную geometry.

Избегайте:

- повторных layout measurements в циклах;
- тяжёлых box-shadow и blur;
- синхронной тяжёлой сортировки каждый frame;
- неограниченных массивов;
- постоянных декоративных animations.

### Ограничивайте history buffers

```js
history.push(sample);
if (history.length > maximumSamples) {
  history.splice(0, history.length - maximumSamples);
}
```

### Приостанавливайте скрытый модуль

При `visible=false` по возможности останавливайте animation frames и timers.

---

## 17. Гоночный UX и визуальный дизайн

Гоночный HUD воспринимается периферическим зрением. Состояние должно считываться раньше, чем водитель осознанно прочитает текст.

### Иерархия

1. Одно главное значение.
2. Один state color или shape.
3. Короткий контекст.
4. Детали только при необходимости.

### Хороший glanceable design

- Большая стабильная цифра передачи.
- Большая позиция и маленькое уточнение class/overall.
- Battle box на три строки вместо таблицы на двадцать.
- Фиксированная ширина gaps.
- Сильное выделение игрока.
- Короткие labels.
- Изменение цвета только на реальном action threshold.

### Плохой интерфейс во время гонки

- Длинные фразы.
- Мелкий low-contrast text.
- Несколько одинаково важных значений.
- Постоянное движение.
- Декоративные gradients, конкурирующие с данными.
- Огромный header внутри маленького widget.
- Ранние warning colors, создающие ложную срочность.

### Визуальная система ApexHUD

Базовые цвета:

```text
Panel:          rgba(0,0,0,.90)
Primary text:   #f5f5f5
Secondary text: rgba(255,255,255,.55)
Player/action:  #f2c94c
Positive:       #36c96b
Negative:       #ef4444
Neutral blue:   #179fc4
```

Typography:

```css
font-family: "Bahnschrift", "Segoe UI Variable", "Segoe UI", Arial, sans-serif;
font-variant-numeric: tabular-nums;
```

Рекомендации:

- Opacity панели примерно 0.82–0.94.
- Outer radius 0–3 px для стиля timing equipment.
- Не использовать glow, bloom и backdrop blur.
- Компактные строки и стабильные ширины columns.
- Длинные имена обрезать ellipsis.
- Critical state не должен кодироваться только цветом.
- Проверять на ярком небе, траве, тёмном кокпите и ночью.
- Empty state должен быть спокойным и понятным.

### Адаптивный CSS

```css
.value {
  font-size: clamp(24px, 28cqh, 58px);
}

.name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

Модуль должен работать и в `minimumSize`, и в более широком пользовательском размере.

---

## 18. Локализация

### Содержимое модуля

Модуль может включать собственные переводы и выбирать язык через `navigator.language`:

```js
const locale = String(navigator.language || "en").toLowerCase();
const language = locale.startsWith("ru") ? "ru" : "en";
```

Все переводы должны быть локальными.

### Локализация строк manifest

В ApexHUD 0.10.0 schema содержит по одной строке `name`, `description`, `label` и `help`. Host пока не поддерживает localized maps и не отправляет выбранный язык Control Center в `apex:init`.

Рекомендации:

- Для Community manifest использовать простой международный английский.
- Видимый контент самого модуля при необходимости локализовать внутри.
- Нельзя динамически изменить labels host-generated settings UI из модуля.

---

## 19. Безопасность и CSP

### Рекомендуемый CSP

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';"
/>
```

Такой CSP требует внешние локальные JS/CSS вместо inline scripts/styles.

### Правила безопасности

- Не использовать `eval` и `new Function`.
- Не импортировать remote scripts.
- Не загружать remote fonts.
- Полностью избегать network access.
- Считать telemetry text недоверенными display data и назначать через `textContent`.
- Если генерируется HTML, экранировать имена и labels.
- Проверять форму входящего сообщения.
- Проверять `event.source === window.parent`.
- Ограничивать размер и частоту diagnostic logs.
- Не включать токены, credentials и private endpoints.

Безопасный вывод:

```js
nameElement.textContent = String(entry.driverName || "Unknown");
```

Небезопасный:

```js
nameElement.innerHTML = entry.driverName;
```

### Sandbox не делает код доверенным

Модуль остаётся исполняемым JavaScript. Исходники сторонних модулей нужно проверять. Sandbox убирает Node/Electron/filesystem privileges, но не превращает неизвестный код в безопасный автоматически.

---

## 20. Рабочий процесс разработки

### Требования к репозиторию ApexHUD

```text
Node.js >= 22.12
npm >= 10
.NET 8 SDK для telemetry service
```

### Установка зависимостей

```powershell
npm ci --include=dev --foreground-scripts
```

### Dev mode

```powershell
.\scripts\dev.ps1
```

### Проверка protocol и manifests

```powershell
npm run verify
```

Или только manifest:

```powershell
npm --workspace @apexhud/protocol run build
node .\scripts\verify-manifests.mjs
```

Repository verifier сканирует встроенные папки внутри `modules/` и пропускает директории с `_`. Локальные user modules валидируются приложением при reload каталога.

### Рекомендуемый цикл

1. Изменить файлы.
2. Перезагрузить каталог, если изменился manifest или package structure.
3. Удалить и добавить instance заново только при проверке новых manifest defaults.
4. Открыть визуальный редактор.
5. Проверить minimum и большой размер.
6. Проверить mock telemetry.
7. Проверить live iRacing.
8. Посмотреть Electron DevTools console и `[module:<id>]` logs.

### Visual preview

Команда:

```powershell
npm run preview:modules
```

открывает visual harness встроенных модулей. Это проверка внешнего вида, а не замена реального host lifecycle, sandbox, persistence и live telemetry. Для custom module временно добавьте его в preview page либо тестируйте через реальный ApexHUD editor.

### Проверяйте protocol mismatch

Надёжный модуль должен показать понятное unavailable state, а не упасть при неподдерживаемой версии протокола.

---

## 21. Чек-лист тестирования

### Lifecycle

- [ ] Загружается без телеметрии.
- [ ] Обрабатывает `source: none`.
- [ ] Работает с mock source.
- [ ] Работает с live source.
- [ ] Применяет settings из `apex:init`.
- [ ] Применяет последующие `apex:settings`.
- [ ] Скрывается и приостанавливается при `visible=false`.
- [ ] Показывает стабильное состояние в edit mode.
- [ ] Переживает reload iframe.

### Данные

- [ ] Не падает при отсутствии ожидаемого scope в тестовом payload.
- [ ] Защитно обрабатывает `0`, отрицательные и non-finite values.
- [ ] Обрабатывает неизвестные enum strings.
- [ ] Обрабатывает длинные имена гонщиков, команд и трасс.
- [ ] Идентифицирует игрока через fallback по `carIndex`.
- [ ] Работает в single-class и multiclass.
- [ ] Обрабатывает pit и out statuses.
- [ ] Обрабатывает пустые standings/relative/radar arrays.

### Layout

- [ ] Работает в `minimumSize`.
- [ ] Работает на 1920×1080.
- [ ] Работает на 2560×1440.
- [ ] Работает на ultrawide.
- [ ] Одновременно работают два instances.
- [ ] Editor chrome не виден в race mode.
- [ ] Контент не вылезает за iframe.

### Визуал

- [ ] Читается на ярком и тёмном фоне.
- [ ] Главное значение различимо периферическим зрением.
- [ ] Важные columns не двигаются.
- [ ] Critical color имеет дополнительный text/shape cue.
- [ ] Нет декоративного пульса, glow и blur.
- [ ] Нет случайного белого или непрозрачного фона.

### Производительность

- [ ] History arrays ограничены.
- [ ] Таблица не перестраивается полностью 30 раз/с без причины.
- [ ] Нет console log на каждый frame.
- [ ] Timers останавливаются при скрытии.
- [ ] CPU остаётся стабильным в длинной сессии.

### Пакет

- [ ] Manifest проходит validation.
- [ ] Entry существует.
- [ ] Все пути относительные.
- [ ] Модуль работает offline.
- [ ] Нет `node_modules`.
- [ ] Нет секретов и machine-specific paths.
- [ ] Для Community есть preview до 2.5 MB.
- [ ] Включены LICENSE и README.

---

## 22. Публикация в Community-каталоге

Дефолтный каталог:

```text
https://github.com/EugeneK32/apexhud-community-modules.git
```

Дефолтная ветка:

```text
main
```

### Поддерживаемая структура каталога

Папки в корне:

```text
repository/
  module-a/
    manifest.json
  module-b/
    manifest.json
```

Или внутри `modules/`:

```text
repository/
  modules/
    module-a/
      manifest.json
    module-b/
      manifest.json
```

Сканируются только непосредственные дочерние директории. Папки модулей могут быть обычными директориями или Git submodules.

### Рекомендуемая структура отдельного module repository

```text
manifest.json
index.html
style.css
module.js
preview.webp
README.md
LICENSE
```

Если catalog repository использует submodules, корень каждого submodule должен одновременно быть корнем модуля с `manifest.json`.

### Preview

Рекомендация:

```text
preview.webp
960 × 540
16:9
<= 2.5 MB
```

Распознаваемые пути Community catalog:

```text
preview.webp
preview.png
preview.jpg
preview.jpeg
assets/preview.webp
assets/preview.png
assets/preview.jpg
```

Для максимальной совместимости используйте `preview.webp` в корне.

Preview показывается в каталоге/библиотеке и не загружается в race overlay, если сам HTML его не подключает.

### Установка и обновление

- Catalog shallow-clone выполняется вместе с recursive submodules.
- Установка копирует файлы в user modules directory.
- `.git` не копируется.
- ApexHUD создаёт `.apexhud-community.json` для маркировки источника.
- Update атомарно заменяет установленную папку.
- Uninstall удаляет установленную копию, но не catalog cache.
- Автопроверка может запускаться после старта и каждые шесть часов.

### Сравнение версий

Текущее сравнение простое и числовое: version делится по `.`, `+`, `-`, затем сравниваются integer components.

Рекомендуется:

```text
1.0.0
1.1.0
2.0.0
```

Не рассчитывайте на строгий SemVer prerelease ordering:

```text
1.0.0-beta.10
```

### Требования к branch

Настроенная ветка должна существовать на remote, например `origin/main`. Если репозиторий использует другую default branch, её нужно указать в настройках.

### Рекомендации для Community review

- Уникальный reverse-DNS ID, принадлежащий автору.
- Понятный screenshot/preview.
- Открытые исходники.
- Не публиковать только непрозрачный minified bundle без source.
- Строгий CSP.
- Offline operation.
- Отсутствие telemetry exfiltration.
- Changelog для заметных изменений.

---

## 23. Версионирование и совместимость

### Protocol version

ApexHUD 0.10.0 отправляет protocol version `5` в `apex:init` и `apex:frame`.

Модуль должен:

- игнорировать неизвестные поля объектов;
- проверять используемые значения;
- спокойно обрабатывать неподдерживаемую версию;
- документировать минимальную версию ApexHUD.

Рекомендуемая строка в README:

```text
Requires ApexHUD 0.10.0 or later (telemetry protocol v5).
```

### Manifest version

`schemaVersion` не связан с telemetry protocol version.

Текущие значения:

```text
manifest schema: 1
telemetry protocol: 5
```

### Module version

Используйте numeric SemVer-like version:

```text
MAJOR.MINOR.PATCH
```

- MAJOR — несовместимые изменения поведения/settings.
- MINOR — новые совместимые возможности.
- PATCH — bug fixes и visual corrections.

### Совместимость settings

Для сохранения существующих layouts:

- Не меняйте `manifest.id` после публикации.
- Избегайте переименования setting keys.
- Сохраняйте типы values.
- По возможности принимайте старые values.
- Добавляйте internal defaults для новых keys.

### Совместимость entry

Изменение `entry` допустимо, если новый файл существует. Host перечитает manifest и сформирует новый URL.

---

## 24. Полноценный пример модуля

Рядом с руководством включён полный пример `Battle Focus`:

```text
docs/examples/battle-focus/
```

Он демонстрирует:

- валидный manifest;
- scopes `player`, `session`, `standings`;
- per-instance settings;
- protocol v5;
- fallback идентификации игрока;
- автоматический single-class/multiclass режим;
- стабильный DOM на три строки;
- visibility handling;
- защитное форматирование чисел;
- glanceable CSS в стиле ApexHUD;
- строгий CSP.

Для установки скопируйте всю папку в user modules directory и перезагрузите catalog.

---

## 25. Диагностика проблем

### Модуль не появился в библиотеке

Проверьте:

1. Папка — непосредственный child modules root.
2. Имя папки не начинается с `_`.
3. `manifest.json` — валидный JSON.
4. `schemaVersion` равен `1`.
5. `id` — валидный lowercase reverse-DNS.
6. `scopes` непустой и содержит поддерживаемые значения.
7. `entry` существует.
8. Нет duplicate ID.
9. Выполнен reload modules или restart.
10. В main-process console нет `[modules]` warning.

### Модуль виден, но пустой

Проверьте:

- HTML правильно подключает CSS/JS.
- CSP разрешает локальные файлы.
- `html` и `body` имеют размер.
- В JS нет syntax error.
- Модуль не требует frame до init.
- Нужный scope объявлен.
- Root не остался скрытым после visibility state.

Базовый CSS:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}
```

### Появляется белый фон

Явно сделайте прозрачными все root layers:

```css
html,
body,
#app,
.widget-root {
  background: transparent !important;
}
```

У canvas уберите background fill и очищайте:

```js
ctx.clearRect(0, 0, canvas.width, canvas.height);
```

Не рисуйте placeholder panel в normal runtime, если он не является частью дизайна.

### Настройки не меняются

- Обрабатывайте и `apex:init`, и `apex:settings`.
- Объединяйте с defaults.
- Применяйте CSS variables после каждого update.
- Не ожидайте, что host перезагрузит iframe после каждого setting change.

### Новый setting undefined в старом layout

Это ожидаемо. Старый instance хранит старый settings object. Нужен internal fallback.

### Изменение `defaultBounds` не сработало

Это ожидаемо для существующих instances. При тестировании удалите и добавьте instance заново либо сбросьте layout.

### Preview не отображается в Community

Используйте:

```text
preview.webp
```

в корне модуля. Проверьте:

- файл закоммичен и запушен;
- он находится в настроенной branch;
- размер меньше 2.5 MB;
- catalog обновлён корректно;
- если используются submodules, обновлён pointer на commit.

### Update не определяется

- Увеличьте `manifest.version` численно.
- Запушьте catalog repository или новый submodule commit.
- Проверьте branch.
- Нажмите **Проверить обновления**.

### Не приходит поле телеметрии

- Проверьте scope в manifest.
- Проверьте protocol v5.
- Защитно обрабатывайте partial test payload.
- При разработке при необходимости смотрите `/snapshot` telemetry service.

### Позиции скачут

Для официального order используйте `standings.position`, а не собственную сортировку только по `lap + lapDistancePercent`. Эти значения обновляются неатомарно на timing line.

### Relative gap отличается от scoring gap

Это ожидаемо. `relative.estimatedGapSeconds` — spatial estimate. Для официального timing используйте gaps из standings.

---

## 26. Текущие ограничения API

На ApexHUD 0.10.0 публичный API модулей не предоставляет:

- точные world X/Y coordinates и orientation соперников;
- геометрию карты трассы;
- определения поворотов;
- полное историческое хранилище телеметрии;
- изменение layout по инициативе модуля;
- сохранение settings по инициативе модуля;
- произвольные host commands;
- localized maps для manifest strings;
- negotiation API возможностей protocol;
- официальный npm SDK для module code;
- гарантированную browser storage;
- network access как поддерживаемую возможность.

Не следует имитировать отсутствующий API через неподдерживаемый Electron или filesystem access.

---

## 27. Чек-лист релиза

### Идентичность и совместимость

- [ ] Стабильный уникальный module ID.
- [ ] Version увеличена.
- [ ] Минимальная версия ApexHUD/protocol указана.
- [ ] Существующие setting keys сохранены.

### Manifest

- [ ] Schema version 1.
- [ ] Понятные name и description.
- [ ] Запрошены только нужные scopes.
- [ ] Bounds валидны.
- [ ] Minimum size протестирован.
- [ ] Settings проходят validation.

### Runtime

- [ ] Protocol v5 обработан.
- [ ] Init, frame, settings и visibility обработаны.
- [ ] Неизвестные values не ломают модуль.
- [ ] Несколько instances работают.
- [ ] Нет зависимости от browser storage.

### Визуал

- [ ] Информация читается во время езды.
- [ ] Читается на ярких и тёмных сценах.
- [ ] Geometry стабильна.
- [ ] Нет случайного белого фона.
- [ ] Нет лишних animation/glow/blur.

### Производительность

- [ ] Memory bounded.
- [ ] Разумная render rate.
- [ ] Hidden state останавливает работу.
- [ ] Нет per-frame logging.

### Безопасность

- [ ] Строгий CSP.
- [ ] Нет remote dependencies.
- [ ] Нет eval.
- [ ] Untrusted text выводится через `textContent`.
- [ ] Нет секретов.

### Community package

- [ ] Есть `preview.webp`.
- [ ] Preview <= 2.5 MB.
- [ ] Есть README и LICENSE.
- [ ] Catalog/submodule commit обновлён.
- [ ] Install и update протестированы через catalog.

---

## Канонические исходники контракта

Для точной реализации ApexHUD 0.10.0 смотрите:

```text
packages/protocol/src/index.ts
apps/desktop/src/main/moduleCatalog.ts
apps/desktop/src/main/communityModuleService.ts
apps/desktop/src/renderer/overlay/index.ts
services/telemetry/Models/TelemetrySnapshot.cs
services/telemetry/Processing/TelemetryProcessor.cs
modules/_template/
docs/VISUAL_SYSTEM.md
```

TypeScript definitions в `packages/protocol/src/index.ts` являются основным машиночитаемым контрактом.
