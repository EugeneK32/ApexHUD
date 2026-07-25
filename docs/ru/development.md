# Разработка и сборка

[English](../en/development.md)

## Инструменты

- Windows 10/11
- Node.js 22.12+ и npm 10+
- .NET 8 SDK
- Git
- iRacing для live integration testing

## Подготовка

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

`setup.ps1` восстанавливает npm packages и .NET dependencies. Не запускайте `npm ci` при каждой обычной сборке: он сначала удаляет `node_modules`. Используйте его только для намеренного clean restore.

## Development

```powershell
.\scripts\dev.ps1
.\scripts\dev.ps1 -NoTelemetry
```

## Проверка

```powershell
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

Npm pipeline выполняет typecheck protocol и renderer, Vitest, проверку manifests и сборку renderer/main. CI работает на Windows.

## Packaging

```powershell
.\scripts\build.ps1
```

Скрипт проверяет исходники, публикует telemetry service для `win-x64`, собирает NSIS и portable Electron artifacts и копирует их в `dist`. `-InstallDependencies` выполняет clean npm restore.

## Изменение версий

Версии root, desktop и protocol packages меняются одновременно. Обязательное или breaking-изменение snapshot увеличивает `PROTOCOL_VERSION` в TypeScript и `ProtocolConstants.Version` в C#. Обе языковые версии документации и тесты обновляются в том же commit.

## Проверки pull request

- нет `node_modules`, build output, telemetry publish и Community checkout;
- все manifests валидны;
- EN/RU-документы остаются парными;
- необязательные telemetry fields имеют nullable type или availability flag;
- live и mock constructors обновлены одновременно.
