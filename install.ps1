<#
.SYNOPSIS
  Solaria Agent - Instalador para Windows (x64).

  Instalacion rapida (~2-4 min, precompilado):
    irm https://raw.githubusercontent.com/Angelcmp/solaria/main/install.ps1 | iex

.PARAMETER Version
  Version a instalar: latest (default) | v0.9.4 | 0.9.4

.PARAMETER Force
  Reinstalar aunque la version instalada este al dia.

.PARAMETER Uninstall
  Desinstala TODO: binario, wrapper, repo, datos (%USERPROFILE%\.solaria).

  Si la version instalada ya coincide con la solicitada, no hace nada
  (usa -Force para reinstalar). Actualizar: `solaria update` o re-ejecuta.
#>
param(
  [string]$Version = $env:SOLARIA_VERSION,
  [switch]$Force,
  [switch]$Uninstall,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
# pwsh -File mete los flags desconocidos en $args sin error: rechazarlos
# (paridad con install.sh, que falla ante flag desconocido).
if ($args.Count -gt 0) {
  Write-Host "error Flag desconocido: $($args -join ' ') (usa -Help)" -ForegroundColor Red
  exit 1
}
$Repo = if ($env:SOLARIA_REPO) { $env:SOLARIA_REPO } else { 'Angelcmp/solaria' }
$ApiBase = if ($env:SOLARIA_API_BASE) { $env:SOLARIA_API_BASE } else { 'https://api.github.com' }
$BinaryName = 'solaria-agent.exe'
$HomeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$LocalAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HomeDir 'AppData\Local' }
$AppDir = if ($env:SOLARIA_APP_DIR) { $env:SOLARIA_APP_DIR } else { Join-Path $LocalAppData 'solaria' }
$BinDir = Join-Path $AppDir 'bin'
if (-not $Version) { $Version = 'latest' }
$ForceFlag = $Force -or ($env:SOLARIA_FORCE -eq '1')

function Log-Info($m) { Write-Host ":: $m" -ForegroundColor Cyan }
function Log-Ok($m) { Write-Host "ok  $m" -ForegroundColor Green }
function Log-Warn($m) { Write-Host "aviso $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "error $m" -ForegroundColor Red; exit 1 }

if ($Help) {
  Get-Help $PSCommandPath -Detailed | Out-String | Write-Host
  exit 0
}

function Get-ReleaseJson($tag) {
  try {
    Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/releases/tags/$tag" -Headers @{ 'User-Agent' = 'solaria-installer' }
  } catch {
    Fail "no existe el release $tag en $Repo"
  }
}

function Find-AssetUrl($release, $pattern) {
  $a = $release.assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
  if ($a) { return $a.browser_download_url } else { return '' }
}

function Test-Checksum($dir, $localFile, $asset, $sumsUrl) {
  if (-not $sumsUrl) { Log-Warn 'release sin SHA256SUMS.txt; omitiendo verificacion'; return }
  try {
    Invoke-WebRequest -Uri $sumsUrl -OutFile (Join-Path $dir 'SHA256SUMS.txt') -Headers @{ 'User-Agent' = 'solaria-installer' }
  } catch {
    Log-Warn 'no se pudo descargar SHA256SUMS.txt; omitiendo verificacion'; return
  }
  $line = Get-Content (Join-Path $dir 'SHA256SUMS.txt') | Where-Object {
    $n = ($_ -replace '^[^ ]+ +', '' -replace '.*/', '' -replace ' ', '.')
    $w = ($asset -replace ' ', '.')
    $n -eq $w
  } | Select-Object -First 1
  if (-not $line) { Log-Warn "sin entrada para $asset en SHA256SUMS.txt; omitiendo verificacion"; return }
  $expected = ($line -split '\s+')[0]
  $actual = (Get-FileHash -Path (Join-Path $dir $localFile) -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $expected.ToLower()) { Fail "checksum invalido para $asset (descarga corrupta o manipulada)" }
  Log-Ok "checksum verificado: $asset"
}

function Get-InstalledVersion {
  $w = Join-Path $BinDir 'solaria.ps1'
  $out = ''
  if (Test-Path $w) {
    try { $out = & powershell -NoProfile -File $w version 2>$null } catch { $out = '' }
  } elseif (Get-Command solaria -ErrorAction SilentlyContinue) {
    try { $out = solaria version 2>$null } catch { $out = '' }
  }
  ($out -replace '^solaria\s+v?', '' -replace '^v', '').Trim().Split("`n")[0]
}

function Stop-Daemon {
  $w = Join-Path $BinDir 'solaria.ps1'
  if (Test-Path $w) {
    try { & powershell -NoProfile -File $w stop 2>$null | Out-Null } catch {}
  }
  Get-Process -Name 'solaria-agent' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Remove-Item (Join-Path $HomeDir '.solaria\solaria.pid') -Force -ErrorAction SilentlyContinue
}

function Add-PathUser($dir) {
  $cur = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (($cur -split ';') -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', "$cur;$dir", 'User')
    Log-Info "Anadido $dir al PATH de usuario (abre una terminal nueva)"
  }
  if (($env:Path -split ';') -notcontains $dir) { $env:Path += ";$dir" }
}

if ($Uninstall) {
  Log-Info 'Desinstalando Solaria (borrado total)...'
  Stop-Daemon
  Remove-Item $BinDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $AppDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $HomeDir '.solaria') -Recurse -Force -ErrorAction SilentlyContinue
  Log-Ok 'Solaria desinstalado por completo (binario, repo y datos)'
  exit 0
}

# --- Preflight: solo Windows x64 ---
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne 'AMD64') { Fail "Solo Windows x64 soportado (detectado: $arch)" }
Log-Info 'Detectado: Windows (x64)'

# --- Resolver tag ---
if ($Version -eq 'latest') {
  try {
    $latest = Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'solaria-installer' }
    $Version = $latest.tag_name
  } catch {
    Fail "no se pudo obtener el ultimo release de $Repo"
  }
  if (-not $Version) { Fail 'el repositorio aun no tiene releases publicados' }
}
if ($Version -notmatch '^v') { $Version = "v$Version" }

$installed = Get-InstalledVersion
if ($installed -and ($installed -eq $Version.TrimStart('v')) -and (-not $ForceFlag)) {
  Log-Ok "Solaria $installed ya esta instalado y al dia (usa -Force para reinstalar)"
  exit 0
}
if ($installed) { Log-Info "Actualizando $installed -> $($Version.TrimStart('v'))..." }

# --- Descargar ---
Log-Info "Descargando Solaria $Version (precompilado win-x86_64)..."
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("solaria-inst-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$release = Get-ReleaseJson $Version
$tarballUrl = Find-AssetUrl $release 'win-x86_64\.tar\.gz$'
$sumsUrl = Find-AssetUrl $release 'SHA256SUMS\.txt$'
if (-not $tarballUrl) { Fail "el release $Version no trae precompilado Windows x64" }
$tarballName = ($tarballUrl -split '/')[-1]
Invoke-WebRequest -Uri $tarballUrl -OutFile (Join-Path $tmp 'pkg.tar.gz') -Headers @{ 'User-Agent' = 'solaria-installer' }
Test-Checksum $tmp 'pkg.tar.gz' $tarballName $sumsUrl
tar -xzf (Join-Path $tmp 'pkg.tar.gz') -C $tmp
$base = "solaria-$($Version.TrimStart('v'))-win-x86_64"
$stage = Join-Path $tmp $base
if (-not (Test-Path (Join-Path $stage 'solaria-agent.exe'))) { Fail "el tarball no contiene el binario esperado ($base/solaria-agent.exe)" }

Stop-Daemon
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
Copy-Item (Join-Path $stage 'solaria-agent.exe') (Join-Path $AppDir 'solaria-agent.exe') -Force
$stageWrapper = Join-Path $stage 'solaria.ps1'
if (-not (Test-Path $stageWrapper)) { Fail "el tarball no contiene el wrapper esperado ($base/solaria.ps1)" }
Copy-Item $stageWrapper $BinDir -Force
Log-Ok "Binario instalado en $(Join-Path $AppDir 'solaria-agent.exe')"
Log-Ok "Wrapper CLI instalado en $(Join-Path $BinDir 'solaria.ps1')"
Remove-Item $tmp -Recurse -Force

Add-PathUser $BinDir

# --- Verificar ---
& (Join-Path $BinDir 'solaria.ps1') version >$null 2>&1
if ($LASTEXITCODE -ne 0) { Fail 'el comando solaria no responde. Abre una terminal nueva (PATH)' }
Log-Ok "solaria $(& (Join-Path $BinDir 'solaria.ps1') version) responde correctamente"

Write-Host ''
Write-Host '  Solaria instalado correctamente' -ForegroundColor Green
Write-Host ''
Write-Host '  Abrir app:   solaria'
Write-Host '  Guardar key: solaria set-key openai sk-...'
Write-Host '  Actualizar:  solaria update'
Write-Host '  Desinstalar: solaria uninstall --yes'
Write-Host ''
