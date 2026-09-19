# Dump local PostgreSQL database for migration to VPS
# Usage: .\dump-local-db.ps1 [output_path]

param(
    [string]$OutputPath = "wis_foom_backup.dump"
)

$ErrorActionPreference = "Stop"

Write-Host "Dumping local database wis_foom..." -ForegroundColor Cyan

# Try Docker first (if using Docker for local DB)
$dockerContainer = docker ps --filter "name=incoming-warehouse-db" --format "{{.Names}}" 2>$null
if ($dockerContainer) {
    Write-Host "Found Docker container: $dockerContainer" -ForegroundColor Yellow
    docker exec $dockerContainer pg_dump -U admin -d wis_foom --no-owner --no-acl -F c -f /tmp/wis_foom_backup.dump
    docker cp "${dockerContainer}:/tmp/wis_foom_backup.dump" $OutputPath
    Write-Host "Dump saved to: $OutputPath" -ForegroundColor Green
    exit 0
}

# Fallback: local PostgreSQL
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    pg_dump -U admin -h localhost -d wis_foom --no-owner --no-acl -F c -f $OutputPath
    Write-Host "Dump saved to: $OutputPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Copy to VPS: scp $OutputPath user@your-vps-ip:/home/user/" -ForegroundColor Cyan
} else {
    Write-Host "Error: pg_dump not found. Install PostgreSQL client or ensure Docker is running." -ForegroundColor Red
    exit 1
}
