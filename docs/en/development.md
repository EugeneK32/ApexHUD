# Development and builds

[Russian version](../ru/development.md)

## Toolchain

- Windows 10/11
- Node.js 22.12+ and npm 10+
- .NET 8 SDK
- Git
- iRacing for live integration testing

## Setup

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup.ps1
```

`setup.ps1` restores npm packages and .NET dependencies. Do not run `npm ci` inside every ordinary build: it deletes `node_modules` before reinstalling. Use it deliberately for a clean locked restore.

## Development

```powershell
.\scripts\dev.ps1
.\scripts\dev.ps1 -NoTelemetry
```

## Verification

```powershell
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

The npm pipeline performs protocol and renderer type checks, Vitest tests, manifest validation, and renderer/main builds. CI runs on Windows because the product and telemetry adapter are Windows-oriented.

## Packaging

```powershell
.\scripts\build.ps1
```

The script verifies sources, publishes the telemetry service for `win-x64`, builds Electron NSIS and portable artifacts, and copies results to `dist`. Use `-InstallDependencies` for a deliberate clean npm restore.

## Version changes

Update root, desktop, and protocol package versions together. A breaking or required snapshot change increments `PROTOCOL_VERSION` in TypeScript and `ProtocolConstants.Version` in C#. Update both protocol documentation languages and tests in the same commit.

## Pull request checks

- no generated `node_modules`, build output, telemetry publish folder, or Community checkout;
- all manifests validate;
- EN/RU documentation stays paired;
- new telemetry fields are nullable or have explicit availability flags when iRacing may omit them;
- live and mock snapshot constructors are updated together.
