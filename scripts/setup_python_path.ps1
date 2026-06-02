$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonRoot = "C:\Users\ricar\AppData\Local\Programs\Python\Python314"
$pythonScripts = Join-Path $pythonRoot "Scripts"
$pythonExe = Join-Path $pythonRoot "python.exe"

if (-not (Test-Path -Path $pythonExe)) {
    throw "Python nao encontrado em: $pythonExe"
}

if (-not (Test-Path -Path $pythonScripts)) {
    throw "Pasta Scripts nao encontrada em: $pythonScripts"
}

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = $currentPath -split ";" | Where-Object { $_ -and $_.Trim() }

if ($parts -notcontains $pythonRoot) {
    $parts += $pythonRoot
}

if ($parts -notcontains $pythonScripts) {
    $parts += $pythonScripts
}

$newPath = $parts -join ";"
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$env:Path = "$newPath;$machinePath"

Write-Host "Python configurado no PATH do usuario."
python --version
pip --version

Set-Location $projectRoot
if (-not (Test-Path -Path ".venv")) {
    python -m venv .venv
    Write-Host "Ambiente virtual criado em: $projectRoot\.venv"
} else {
    Write-Host "Ambiente virtual ja existe em: $projectRoot\.venv"
}

.\.venv\Scripts\python.exe --version
