# Application icon

[Russian version](../ru/app-icon.md)

Replace `apps/desktop/assets/app-icon.png` with a 512×512 sRGB PNG for Control Center branding and tray use. Replace `apps/desktop/assets/app-icon.ico` with a multi-resolution Windows ICO containing 16, 24, 32, 48, 64, 128, and 256 pixel images.

Electron uses the ICO for native windows, taskbar, executable, NSIS installer, uninstaller, and shortcuts. Rebuild packages after changing it. Windows may cache old shortcut or executable icons; recreate the shortcut or restart Explorer when testing.

Keep the mark readable at 16×16, avoid tiny text, and leave safe padding around the silhouette. Do not distribute font source files with the repository.
