# Модель безопасности

[English](../en/security.md)

ApexHUD считает Community-модули недоверенным кодом. Module iframe работает в sandbox, Node integration выключен, context isolation включён, прямого Electron IPC и filesystem access нет. Assets выдаются через custom protocol с нормализацией пути и ограничением корнем модуля.

Host фильтрует telemetry frame по scopes из `manifest.json`. Это сокращение возможностей, а не защита секретных данных. Модули не должны получать произвольные filesystem paths, process APIs или credentials.

Telemetry HTTP/WebSocket endpoints слушают только loopback. Не меняйте bind на `0.0.0.0` без authentication, origin controls и отдельного threat review.

Модуль остаётся исполняемым JavaScript. Sandbox снижает риск, но не превращает вредоносный UI в безопасный. Проверяйте исходники и сообщайте об уязвимостях по root `SECURITY.md`.

Не храните secrets в manifest, layout settings, screenshots, logs или Community repository. Не ослабляйте CSP ради remote scripts.
