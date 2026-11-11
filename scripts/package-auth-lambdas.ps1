param(
    [string]$PythonExe = "python"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $repoRoot "backend"
$buildRoot = Join-Path $repoRoot "build\auth-lambdas"

if (-not (Test-Path (Join-Path $backendRoot "shared\auth\tokens.py"))) {
    throw "Run this script from the Heat-Safe repository after copying the auth patch."
}

$functionsToPackage = @("auth", "authorizer")

foreach ($functionName in $functionsToPackage) {
    $stage = Join-Path $buildRoot $functionName
    $zipPath = Join-Path $buildRoot ("heat-safe-" + $functionName + ".zip")

    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Path $stage -Force | Out-Null

    # Preserve the Python package path expected by the handler strings in the README.
    $backendStage = Join-Path $stage "backend"
    New-Item -ItemType Directory -Path $backendStage -Force | Out-Null
    Copy-Item (Join-Path $backendRoot "__init__.py") $backendStage
    Copy-Item (Join-Path $backendRoot "shared") (Join-Path $backendStage "shared") -Recurse

    $functionsStage = Join-Path $backendStage "functions"
    New-Item -ItemType Directory -Path $functionsStage -Force | Out-Null
    Copy-Item (Join-Path $backendRoot "functions\__init__.py") $functionsStage
    Copy-Item (Join-Path $backendRoot "functions\$functionName") $functionsStage -Recurse

    # Package PyJWT only. boto3/botocore are available in the managed Python Lambda runtime.
    & $PythonExe -m pip install --disable-pip-version-check --no-compile --no-deps `
        --target $stage "PyJWT==2.13.0"
    if ($LASTEXITCODE -ne 0) { throw "pip install failed for $functionName" }

    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "Created: $zipPath" -ForegroundColor Green
}

Write-Host "Packaging complete. No AWS resources were changed." -ForegroundColor Cyan
