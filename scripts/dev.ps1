[CmdletBinding()]
param(
    [switch]$NoTelemetry
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ($NoTelemetry) {
    $env:APEXHUD_SKIP_TELEMETRY = '1'
}

npm run dev
