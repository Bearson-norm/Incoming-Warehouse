# Generates Incoming-Warehouse-Wireframes-Booklet.pdf from incoming-warehouse-wireframes-booklet.html
$ErrorActionPreference = "Stop"
$docsDir = $PSScriptRoot
$html = Join-Path $docsDir "incoming-warehouse-wireframes-booklet.html"
$pdf = Join-Path $docsDir "Incoming-Warehouse-Panduan-Wireframe.pdf"
$pdfLegacy = Join-Path $docsDir "Incoming-Warehouse-Wireframes-Booklet.pdf"

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
  throw "Google Chrome not found. Install Chrome or edit this script with your browser path."
}
if (-not (Test-Path $html)) {
  throw "Missing booklet HTML: $html"
}

$htmlUri = [Uri]::new((Resolve-Path -LiteralPath $html).Path).AbsoluteUri
if (Test-Path $pdf) { Remove-Item -Force $pdf }

& $chrome `
  --headless=new `
  --disable-gpu `
  --no-pdf-header-footer `
  --run-all-compositor-stages-before-draw `
  --print-to-pdf="$pdf" `
  $htmlUri | Out-Null

$deadline = (Get-Date).AddSeconds(15)
while (-not (Test-Path $pdf) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 200
}

if (-not (Test-Path $pdf)) {
  throw "PDF was not created."
}

Copy-Item -Force $pdf $pdfLegacy
$sizeKb = [math]::Round((Get-Item $pdf).Length / 1KB, 1)
Write-Host "Created: $pdf ($sizeKb KB)"
Write-Host "Also: $pdfLegacy (copy)"
