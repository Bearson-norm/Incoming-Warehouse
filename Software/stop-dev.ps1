# Script untuk menghentikan semua services

Write-Host "Stopping Incoming Warehouse services..." -ForegroundColor Yellow
Write-Host ""

# Get all PowerShell windows running npm commands
$processes = Get-Process | Where-Object {
    $_.MainWindowTitle -like "*npm*" -or 
    $_.CommandLine -like "*npm run*"
}

if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "Stopping process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host ""
    Write-Host "✅ All services stopped" -ForegroundColor Green
} else {
    Write-Host "No running services found" -ForegroundColor Gray
}

# Also try to kill node processes that might be running the services
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host ""
    Write-Host "⚠️  Found Node.js processes. Close manually if needed:" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        Write-Host "   PID: $($proc.Id) - $($proc.Path)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
