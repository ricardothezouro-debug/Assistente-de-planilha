$ErrorActionPreference = "Stop"

$pythonRoot = "C:\Users\ricar\AppData\Local\Programs\Python\Python314"
$pythonScripts = Join-Path $pythonRoot "Scripts"
$pythonExe = Join-Path $pythonRoot "python.exe"

if (-not (Test-Path -Path $pythonExe)) {
    throw "Python nao encontrado em: $pythonExe"
}

if (-not (Test-Path -Path $pythonScripts)) {
    throw "Pasta Scripts nao encontrada em: $pythonScripts"
}

$currentParts = $env:Path -split ";" | Where-Object { $_ -and $_.Trim() }
if ($currentParts -notcontains $pythonRoot) {
    $currentParts = @($pythonRoot) + $currentParts
}

if ($currentParts -notcontains $pythonScripts) {
    $currentParts = @($pythonScripts) + $currentParts
}

$env:Path = $currentParts -join ";"

Write-Host "Python adicionado ao PATH desta sessao."
python --version
pip --version
