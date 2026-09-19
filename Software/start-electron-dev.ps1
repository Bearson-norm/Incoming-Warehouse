# Jalankan aplikasi Electron dalam mode development (disarankan).
# Hanya Web (Vite) + Electron — API dijalankan OLEH Electron sebagai child process.
# Jangan jalankan bersamaan dengan start-dev.ps1 (akan bentrok API di port 4123).

param()

$ScriptRoot = $PSScriptRoot
if (-not $ScriptRoot) {
    $ScriptRoot = Get-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Incoming Warehouse — Electron Dev" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Membutuhkan API sudah di-build satu kali:" -ForegroundColor Yellow
Write-Host "  npm run build:api" -ForegroundColor Gray
Write-Host ""
Write-Host "Menjalankan Vite + Electron (lihat juga: npm run dev:electron)" -ForegroundColor Gray
Write-Host ""

Set-Location $ScriptRoot
npm run dev:electron
