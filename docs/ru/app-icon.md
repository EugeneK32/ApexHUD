# Иконка приложения

[English](../en/app-icon.md)

Замените `apps/desktop/assets/app-icon.png` на sRGB PNG 512×512 для брендинга Control Center и tray. `apps/desktop/assets/app-icon.ico` должен быть multi-resolution ICO с изображениями 16, 24, 32, 48, 64, 128 и 256 px.

Electron использует ICO для native windows, taskbar, executable, NSIS installer, uninstaller и shortcuts. После замены нужна новая packaging-сборка. Windows может кэшировать старую иконку — пересоздайте shortcut или перезапустите Explorer.

Знак должен читаться при 16×16, не содержать мелкого текста и иметь безопасные поля. Font-файлы в репозиторий не добавляются.
