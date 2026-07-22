[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '[1/3] TypeScript typecheck...' -ForegroundColor Cyan
npm run typecheck

Write-Host '[2/3] Frontend and manifest tests...' -ForegroundColor Cyan
npm test

Write-Host '[3/3] Telemetry service build...' -ForegroundColor Cyan
dotnet build .\services\telemetry\ApexHUD.Telemetry.csproj -c Release

Write-Host 'All available checks passed.' -ForegroundColor Green
