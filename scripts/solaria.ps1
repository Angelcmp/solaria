# Solaria Agent - lanzador GUI (Windows)
# Resuelve el binario real y abre la aplicación.
# (La terminal solo lanza; toda la interacción vive en la ventana.)

$Binary = 'solaria-agent.exe'

# Orden de busqueda del binario real:
# 1. Instalacion usuario (%LOCALAPPDATA%\solaria, sin admin)
# 2. Build local de desarrollo (target\release junto al repo)
# 3. PATH (por si el binario ya esta expuesto directamente)
$candidates = @()
if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "solaria\$Binary") }
$devBin = Join-Path $PSScriptRoot '..\src-tauri\target\release\solaria-agent.exe'
if (Test-Path $devBin) { $candidates += (Resolve-Path $devBin).Path }

$BinPath = $null
foreach ($c in $candidates) {
  if ($c -and (Test-Path $c)) { $BinPath = $c; break }
}
if (-not $BinPath) {
  $inPath = Get-Command 'solaria-agent' -ErrorAction SilentlyContinue
  if ($inPath) { $BinPath = 'solaria-agent' }
}
if (-not $BinPath) {
  Write-Host 'Error: no se encuentra el binario de Solaria.' -ForegroundColor Red
  Write-Host 'Instalalo con: irm https://raw.githubusercontent.com/Angelcmp/solaria/main/install.ps1 | iex'
  exit 1
}

& $BinPath @args
exit $LASTEXITCODE
