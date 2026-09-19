# Quick Start Script untuk Development
# Menjalankan API, Web UI, dan Gateway secara bersamaan

param(
    [switch]$NoGateway
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Incoming Warehouse System" -ForegroundColor Cyan
Write-Host "  Starting All Services..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptRoot = $PSScriptRoot
if (-not $ScriptRoot) {
    $ScriptRoot = Get-Location
}

# Start API Server
Write-Host "🚀 Starting API Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptRoot\Dashboard\api'; Write-Host 'API Server - Port 4123' -ForegroundColor Cyan; npm run start:dev"

# Wait for API server to be ready
Write-Host "⏳ Waiting for API server to be ready..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$apiReady = $false

while ($attempt -lt $maxAttempts -and -not $apiReady) {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4123/api/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $apiReady = $true
            Write-Host "✅ API Server is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "   Attempt $attempt/$maxAttempts - API not ready yet..." -ForegroundColor Gray
    }
}

if (-not $apiReady) {
    Write-Host "⚠️  API server might not be ready yet, but continuing..." -ForegroundColor Yellow
}

# Start Web UI
Write-Host "🌐 Starting Web UI..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptRoot\Dashboard\web'; Write-Host 'Web UI - Port 4234' -ForegroundColor Cyan; npm run dev"

# Wait a bit
Start-Sleep -Seconds 2

# Ask about Gateway
$startGateway = $false
if (-not $NoGateway) {
    Write-Host ""
    $response = Read-Host "Apakah Anda ingin menjalankan Gateway untuk timbangan? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        $startGateway = $true
        
        # Check if Gateway is configured
        $configPath = Join-Path $ScriptRoot "Gateway\app\config.json"
        if (-not (Test-Path $configPath)) {
            Write-Host ""
            Write-Host "⚠️  Gateway belum dikonfigurasi!" -ForegroundColor Yellow
            Write-Host "   Jalankan: cd Gateway/app && .\scripts\setup-gateway.ps1" -ForegroundColor Gray
            Write-Host "   Atau konfigurasi via Web UI di http://localhost:4124 setelah Gateway berjalan" -ForegroundColor Gray
            Write-Host ""
        }
        
        Write-Host "⚖️  Starting Gateway..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptRoot\Gateway\app'; Write-Host 'Gateway - Port 4124 (Config UI)' -ForegroundColor Cyan; npm run dev"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  System is Starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Services:" -ForegroundColor Cyan
Write-Host "   API Server:  http://localhost:4123" -ForegroundColor White
Write-Host "   Web UI:      http://localhost:4234" -ForegroundColor White
if ($startGateway) {
    Write-Host '   Gateway:     http://localhost:4124 (Config UI)' -ForegroundColor White
}
Write-Host ""
Write-Host "🔐 Login Credentials:" -ForegroundColor Yellow
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: admin123" -ForegroundColor White
Write-Host ""
if ($startGateway) {
    Write-Host "💡 Gateway Tips:" -ForegroundColor Yellow
    Write-Host "   - Konfigurasi Gateway: http://localhost:4124" -ForegroundColor White
    Write-Host "   - Pastikan timbangan terhubung sebelum menggunakan Gateway" -ForegroundColor White
}
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit this window (servers will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
