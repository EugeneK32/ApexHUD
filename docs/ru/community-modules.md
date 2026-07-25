# Community-модули

[English](../en/community-modules.md)

Git-каталог по умолчанию: `https://github.com/EugeneK32/apexhud-community-modules.git`. ApexHUD клонирует или обновляет его в application user data, checkout-ит выбранную ветку, инициализирует submodules, сканирует manifests и сравнивает версии.

Каждый модуль должен быть автономным и содержать валидный `manifest.json`. Для официального каталога требуется `LICENSE`. Рекомендуются `README.md`, `README.ru.md` и WebP-превью `960×540`.

Поддерживаются `preview.webp/png/jpg/jpeg` и те же имена в `assets/`. Установка выполняется атомарно через временную папку; `.git` metadata в пользовательский modules directory не копируется.

Порядок поиска Git: `APEXHUD_GIT_PATH`, packaged `resources/bin/git/cmd/git.exe`, `resources/bin/git.exe`, source-tree `bin/git/cmd/git.exe`, затем `PATH`.

Авторам рекомендуется использовать semantic versions, не загружать runtime-assets из сети, соблюдать sandbox и запрашивать минимальный набор scopes. `manifest.id` не должен меняться между обновлениями.
