#!/usr/bin/env bash
#
# Solaria Agent — Instalador para macOS (Apple Silicon)
#
#   Instalación rápida (~2-4 min, precompilado aarch64):
#     curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install-macos.sh | bash
#
#   Opciones (flags o variables de entorno):
#     --force         | SOLARIA_FORCE=1         Reinstalar aunque la versión instalada esté al día
#     --uninstall                             Desinstala TODO: binario, wrapper,
#                                             repo, datos (~/.solaria)
#     --help                                    Muestra esta ayuda
#
#   Versión a instalar:
#     SOLARIA_VERSION=latest (default) | v0.9.3 | 0.9.3
#
#   Si la versión instalada ya coincide con la solicitada, no hace nada
#   (usa --force para reinstalar). Actualizar: `solaria update` o re-ejecuta.
#
#   Sin firma (Apple Developer): el primer arranque de la GUI pedirá
#   clic derecho → Abrir. El CLI no está afectado.
#   Solo Apple Silicon (arm64); Intel no soportado.
#
set -euo pipefail

REPO="${REPO:-Angelcmp/solaria}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"
BINARY_NAME="solaria-agent"
INSTALL_DIR="${SOLARIA_INSTALL_DIR:-$HOME/.local/bin}"
APP_DIR="${SOLARIA_APP_DIR:-$HOME/.local/share/solaria}"

FORCE="${SOLARIA_FORCE:-0}"
SOLARIA_VERSION="${SOLARIA_VERSION:-latest}"
WRAPPER_SRC="${WRAPPER_SRC:-$APP_DIR/scripts/solaria}"
ICON_SRC="${ICON_SRC:-$APP_DIR/src-tauri/icons/128x128.png}"

# ── Colors & log ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}::${NC} $1"; }
ok()   { echo -e "${GREEN}ok${NC}  $1"; }
warn() { echo -e "${YELLOW}aviso${NC} $1"; }
err()  { echo -e "${RED}error${NC} $1" >&2; exit 1; }

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# ── Args ──
for arg in "$@"; do
  case "$arg" in
    --help) usage ;;
    --force) FORCE=1 ;;
    --uninstall) ACTION="uninstall" ;;
    *) err "Flag desconocido: $arg (usa --help)" ;;
  esac
done

# ── sha256 portable (macOS trae shasum, no sha256sum) ──
sha256_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# ── Uninstall (borrado total) ──
do_uninstall() {
  info "Desinstalando Solaria (borrado total)..."
  stop_daemon
  rm -f "$INSTALL_DIR/solaria"
  rm -rf "$APP_DIR" "$HOME/.solaria"
  ok "Solaria desinstalado por completo (binario, repo y datos)"
}

# ── Instalación existente: versión instalada ("" si no hay) ──
# Se lee del fichero VERSION junto al binario, sin ejecutar nada.
installed_version() {
  local v=""
  if [ -f "$APP_DIR/VERSION" ]; then
    v="$(cat "$APP_DIR/VERSION" 2>/dev/null)"
  fi
  echo "$v" | sed 's/^solaria //;s/^v//' | head -1
}

# ── Parada de la app en ejecución (pkill + pid) ──
stop_daemon() {
  pkill -x "$BINARY_NAME" 2>/dev/null || true
  sleep 1
  rm -f "$HOME/.solaria/solaria.pid"
}

github_api() {
  curl -fsSL "$GITHUB_API/repos/$REPO/$1" \
    || err "no se pudo contactar la API de GitHub ($GITHUB_API) (revisa tu conexión)"
}

json_tag() {
  if command -v python3 &>/dev/null; then
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("tag_name",""))' "$1" 2>/dev/null \
      || grep -o '"tag_name": *"[^"]*"' "$1" | head -1 | cut -d'"' -f4
  else
    grep -o '"tag_name": *"[^"]*"' "$1" | head -1 | cut -d'"' -f4
  fi
}

asset_url() {
  local file="$1" pattern="$2"
  if command -v python3 &>/dev/null; then
    python3 -c 'import json,sys,re; d=json.load(open(sys.argv[1])); ms=[a.get("browser_download_url","") for a in d.get("assets",[]) if re.search(sys.argv[2], a.get("name",""))]; print(ms[0] if ms else "")' "$file" "$pattern" 2>/dev/null \
      || grep -o '"browser_download_url": *"[^"]*"' "$file" \
        | grep -o 'https\?://[^"]*' | grep -E "$pattern" | head -1 || true
  else
    grep -o '"browser_download_url": *"[^"]*"' "$file" \
      | grep -o 'https\?://[^"]*' | grep -E "$pattern" | head -1 || true
  fi
}

resolve_tag() {
  local ver="$SOLARIA_VERSION" tmp
  if [ "$ver" = "latest" ]; then
    tmp="$(mktemp -d)/release.json"
    github_api "releases/latest" > "$tmp" \
      || err "no se pudo obtener el último release de $REPO"
    ver="$(json_tag "$tmp")"
    [ -n "$ver" ] || err "el repositorio aún no tiene releases publicados"
  fi
  case "$ver" in
    v*) echo "$ver" ;;
    *) echo "v$ver" ;;
  esac
}

verify_checksum() {
  local dir="$1" localfile="$2" asset="$3" sums_url="$4"
  if [ -z "$sums_url" ]; then
    warn "release sin SHA256SUMS.txt; omitiendo verificación"
    return 0
  fi
  curl -fsSL -o "$dir/SHA256SUMS.txt" "$sums_url" \
    || { warn "no se pudo descargar SHA256SUMS.txt; omitiendo verificación"; return 0; }
  local expected
  expected="$(awk -v a="$asset" '
    { h=$1; sub(/^[^ ]+[ ]+/, ""); g=$0; sub(/.*\//, "", g); gsub(/ /, ".", g); ga=a; gsub(/ /, ".", ga); if (g==ga) { print h; exit } }
  ' "$dir/SHA256SUMS.txt" | head -1)"
  [ -n "$expected" ] || { warn "sin entrada para $asset en SHA256SUMS.txt; omitiendo verificación"; return 0; }
  [ "$(sha256_file "$dir/$localfile")" = "$expected" ] \
    || err "checksum inválido para $asset (descarga corrupta o manipulada)"
  ok "checksum verificado: $asset"
}

download_install() {
  local tag="$1"
  info "Descargando Solaria $tag (precompilado darwin-aarch64)..."
  local tmpd json tarball_url sums_url base stage
  tmpd="$(mktemp -d)"
  json="$tmpd/release.json"
  github_api "releases/tags/$tag" > "$json" \
    || err "no existe el release $tag en $REPO"
  tarball_url="$(asset_url "$json" 'darwin-aarch64\.tar\.gz$')"
  sums_url="$(asset_url "$json" 'SHA256SUMS\.txt$')"
  [ -n "$tarball_url" ] || err "el release $tag no trae precompilado macOS arm64"

  base="solaria-${tag#v}-darwin-aarch64"
  info "Descargando $base.tar.gz..."
  curl -fsSL -o "$tmpd/pkg.tar.gz" "$tarball_url" \
    || err "falló la descarga del tarball"
  verify_checksum "$tmpd" "pkg.tar.gz" "$(basename "$tarball_url")" "$sums_url"
  tar -xzf "$tmpd/pkg.tar.gz" -C "$tmpd" \
    || err "no se pudo extraer el tarball"
  stage="$tmpd/$base"
  [ -x "$stage/solaria-agent" ] \
    || err "el tarball no contiene el binario esperado ($base/solaria-agent)"
  WRAPPER_SRC="$stage/solaria"

  stop_daemon
  mkdir -p "$APP_DIR" "$INSTALL_DIR"
  cp "$stage/solaria-agent" "$APP_DIR/$BINARY_NAME"
  chmod +x "$APP_DIR/$BINARY_NAME"
  echo "${tag#v}" > "$APP_DIR/VERSION"
  ok "Binario instalado en $APP_DIR/$BINARY_NAME"

  [ -f "$WRAPPER_SRC" ] || err "no se encontró el wrapper en $WRAPPER_SRC"
  if [ -L "$INSTALL_DIR/solaria" ]; then
    rm -f "$INSTALL_DIR/solaria"
  fi
  cp "$WRAPPER_SRC" "$INSTALL_DIR/solaria"
  chmod +x "$INSTALL_DIR/solaria"
  ok "Lanzador instalado en $INSTALL_DIR/solaria"
  rm -rf "$tmpd"
}

# ── PATH (.zshrc por defecto en macOS) ──
ensure_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    return
  fi
  local shell_rc="$HOME/.zshrc"
  case "${SHELL:-}" in
    */bash) shell_rc="$HOME/.bash_profile" ;;
  esac
  touch "$shell_rc"
  if ! grep -qx "export PATH=\"\$PATH:$INSTALL_DIR\"" "$shell_rc" 2>/dev/null; then
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$shell_rc"
  fi
  info "Añadido $INSTALL_DIR al PATH en $shell_rc"
  info "Recarga tu shell: source $shell_rc"
  export PATH="$PATH:$INSTALL_DIR"
}

# ── Verificación post-instalación (por ficheros; la app es GUI) ──
verify_install() {
  info "Verificando instalación..."
  [ -x "$INSTALL_DIR/solaria" ] \
    || err "falta el lanzador en $INSTALL_DIR/solaria"
  [ -x "$APP_DIR/$BINARY_NAME" ] \
    || err "falta el binario en $APP_DIR/$BINARY_NAME"
  local ver
  ver="$(installed_version)"
  [ -n "$ver" ] || ver="(versión desconocida)"
  ok "solaria $ver listo ($APP_DIR/$BINARY_NAME)"
}

# ── Resumen ──
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  Solaria instalado correctamente${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo ""
  echo "  Abrir app:   solaria          (primer arranque GUI: clic derecho → Abrir)"
  echo "  Guardar key: en la app, Configuración → Proveedores"
  echo ""
  echo "  Actualizar:   en la app, Configuración → Aplicación"
  echo "  Desinstalar:  en la app, Configuración → Aplicación → Desinstalar"
  echo ""
}

# ── Main ──
main() {
  if [ "${ACTION:-install}" = "uninstall" ]; then
    do_uninstall
    exit 0
  fi

  echo ""
  echo -e "${CYAN}  Solaria Agent — Instalación (macOS)${NC}"
  echo ""

  case "$(uname -s)" in
    Darwin) ;;
    *) err "Este instalador es solo para macOS (detectado: $(uname -s))" ;;
  esac
  case "$(uname -m)" in
    arm64) ;;
    *) err "Solo Apple Silicon (arm64) soportado (detectado: $(uname -m))" ;;
  esac
  info "Detectado: macOS (arm64)"

  local tag installed
  tag="$(resolve_tag)"
  installed="$(installed_version)"
  if [ -n "$installed" ] && [ "$installed" = "${tag#v}" ] && [ "$FORCE" != "1" ]; then
    ok "Solaria $installed ya está instalado y al día (usa --force para reinstalar)"
    exit 0
  fi
  if [ -n "$installed" ]; then
    info "Actualizando $installed → ${tag#v}..."
  fi
  download_install "$tag"
  ensure_path
  verify_install
  print_summary
}

main "$@"
