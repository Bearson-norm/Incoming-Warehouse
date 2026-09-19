# Script PowerShell untuk Setup Gateway
# Usage: .\scripts\setup-gateway.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Gateway Setup Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Script harus dijalankan dari direktori Gateway/app" -ForegroundColor Red
    Write-Host "   Jalankan: cd Gateway/app" -ForegroundColor Yellow
    exit 1
}

# Step 1: Install dependencies
Write-Host "📦 Step 1: Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   Installing dependencies..." -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: npm install failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ Dependencies sudah terinstall" -ForegroundColor Green
}

# Step 2: Build project
Write-Host ""
Write-Host "🔨 Step 2: Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Build berhasil" -ForegroundColor Green

# Step 3: Detect serial ports
Write-Host ""
Write-Host "🔍 Step 3: Detecting serial ports..." -ForegroundColor Yellow
Write-Host ""
npm run detect-ports
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Warning: Tidak ada port serial yang ditemukan" -ForegroundColor Yellow
    Write-Host "   Pastikan timbangan terhubung ke komputer" -ForegroundColor Gray
}

# Step 4: Check config file
Write-Host ""
Write-Host "⚙️  Step 4: Checking configuration..." -ForegroundColor Yellow
if (-not (Test-Path "config.json")) {
    Write-Host "   Creating config.json from example..." -ForegroundColor Gray
    Copy-Item "config.example.json" "config.json"
    Write-Host "   ✅ config.json created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit config.json dengan:" -ForegroundColor Yellow
    Write-Host "   1. Port serial timbangan Anda (contoh: COM3, COM9)" -ForegroundColor Gray
    Write-Host "   2. API key yang sama dengan GATEWAY_API_KEY di Dashboard/api/.env" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Atau gunakan Web UI di http://localhost:4124 setelah menjalankan gateway" -ForegroundColor Cyan
} else {
    Write-Host "   ✅ config.json sudah ada" -ForegroundColor Green
}

# Step 5: Check API server
Write-Host ""
Write-Host "🌐 Step 5: Checking API server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4123/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ API server berjalan di http://localhost:4123" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  API server tidak berjalan di http://localhost:4123" -ForegroundColor Yellow
    Write-Host "   Pastikan API server berjalan sebelum menjalankan Gateway" -ForegroundColor Gray
    Write-Host "   Jalankan: cd Dashboard/api && npm run start:dev" -ForegroundColor Cyan
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Edit config.json dengan port serial dan API key yang benar" -ForegroundColor Gray
Write-Host "   2. Pastikan API server berjalan (cd Dashboard/api && npm run start:dev)" -ForegroundColor Gray
Write-Host "   3. Jalankan Gateway: npm run dev" -ForegroundColor Gray
Write-Host "   4. Atau gunakan Web UI di http://localhost:4124 untuk konfigurasi" -ForegroundColor Gray
Write-Host ""
