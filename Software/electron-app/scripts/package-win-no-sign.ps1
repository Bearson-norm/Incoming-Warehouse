# PowerShell script to package Windows app without code signing
# This avoids the symbolic link permission error

# Change to electron-app directory (parent of scripts folder)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$electronAppDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $electronAppDir
$releasePath = Join-Path $projectRoot 'release'
Set-Location $electronAppDir

Write-Host "Working directory: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Set all possible environment variables to disable code signing
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""
$env:SKIP_NOTARIZATION = "true"
$env:CSC_LINK = ""
$env:CSC_KEY_PASSWORD = ""
$env:CSC_NAME = ""

$packStartTime = Get-Date

Write-Host "Packaging Windows app without code signing..." -ForegroundColor Green
Write-Host "Environment variables set:" -ForegroundColor Yellow
Write-Host "  CSC_IDENTITY_AUTO_DISCOVERY=$env:CSC_IDENTITY_AUTO_DISCOVERY"
Write-Host "  WIN_CSC_LINK=$env:WIN_CSC_LINK"
Write-Host ""

# electron-builder must resolve electron from this workspace (not only hoisted root)
$electronLocal = Join-Path $electronAppDir 'node_modules\electron'
if (-not (Test-Path $electronLocal)) {
    Write-Host "Installing Electron in electron-app (required for electron-builder)..." -ForegroundColor Yellow
    npm install --workspaces=false
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install Electron workspace dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Check if dependencies are installed
$nodeModulesPath = Join-Path $electronAppDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Dependencies not found. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Ensure workspace dependencies exist (Gateway, API need node_modules for packaging)
$gatewayNodeModules = Join-Path $projectRoot 'Gateway\app\node_modules'
$apiPath = Join-Path $projectRoot 'Dashboard\api'
$apiNodeModules = Join-Path $apiPath 'node_modules'
$apiNestCore = Join-Path $apiNodeModules '@nestjs\core'
$gatewayPath = Join-Path $projectRoot 'Gateway\app'

if (-not (Test-Path $apiNestCore)) {
    Write-Host "Installing workspace dependencies (required for packaging)..." -ForegroundColor Yellow
    Set-Location $projectRoot
    if (-not (Test-Path $gatewayNodeModules)) {
        Write-Host "Installing Gateway node_modules locally (electron-builder extraResources)..." -ForegroundColor Yellow
        Push-Location $gatewayPath
        npm install --workspaces=false
        Pop-Location
    }
    if (-not (Test-Path $apiNestCore)) {
        Write-Host "Installing API node_modules locally (electron-builder extraResources)..." -ForegroundColor Yellow
        Push-Location $apiPath
        npm install --workspaces=false
        Pop-Location
    }
    Set-Location $electronAppDir
    if (-not (Test-Path $apiNestCore)) {
        Write-Host "API node_modules still incomplete (@nestjs/core missing). Packaging would produce a broken app." -ForegroundColor Red
        exit 1
    }
}

# Build first
Write-Host "Building Electron app..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nStaging API/Gateway with full node_modules for packaging..." -ForegroundColor Cyan
node (Join-Path $electronAppDir 'scripts\stage-electron-resources.js')
if ($LASTEXITCODE -ne 0) {
    Write-Host "stage-electron-resources failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nBundling Node.js runtime (Windows x64) - PC target tidak perlu instal Node.js..." -ForegroundColor Cyan
npm run bundle-node
if ($LASTEXITCODE -ne 0) {
    Write-Host "bundle-node failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nPackaging with electron-builder..." -ForegroundColor Cyan

# Read original package.json (now from correct directory)
$packageJsonPath = Join-Path $electronAppDir "package.json"
if (-not (Test-Path $packageJsonPath)) {
    Write-Host "Error: package.json not found at $packageJsonPath" -ForegroundColor Red
    exit 1
}

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json

# Create a clean build config object (only build section, no other package.json fields)
# Only include valid electron-builder properties
$buildConfig = @{}

# Copy only valid build properties
$validBuildProps = @('electronVersion', 'appId', 'productName', 'directories', 'files', 'extraResources', 'win', 'mac', 'linux', 'nsis')
foreach ($propName in $validBuildProps) {
    if ($packageJson.build.PSObject.Properties.Name -contains $propName) {
        $buildConfig[$propName] = $packageJson.build.$propName
    }
}

# Clean win config: remove signing-related properties and add forceCodeSigning: false
if ($buildConfig.win) {
    $winConfig = @{}
    $winProps = $buildConfig.win.PSObject.Properties
    foreach ($prop in $winProps) {
        if ($prop.Name -notin @('sign', 'signingHashAlgorithms', 'certificateFile', 'certificatePassword')) {
            $winConfig[$prop.Name] = $prop.Value
        }
    }
    # Skip winCodeSign/rcedit (avoids symlink extract error on Windows without Developer Mode)
    $winConfig['sign'] = $null
    $winConfig['signingHashAlgorithms'] = @()
    $winConfig['signAndEditExecutable'] = $false
    $iconIco = Join-Path $electronAppDir 'resources\icon.ico'
    if (-not (Test-Path $iconIco)) {
        $winConfig.Remove('icon')
    }
    $buildConfig.win = $winConfig
}

# NSIS installer icons are optional; omit if resources/icon.ico is missing
if ($buildConfig.nsis) {
    $iconIco = Join-Path $electronAppDir 'resources\icon.ico'
    if (-not (Test-Path $iconIco)) {
        $nsisConfig = @{}
        foreach ($prop in $buildConfig.nsis.PSObject.Properties) {
            if ($prop.Name -notin @('installerIcon', 'uninstallerIcon', 'installerHeaderIcon')) {
                $nsisConfig[$prop.Name] = $prop.Value
            }
        }
        $buildConfig.nsis = $nsisConfig
        Write-Host 'Note: resources/icon.ico not found - NSIS will use default Electron icon.' -ForegroundColor Gray
    }
}

# Add forceCodeSigning: false at root level to prevent any signing attempts
$buildConfig['forceCodeSigning'] = $false

# Append bundled Node.js (npm run bundle-node). Not in package.json - mac/linux pack would fail if missing.
$nodeRt = Join-Path $electronAppDir 'node-runtime\win-x64'
if (Test-Path $nodeRt) {
    $nodeBundle = @{ from = "node-runtime/win-x64"; to = "resources/nodejs"; filter = @("**/*") }
    $er = New-Object System.Collections.ArrayList
    foreach ($item in @($buildConfig['extraResources'])) {
        [void]$er.Add($item)
    }
    [void]$er.Add($nodeBundle)
    $buildConfig['extraResources'] = @($er.ToArray())
} else {
    Write-Host 'Warning: node-runtime\win-x64 missing - target PCs may need Node on PATH.' -ForegroundColor Yellow
}

# Save modified config to temp file (only build config, no author or other fields)
$tempConfig = $buildConfig | ConvertTo-Json -Depth 10 -Compress:$false
$tempConfigFile = Join-Path $electronAppDir "electron-builder.temp.json"
$tempConfig | Set-Content $tempConfigFile -Encoding UTF8

Write-Host "Created temporary config file: $tempConfigFile" -ForegroundColor Gray

# Prevent winCodeSign download by setting environment variables and clearing cache
$env:SKIP_NOTARIZATION = "true"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:WIN_CSC_LINK = ""
$env:CSC_LINK = ""
$env:CSC_KEY_PASSWORD = ""
$env:CSC_NAME = ""

$winCodeSignCache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"

try {
    # Use the temp config file (without signing)
    Write-Host "Using temporary config without signing..." -ForegroundColor Yellow
    
    # Clear winCodeSign cache before building to prevent extraction attempts
    if (Test-Path $winCodeSignCache) {
        Write-Host "Clearing winCodeSign cache..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $winCodeSignCache -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    
    # Create empty directory to prevent download attempts
    if (-not (Test-Path $winCodeSignCache)) {
        New-Item -ItemType Directory -Path $winCodeSignCache -Force | Out-Null
        Write-Host "Created empty winCodeSign cache directory" -ForegroundColor Gray
    }
    
    # Try building with portable target first (doesn't require signing)
    Write-Host "Attempting portable build (no installer, no signing required)..." -ForegroundColor Cyan
    
    # Use Invoke-Expression to run command directly (more reliable)
    # Add --config.forceCodeSigning=false to explicitly disable code signing
    $portableCmd = "npm run package -- --win --config `"$tempConfigFile`" --config.win.target=portable --config.forceCodeSigning=false --config.win.signAndEditExecutable=false"
    Write-Host "Running: $portableCmd" -ForegroundColor Gray
    
    Invoke-Expression $portableCmd
    $exitCode = $LASTEXITCODE
    
    # If portable build succeeded, also try NSIS installer
    if ($exitCode -eq 0) {
        Write-Host "`nPortable build succeeded! Creating NSIS installer..." -ForegroundColor Green
        
        $nsisCmd = "npm run package -- --win --config `"$tempConfigFile`" --config.forceCodeSigning=false --config.win.signAndEditExecutable=false"
        Write-Host "Running: $nsisCmd" -ForegroundColor Gray
        
        Invoke-Expression $nsisCmd
        $exitCode = $LASTEXITCODE
        
        # If NSIS failed but portable succeeded, that's okay
        if ($exitCode -ne 0) {
            Write-Host "`n[WARN] NSIS installer creation had issues, but portable build succeeded." -ForegroundColor Yellow
            Write-Host "You can use the portable version from: $(Join-Path $releasePath 'win-unpacked')" -ForegroundColor Cyan
            $exitCode = 0  # Consider it success since portable worked
        }
    } else {
        Write-Host "`nPortable build failed, trying NSIS installer..." -ForegroundColor Yellow
        
        $nsisCmd = "npm run package -- --win --config `"$tempConfigFile`" --config.forceCodeSigning=false --config.win.signAndEditExecutable=false"
        Write-Host "Running: $nsisCmd" -ForegroundColor Gray
        
        Invoke-Expression $nsisCmd
        $exitCode = $LASTEXITCODE
    }
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    $exitCode = 1
} finally {
    # Clean up temp config file
    if (Test-Path $tempConfigFile) {
        Remove-Item $tempConfigFile -ErrorAction SilentlyContinue
        Write-Host "Cleaned up temporary config file" -ForegroundColor Gray
    }
}

# Check if files were actually created despite error code
$unpackedPath = Join-Path $releasePath "win-unpacked"
$installerPath = Join-Path $releasePath "*.exe"

$unpackedFresh = $false
if (Test-Path $unpackedPath) {
    $unpackedExe = Join-Path $unpackedPath 'Incoming Warehouse.exe'
    if (-not (Test-Path $unpackedExe)) {
        $unpackedExe = Get-ChildItem -Path $unpackedPath -Filter '*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    $exePath = if ($unpackedExe -is [System.IO.FileInfo]) { $unpackedExe.FullName } else { $unpackedExe }
    if ($exePath -and (Get-Item -LiteralPath $exePath).LastWriteTime -gt $packStartTime) {
        $unpackedFresh = $true
        Write-Host "`n[OK] Fresh package output: $unpackedPath" -ForegroundColor Green
        if ($exitCode -ne 0) {
            Write-Host '[WARN] electron-builder reported errors but new files exist (e.g. symbolic link warnings).' -ForegroundColor Yellow
            $exitCode = 0
        }
    } elseif ($exitCode -ne 0) {
        Write-Host "`n[WARN] Old files exist in $unpackedPath but this run did not rebuild them." -ForegroundColor Yellow
        Write-Host "Delete the release folder and run package again after fixing errors." -ForegroundColor Yellow
    }
}

if ($exitCode -eq 0) {
    Write-Host "`n[OK] Package created successfully!" -ForegroundColor Green
    Write-Host "Output location: $releasePath" -ForegroundColor Cyan
    if (Test-Path $installerPath) {
        $installer = Get-Item $installerPath | Select-Object -First 1
        Write-Host "Installer: $($installer.FullName)" -ForegroundColor Cyan
    }
    if (Test-Path $unpackedPath) {
        Write-Host "Unpacked app: $((Resolve-Path $unpackedPath).Path)" -ForegroundColor Cyan
    }
} else {
    Write-Host "`n[FAIL] Package failed with exit code: $exitCode" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Try running PowerShell as Administrator" -ForegroundColor White
    Write-Host "2. Check if files were created anyway in: $releasePath" -ForegroundColor White
    Write-Host "3. Error about symbolic links can often be ignored" -ForegroundColor White
    Write-Host '4. Make sure dependencies are installed: cd electron-app; npm install' -ForegroundColor White
}

exit $exitCode
