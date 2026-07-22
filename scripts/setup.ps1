[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name not found. $InstallHint"
    }
}

Require-Command node 'Install Node.js 22 LTS or newer.'
Require-Command npm 'npm is included with Node.js.'
Require-Command dotnet 'Install the .NET 8 SDK.'

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 22) {
    throw "Node.js 22+ is required. Found $(node --version)."
}

$dotnetMajor = [int]((dotnet --version).Split('.')[0])
if ($dotnetMajor -lt 8) {
    throw ".NET SDK 8+ is required. Found $(dotnet --version)."
}

Write-Host '[1/4] Installing JavaScript dependencies...' -ForegroundColor Cyan
npm ci --foreground-scripts

Write-Host '[2/4] Restoring telemetry service...' -ForegroundColor Cyan
dotnet restore .\services\telemetry\ApexHUD.Telemetry.csproj

Write-Host '[3/4] Verifying TypeScript...' -ForegroundColor Cyan
npm run typecheck

Write-Host '[4/4] Preparing user module directory...' -ForegroundColor Cyan
$UserModules = Join-Path $env:APPDATA 'ApexHUD\modules'
New-Item -ItemType Directory -Force -Path $UserModules | Out-Null

Write-Host ''
Write-Host 'ApexHUD is ready.' -ForegroundColor Green
Write-Host 'Run .\scripts\dev.ps1 to start in development mode.'
