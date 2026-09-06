# Solaria Agent - CLI wrapper (Windows)
# Resuelve el binario real y pasa el directorio actual como --dir
# SOLO a los subcomandos que lo usan (ask / agent).
#
# Uso:
#   cd C:\mi\proyecto
#   solaria                                 # abre la GUI
#   solaria agent "investiga este codigo"   # trabaja sobre $PWD

$Binary = 'solaria-agent.exe'
$WrapperDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Orden de busqueda del binario real:
# 1. Instalacion usuario (%LOCALAPPDATA%\solaria, sin admin)
# 2. Build local de desarrollo (target\release junto al repo)
# 3. PATH (por si el binario ya esta expuesto directamente)
$candidates = @(
  (Join-Path $env:LOCALAPPDATA "solaria\$Binary")
)
$devBin = Join-Path $WrapperDir '..\src-tauri\target\release\solaria-agent.exe'
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

# Solo ask/agent usan --dir.
$needsDir = ($args.Count -gt 0) -and ($args[0] -in @('ask', 'agent'))

$hasDir = $false
foreach ($a in $args) {
  if (($a -eq '--dir') -or ($a -like '--dir=*') -or ($a -eq '-d')) { $hasDir = $true; break }
}

$finalArgs = $args
if ($needsDir -and (-not $hasDir)) {
  # Insertar --dir justo tras el subcomando.
  if ($args.Count -gt 1) {
    $finalArgs = @($args[0], '--dir', (Get-Location).Path) + @($args[1..($args.Count - 1)])
  } else {
    $finalArgs = @($args[0], '--dir', (Get-Location).Path)
  }
}

& $BinPath @finalArgs
exit $LASTEXITCODE
