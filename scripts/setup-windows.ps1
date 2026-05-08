$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if ($env:OS -ne "Windows_NT") {
  throw "This setup script must be run from Windows PowerShell or PowerShell 7 on Windows."
}

Write-Host "Removing node_modules..."
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue

Write-Host "Installing dependencies..."
npm install

Write-Host "Building extension and native host..."
npm run build

Write-Host "Registering Firefox native messaging host..."
npm run install:native:windows

Write-Host ""
Write-Host "Windows setup complete."
Write-Host "Load packages/extension/dist/manifest.json from Firefox about:debugging."
Write-Host "If needed, edit packages/native-host/dist/config.json with your Discord application ID."
