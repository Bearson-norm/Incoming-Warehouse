# PowerShell script to setup PostgreSQL database
# This script will create the admin user and wis_foom database

Write-Host "Setting up PostgreSQL database for Incoming Warehouse System..." -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "Error: psql command not found. Please make sure PostgreSQL is installed and in your PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Creating admin user and database..." -ForegroundColor Yellow
Write-Host "You may be prompted for the postgres user password." -ForegroundColor Yellow
Write-Host ""

# Execute SQL script
$scriptPath = Join-Path $PSScriptRoot "setup-database.sql"
psql -U postgres -h localhost -f $scriptPath

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Error: Failed to execute database setup. Please check the error messages above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Run the SQL commands manually:" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -h localhost" -ForegroundColor Yellow
    Write-Host "  Then copy and paste the contents of setup-database.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Granting schema privileges..." -ForegroundColor Yellow

# Grant schema privileges (need to connect to wis_foom)
$grantSql = @"
GRANT ALL ON SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
"@

$grantSql | psql -U postgres -h localhost -d wis_foom

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  npm run prisma:migrate:dev" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Warning: Schema privileges may not have been granted. You may need to run:" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -h localhost -d wis_foom" -ForegroundColor Yellow
    Write-Host "  GRANT ALL ON SCHEMA public TO admin;" -ForegroundColor Yellow
}
