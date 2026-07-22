# Уведомления о стороннем ПО

ApexHUD включает или линкуется со сторонним ПО. Юридически значимы оригинальные тексты их лицензий.

## IRSDKSharper

- Назначение: доступ .NET к shared-memory telemetry iRacing.
- Лицензия: GNU General Public License v3.0.
- Проект: https://github.com/mherbold/IRSDKSharper

Поскольку telemetry service ApexHUD сейчас линкуется с IRSDKSharper, объединённый репозиторий распространяется по MPL-2.0.

## Electron и npm dependencies

Electron, Chromium, Node.js и npm packages сохраняют собственные лицензии. При подготовке binaries необходимо проверить `package-lock.json` и metadata пакетов.

## iRacing SDK

ApexHUD взаимодействует с локальным SDK/shared-memory interface iRacing. Марки iRacing принадлежат iRacing.com Motorsport Simulations, LLC. ApexHUD не связан с iRacing и не одобрен ею.
