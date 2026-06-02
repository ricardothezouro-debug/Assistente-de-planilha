$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$binaryName = "financeiro-api"
$binariesDir = Join-Path $root "desktop\src-tauri\binaries"
$pyinstallerBuildDir = Join-Path $root "build\pyinstaller"
$pyinstallerDistDir = Join-Path $pyinstallerBuildDir "dist"

Set-Location $root

if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
}

$targetTriple = (& rustc -Vv | Select-String "host:" | ForEach-Object { $_.Line.Split(" ")[1] }).Trim()
if (-not $targetTriple) {
    throw "Nao foi possivel detectar o target do Rust."
}

New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null
New-Item -ItemType Directory -Force -Path $pyinstallerBuildDir | Out-Null

python -m PyInstaller `
    --onefile `
    --noconsole `
    --name $binaryName `
    --distpath $pyinstallerDistDir `
    --workpath (Join-Path $pyinstallerBuildDir "work") `
    --specpath $pyinstallerBuildDir `
    --paths $root `
    --collect-submodules finance_app `
    --hidden-import uvicorn.logging `
    --hidden-import uvicorn.loops `
    --hidden-import uvicorn.loops.auto `
    --hidden-import uvicorn.protocols `
    --hidden-import uvicorn.protocols.http `
    --hidden-import uvicorn.protocols.http.auto `
    --hidden-import uvicorn.protocols.websockets `
    --hidden-import uvicorn.protocols.websockets.auto `
    --hidden-import uvicorn.lifespan `
    --hidden-import uvicorn.lifespan.on `
    --noconfirm `
    api_sidecar.py

$source = Join-Path $pyinstallerDistDir "$binaryName.exe"
$target = Join-Path $binariesDir "$binaryName-$targetTriple.exe"

if (-not (Test-Path $source)) {
    throw "PyInstaller nao gerou o arquivo esperado: $source"
}

Copy-Item -Force -Path $source -Destination $target
Write-Output "Sidecar gerado: $target"
