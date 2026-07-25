[CmdletBinding()]
param(
    [ValidateSet('win-x64')]
    [string]$Runtime = 'win-x64',
    [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Publish = Join-Path $Root 'services\telemetry\publish'
$Dist = Join-Path $Root 'dist'
$RequiredTools = @(
    'node_modules\.bin\tsc.cmd',
    'node_modules\.bin\vite.cmd',
    'node_modules\.bin\vitest.cmd',
    'node_modules\.bin\electron.cmd',
    'node_modules\.bin\electron-builder.cmd'
)
$MissingTools = @($RequiredTools | Where-Object { -not (Test-Path (Join-Path $Root $_)) })

Remove-Item $Publish -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Publish, $Dist | Out-Null

Write-Host '[1/4] Checking JavaScript dependencies...' -ForegroundColor Cyan
if ($InstallDependencies -or $MissingTools.Count -gt 0) {
    if ($MissingTools.Count -gt 0) {
        Write-Host "Missing local tools: $($MissingTools -join ', ')" -ForegroundColor Yellow
    }
    Write-Host 'Installing the locked development dependency tree.' -ForegroundColor DarkGray
    npm ci --include=dev --foreground-scripts
} else {
    Write-Host 'Using the existing complete node_modules.' -ForegroundColor DarkGray
    Write-Host 'Use -InstallDependencies to request a clean npm ci reinstall.' -ForegroundColor DarkGray
}

Write-Host '[2/4] Running verification...' -ForegroundColor Cyan
npm run verify

Write-Host '[3/4] Publishing telemetry service...' -ForegroundColor Cyan
dotnet publish .\services\telemetry\ApexHUD.Telemetry.csproj `
    -c Release `
    -r $Runtime `
    --self-contained false `
    -o $Publish

Write-Host '[4/4] Building Windows installer and portable package...' -ForegroundColor Cyan
npm run package:win

Copy-Item '.\apps\desktop\release\*' $Dist -Recurse -Force
Write-Host "Artifacts: $Dist" -ForegroundColor Green
