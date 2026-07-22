# Contributing to ApexHUD

[Russian version](CONTRIBUTING.ru.md)

Thank you for contributing. Open an issue before large architectural changes. Keep pull requests focused and explain the user-visible behavior and test coverage.

## Required checks

```powershell
npm ci
npm run verify
dotnet build ApexHUD.sln --configuration Release
```

Test live iRacing behavior when changing telemetry, standings, radar, window focus, or editor lifecycle. Update mock telemetry and both EN/RU documents for public API changes. Do not commit generated output, credentials, personal telemetry, copyrighted third-party assets, or font files.

By submitting a contribution, you agree that it is licensed under MPL-2.0. Confirm that you have the right to submit all included code and assets.

Be respectful and follow the Code of Conduct.
