$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SourceBackend = Join-Path $ProjectRoot "backend"
$BuildRoot = Join-Path $ProjectRoot "build\cool-spots-package"
$StageBackend = Join-Path $BuildRoot "backend"
$OutputDir = Join-Path $ProjectRoot "build\cool-spots-lambda"
$ZipPath = Join-Path $OutputDir "heat-safe-cool-spots.zip"

if (-not (Test-Path (Join-Path $SourceBackend "functions\cool_spots\lambda_function.py"))) {
    throw "Cool Spots Lambda source was not found under backend/functions/cool_spots. Run this script from the project copy containing the refactor."
}
if (-not (Test-Path (Join-Path $SourceBackend "shared\auth\identity.py"))) {
    throw "Shared verified-identity helper is missing. Apply the Heat-Safe authentication backend patch first."
}

if (Test-Path $BuildRoot) { Remove-Item $BuildRoot -Recurse -Force }
if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Path $BuildRoot -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Copy-Item -Path $SourceBackend -Destination $StageBackend -Recurse -Force

# Tests and local bytecode are not part of the Lambda deployment package.
$TestsPath = Join-Path $StageBackend "tests"
if (Test-Path $TestsPath) { Remove-Item $TestsPath -Recurse -Force }
Get-ChildItem -Path $StageBackend -Directory -Recurse -Filter "__pycache__" |
    Remove-Item -Recurse -Force
Get-ChildItem -Path $StageBackend -File -Recurse -Filter "*.pyc" |
    Remove-Item -Force

Compress-Archive -Path $StageBackend -DestinationPath $ZipPath -CompressionLevel Optimal -Force

$Zip = Get-Item $ZipPath
Write-Host "Cool Spots Lambda package created:" -ForegroundColor Green
Write-Host $Zip.FullName
Write-Host ("Size: {0:N2} MB" -f ($Zip.Length / 1MB))
Write-Host "Handler: backend.functions.cool_spots.lambda_function.lambda_handler"
