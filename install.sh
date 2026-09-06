#!/usr/bin/env bash
#
# Solaria Agent — Instalador para Linux
#
#   Instalación rápida (recomendado, ~2-4 min, precompilado x86_64/aarch64):
#     curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash
#
#   Compilar desde fuente (todas las arch, 15-30 min):
#     curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --from-source
#
#   Opciones (flags o variables de entorno):
#     --from-source   | SOLARIA_FROM_SOURCE=1   Compilar desde fuente en vez de descargar precompilado
#     --force         | SOLARIA_FORCE=1         Reinstalar aunque la versión instalada esté al día
#     --debug-build   | SOLARIA_DEBUG_BUILD=1   Build debug desde fuente (más rápido, ~5-10 min)
#     --skip-build    | SOLARIA_SKIP_BUILD=1    (fuente) Omitir compilación (usa binario existente)
#     --skip-clone    | SOLARIA_SKIP_CLONE=1    (fuente) Omitir clonado (usa checkout existente en APP_DIR)
#     --clean         | SOLARIA_CLEAN=1         Borra ~/.local/share/solaria si no es repo git
#     --uninstall                             Desinstala TODO: binarios, paquete .deb,
#                                             repo, datos (~/.solaria) y entrada de menú
#     --help                                    Muestra esta ayuda
#
#   Versión a instalar (modo descarga):
#     SOLARIA_VERSION=latest (default) | v0.9.1 | 0.9.1
#   Si la versión instalada ya coincide con la solicitada, no hace nada
#   (usa --force para reinstalar). Actualizar = re-ejecutar el instalador.
#
#   Variables extra:
#     SOLARIA_INSTALL_DIR   Dónde va el wrapper `solaria` (default: ~/.local/bin)
#     SOLARIA_LIB_DIR       Dónde va el binario real (default: /usr/local/lib/solaria)
#     SOLARIA_APP_DIR       Dónde se clona el repo (default: ~/.local/share/solaria)
#     BRANCH                Rama a instalar (default: main)
#
#   Soporta: Ubuntu/Debian (apt), Fedora/RHEL (dnf), Arch (pacman), openSUSE (zypper).
#   macOS y Windows: próximamente (ver README.md).
#
set -euo pipefail

REPO="${REPO:-Angelcmp/solaria}"
GITHUB_API="${GITHUB_API:-https://api.github.com}"
BRANCH="${BRANCH:-main}"
BINARY_NAME="solaria-agent"
INSTALL_DIR="${SOLARIA_INSTALL_DIR:-$HOME/.local/bin}"
LIB_DIR_DEFAULT="/usr/local/lib/solaria"
LIB_DIR="${SOLARIA_LIB_DIR:-$LIB_DIR_DEFAULT}"
APP_DIR="${SOLARIA_APP_DIR:-$HOME/.local/share/solaria}"
DESKTOP_DIR="$HOME/.local/share/applications"

DEBUG_BUILD="${SOLARIA_DEBUG_BUILD:-0}"
SKIP_BUILD="${SOLARIA_SKIP_BUILD:-0}"
SKIP_CLONE="${SOLARIA_SKIP_CLONE:-0}"
CLEAN="${SOLARIA_CLEAN:-0}"
FROM_SOURCE="${SOLARIA_FROM_SOURCE:-0}"
FORCE="${SOLARIA_FORCE:-0}"
SOLARIA_VERSION="${SOLARIA_VERSION:-latest}"
# Orígenes del wrapper e icono (el modo descarga los sobreescribe
# con los extraídos del tarball; el modo fuente usa el checkout).
WRAPPER_SRC="${WRAPPER_SRC:-$APP_DIR/scripts/solaria}"
ICON_SRC="${ICON_SRC:-$APP_DIR/src-tauri/icons/128x128.png}"

# ── Colors & log ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}::${NC} $1"; }
ok()   { echo -e "${GREEN}ok${NC}  $1"; }
warn() { echo -e "${YELLOW}aviso${NC} $1"; }
err()  { echo -e "${RED}error${NC} $1" >&2; exit 1; }

# ── Timing (SOLARIA_TIMING=1): marcas BENCH-TIME por etapa ──
T_START="$(date +%s)"; T_LAST="$T_START"
tmark() {
  [ "${SOLARIA_TIMING:-0}" = "1" ] || return 0
  local now elapsed total
  now="$(date +%s)"; elapsed=$((now - T_LAST)); total=$((now - T_START)); T_LAST="$now"
  echo "BENCH-TIME etapa=$1 fase_s=$elapsed total_s=$total"
}

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# ── Args ──
for arg in "$@"; do
  case "$arg" in
    --help) usage ;;
    --debug-build) DEBUG_BUILD=1 ;;
    --from-source) FROM_SOURCE=1 ;;
    --force) FORCE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --skip-clone) SKIP_CLONE=1 ;;
    --clean) CLEAN=1 ;;
    --uninstall) ACTION="uninstall" ;;
    *) err "Flag desconocido: $arg (usa --help)" ;;
  esac
done

# ── Sudo helper (no interactivo si no hay TTY) ──
run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo &>/dev/null; then
    sudo -n "$@" 2>/dev/null || sudo "$@"
  else
    return 1
  fi
}

# ── Uninstall (borrado total) ──
do_uninstall() {
  info "Desinstalando Solaria (borrado total)..."
  stop_daemon
  # Paquete .deb registrado: darlo de baja para no dejar la entrada huérfana.
  if command -v dpkg &>/dev/null && dpkg -s "$BINARY_NAME" >/dev/null 2>&1; then
    run_privileged dpkg --remove "$BINARY_NAME" \
      || warn "no se pudo purgar el paquete .deb (prueba con sudo)"
  fi
  # Binario suelto en /usr/bin (instalación manual o restos de otros modos).
  if [ -f "/usr/bin/$BINARY_NAME" ]; then
    if [ -w "/usr/bin/$BINARY_NAME" ]; then
      rm -f "/usr/bin/$BINARY_NAME"
    else
      run_privileged rm -f "/usr/bin/$BINARY_NAME" \
        || warn "no se pudo borrar /usr/bin/$BINARY_NAME (prueba con sudo)"
    fi
  fi
  rm -f "$INSTALL_DIR/solaria" "$DESKTOP_DIR/solaria.desktop" \
        "$HOME/.local/share/icons/solaria.png"
  if [ -d "$LIB_DIR_DEFAULT" ]; then
    run_privileged rm -rf "$LIB_DIR_DEFAULT" \
      || warn "no se pudo borrar $LIB_DIR_DEFAULT (prueba con sudo)"
  fi
  # Repo clonado (+ binario en modo usuario) y todos los datos locales.
  rm -rf "$APP_DIR" "$HOME/.solaria"
  ok "Solaria desinstalado por completo (binarios, repo y datos)"
}

# ── Instalación existente: versión instalada ("" si no hay) ──
# Se lee del fichero VERSION junto al binario (o del paquete .deb),
# sin ejecutar nada: la app es GUI y no expone CLI.
installed_version() {
  local v=""
  if command -v dpkg &>/dev/null && dpkg -s "$BINARY_NAME" >/dev/null 2>&1; then
    v="$(dpkg-query -W -f='${Version}' "$BINARY_NAME" 2>/dev/null)"
  fi
  if [ -z "$v" ] && [ -f "$LIB_DIR_DEFAULT/VERSION" ]; then
    v="$(cat "$LIB_DIR_DEFAULT/VERSION" 2>/dev/null)"
  fi
  if [ -z "$v" ] && [ -f "$APP_DIR/VERSION" ]; then
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

if [ "${ACTION:-install}" = "uninstall" ]; then
  do_uninstall
  exit 0
fi

# ── Preflight: solo Linux ──
case "$(uname -s)" in
  Linux) ;;
  Darwin) err "macOS aún no soportado por este instalador. Usa: git clone + npm install + npm run tauri dev" ;;
  *) err "Sistema no soportado: $(uname -s). Solo Linux por ahora." ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ;;
  aarch64|arm64) ARCH="aarch64" ;;
  *) err "Arquitectura no soportada: $ARCH (solo x86_64 y aarch64)" ;;
esac
info "Detectado: Linux ($ARCH)"

# RAM y disco mínimos (el build release es pesado)
if command -v free &>/dev/null && command -v awk &>/dev/null; then
  MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
  [ "$MEM_GB" -lt 4 ] && warn "RAM ${MEM_GB}GB < 4GB recomendados; el build puede fallar o usar swap"
fi
if command -v df &>/dev/null && command -v awk &>/dev/null; then
  FREE_KB=$(df -k "$HOME" | awk 'NR==2{print $4}')
  [ "$FREE_KB" -lt 8388608 ] && warn "disco libre < 8GB; el build necesita ~6-10GB en ~/.local/share + target/"
fi
if command -v nproc &>/dev/null; then
  [ "$(nproc)" -lt 2 ] && warn "solo $(nproc) CPU; la compilación tardará bastante"
fi

# ── Comandos base: git + curl ──
need_cmd() {
  command -v "$1" &>/dev/null && return 0
  info "'$1' no encontrado, intentando instalar..."
  if command -v apt-get &>/dev/null; then
    run_privileged apt-get update -qq && run_privileged apt-get install -y -qq "$2"
  elif command -v dnf &>/dev/null; then
    run_privileged dnf install -y "$2"
  elif command -v pacman &>/dev/null; then
    run_privileged pacman -Sy --noconfirm "$2"
  elif command -v zypper &>/dev/null; then
    run_privileged zypper install -y "$2"
  else
    err "instala '$1' manualmente y re-ejecuta el instalador"
  fi
  command -v "$1" &>/dev/null || err "no se pudo instalar '$1'"
}
need_cmd curl curl
need_cmd awk gawk
if [ "$FROM_SOURCE" = "1" ]; then
  need_cmd git git
fi

# ── Dependencias del sistema (compilador, webkit, ssl, utilidades) ──
install_system_deps() {
  if command -v pkg-config &>/dev/null && pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    ok "dependencias del sistema presentes (webkit2gtk-4.1)"
    return
  fi
  info "Instalando dependencias del sistema (puede pedir sudo)..."
  if command -v apt-get &>/dev/null; then
    run_privileged apt-get update -qq
    run_privileged apt-get install -y -qq \
      build-essential pkg-config curl wget file xdg-utils unzip \
      libssl-dev libsecret-1-dev \
      libwebkit2gtk-4.1-dev libgtk-3-dev \
      libayatana-appindicator3-dev librsvg2-dev patchelf \
    || err "falló apt. Revisa tu conexión e inténtalo de nuevo"
  elif command -v dnf &>/dev/null; then
    run_privileged dnf install -y \
      gcc gcc-c++ make pkg-config curl wget file xdg-utils unzip \
      openssl-devel libsecret-devel \
      webkit2gtk4.1-devel gtk3-devel \
      libappindicator-gtk3-devel librsvg2-devel patchelf \
    || err "falló dnf"
  elif command -v pacman &>/dev/null; then
    run_privileged pacman -Sy --noconfirm \
      base-devel pkg-config curl wget file xdg-utils unzip \
      openssl libsecret \
      webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg patchelf \
    || err "falló pacman"
  elif command -v zypper &>/dev/null; then
    run_privileged zypper --non-interactive refresh || true
    run_privileged zypper install -y \
      gcc gcc-c++ make pkg-config curl wget file xdg-utils unzip \
      libopenssl-devel libsecret-devel \
      webkitgtk3-devel gtk3-devel \
      libappindicator3-devel librsvg-devel patchelf \
    || err "falló zypper"
  else
    err "gestor de paquetes no reconocido. Instala manualmente: Rust, Node 18+, webkit2gtk, gtk3, openssl, patchelf (ver README.md)"
  fi
  ok "dependencias del sistema instaladas"
}

# ── Rust ──
ensure_rust() {
  if command -v rustc &>/dev/null; then
    ok "Rust $(rustc --version | cut -d' ' -f2)"
  else
    info "Instalando Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path \
      || err "falló la instalación de Rust"
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
    ok "Rust $(rustc --version | cut -d' ' -f2) instalado"
  fi
  export PATH="$HOME/.cargo/bin:$PATH"
  rustc --version &>/dev/null || err "rustc no quedó en el PATH"
}

# ── Node 18+ ──
ensure_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_VER" -ge 18 ]; then
      ok "Node $(node --version)"
      return
    fi
    warn "Node $(node --version) < 18, instalando Node 22 via fnm..."
  else
    info "Instalando Node.js via fnm..."
  fi
  if ! command -v fnm &>/dev/null; then
    curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell \
      || err "falló la instalación de fnm"
    export PATH="$HOME/.local/share/fnm:$PATH"
  fi
  eval "$(fnm env --shell bash)"
  fnm install 22 && fnm use 22 && fnm default 22 \
    || err "falló la instalación de Node 22"
  ok "Node $(node --version) instalado"
}

# ── Repo ──
clone_repo() {
  if [ "$SKIP_CLONE" = "1" ]; then
    warn "omitido clonado (--skip-clone), usando $APP_DIR"
    [ -f "$APP_DIR/scripts/solaria" ] \
      || err "$APP_DIR no parece un checkout de Solaria"
    return
  fi
  if [ -d "$APP_DIR/.git" ]; then
    info "Actualizando repositorio existente..."
    git -C "$APP_DIR" fetch origin "$BRANCH" --depth 1 \
      || err "no se pudo actualizar $APP_DIR (sin conexión?)"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH" \
      || err "no se pudo actualizar $APP_DIR"
  elif [ -e "$APP_DIR" ]; then
    if [ "$CLEAN" = "1" ]; then
      warn "$APP_DIR existe y no es repo git; borrando (--clean)..."
      rm -rf "$APP_DIR"
      git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$APP_DIR" \
        || err "no se pudo clonar el repositorio"
    else
      err "$APP_DIR existe y no es un repo git. Muévelo o re-ejecuta con --clean"
    fi
  else
    info "Clonando repositorio..."
    git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$APP_DIR" \
      || err "no se pudo clonar https://github.com/$REPO.git (revisa tu conexión)"
  fi
  ok "Repositorio listo en $APP_DIR"
}

# ── Build ──
build_project() {
  if [ "$SKIP_BUILD" = "1" ]; then
    warn "omitida compilación (--skip-build)"
    return
  fi
  cd "$APP_DIR"
  info "Instalando dependencias npm..."
  npm install || err "falló npm install"
  ok "Dependencias npm instaladas"

  if [ "$DEBUG_BUILD" = "1" ]; then
    info "Compilando Solaria (tauri build --debug, ~5-10 min)..."
    npm run tauri build -- --debug || err "falló la compilación. Prueba con más RAM/disco o reporta el error"
  else
    info "Compilando Solaria (tauri build release, 15-30 min, una sola vez)..."
    npm run tauri build || err "falló la compilación. Prueba con --debug-build o reporta el error"
  fi
  ok "Build completado"
}

# ── Deploy: copia el binario al destino sistema o usuario ──
deploy_binary() {
  local src="$1"
  [ -x "$src" ] || err "binario no ejecutable: $src"

  # Cierra instancias en ejecución (stop ordenado + respaldo pkill + pid).
  stop_daemon

  # Destino preferido: /usr/local (requiere sudo una vez); si no, local.
  local dest_dir="$LIB_DIR"
  if [ "$dest_dir" = "$LIB_DIR_DEFAULT" ]; then
    if mkdir -p "$dest_dir" 2>/dev/null && [ -w "$dest_dir" ]; then
      cp "$src" "$dest_dir/$BINARY_NAME"
    elif run_privileged mkdir -p "$dest_dir" \
      && run_privileged cp "$src" "$dest_dir/$BINARY_NAME" \
      && run_privileged chmod +x "$dest_dir/$BINARY_NAME"; then
      info "binario instalado en sistema (con sudo)"
    else
      dest_dir="$APP_DIR"
      warn "sin acceso a /usr/local; instalando en modo usuario ($dest_dir)"
      mkdir -p "$dest_dir"
      cp "$src" "$dest_dir/$BINARY_NAME"
    fi
  else
    mkdir -p "$dest_dir"
    cp "$src" "$dest_dir/$BINARY_NAME"
  fi
  chmod +x "$dest_dir/$BINARY_NAME" 2>/dev/null || true
  if [ -n "${INSTALL_VERSION:-}" ]; then
    echo "$INSTALL_VERSION" > "$dest_dir/VERSION" 2>/dev/null \
      || run_privileged tee "$dest_dir/VERSION" >/dev/null <<< "$INSTALL_VERSION" 2>/dev/null \
      || true
  fi
  ok "Binario instalado en $dest_dir/$BINARY_NAME"
}

# ── Lanzador `solaria` en el PATH ──
install_wrapper() {
  mkdir -p "$INSTALL_DIR"
  [ -f "$WRAPPER_SRC" ] || err "no se encontró el wrapper en $WRAPPER_SRC"
  # Reemplaza el symlink legacy (si existe) por el wrapper real
  if [ -L "$INSTALL_DIR/solaria" ]; then
    rm -f "$INSTALL_DIR/solaria"
  fi
  cp "$WRAPPER_SRC" "$INSTALL_DIR/solaria"
  chmod +x "$INSTALL_DIR/solaria"
  ok "Lanzador instalado en $INSTALL_DIR/solaria"
}

# ── Install binary + wrapper (modo fuente: resuelve el build local) ──
install_binary() {
  local profile="release"
  [ "$DEBUG_BUILD" = "1" ] && profile="debug"

  INSTALL_VERSION="$(grep -m1 '^version' "$APP_DIR/src-tauri/Cargo.toml" 2>/dev/null | cut -d'"' -f2)"
  [ -n "${INSTALL_VERSION:-}" ] || INSTALL_VERSION="dev"

  BINARY_PATH="$APP_DIR/src-tauri/target/$profile/$BINARY_NAME"
  if [ ! -x "$BINARY_PATH" ]; then
    # Fallback: busca cualquier binario ejecutable del perfil
    BINARY_PATH=$(find "$APP_DIR/src-tauri/target/$profile" -maxdepth 1 -type f \
      -executable -name "$BINARY_NAME" 2>/dev/null | head -1)
  fi
  [ -n "${BINARY_PATH:-}" ] && [ -x "$BINARY_PATH" ] \
    || err "no se encontró el binario en src-tauri/target/$profile/ (¿falló el build?)"

  deploy_binary "$BINARY_PATH"
  install_wrapper
}

# ── Desktop entry (Linux) ──
install_desktop_entry() {
  mkdir -p "$DESKTOP_DIR"
  local icon_src="$ICON_SRC"
  local icon_dst="$HOME/.local/share/icons/solaria.png"
  if [ -f "$icon_src" ]; then
    mkdir -p "$(dirname "$icon_dst")"
    cp "$icon_src" "$icon_dst"
  else
    icon_dst="solaria"
  fi

  cat > "$DESKTOP_DIR/solaria.desktop" << EOF
[Desktop Entry]
Name=Solaria
Comment=Tu asistente de IA, local y privado
Exec=$INSTALL_DIR/solaria
Icon=$icon_dst
Terminal=false
Type=Application
Categories=Utility;AI;
StartupNotify=true
EOF
  chmod +x "$DESKTOP_DIR/solaria.desktop"
  ok "Entrada de menú creada (Solaria)"
}

# ── Modo descarga: precompilado desde GitHub Releases ──

github_api() {
  curl -fsSL "$GITHUB_API/repos/$REPO/$1" \
    || err "no se pudo contactar la API de GitHub ($GITHUB_API) (revisa tu conexión)"
}

# Extrae un campo simple de un JSON (python3 si existe, si no grep).
json_tag() {
  if command -v python3 &>/dev/null; then
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("tag_name",""))' "$1"
  else
    grep -o '"tag_name": *"[^"]*"' "$1" | head -1 | cut -d'"' -f4
  fi
}

# Primera browser_download_url cuyo nombre de asset matchee el patrón.
asset_url() {
  local file="$1" pattern="$2"
  if command -v python3 &>/dev/null; then
    python3 -c 'import json,sys,re; d=json.load(open(sys.argv[1])); ms=[a.get("browser_download_url","") for a in d.get("assets",[]) if re.search(sys.argv[2], a.get("name",""))]; print(ms[0] if ms else "")' "$file" "$pattern"
  else
    grep -o '"browser_download_url": *"[^"]*"' "$file" \
      | grep -o 'https\?://[^"]*' | grep -E "$pattern" | head -1 || true
  fi
}

# Resuelve el tag a instalar (SOLARIA_VERSION=latest|vX.Y.Z|X.Y.Z).
resolve_tag() {
  local ver="$SOLARIA_VERSION" tmp
  if [ "$ver" = "latest" ]; then
    tmp="$(mktemp)"
    github_api "releases/latest" > "$tmp" \
      || err "no se pudo obtener el último release de $REPO"
    ver="$(json_tag "$tmp")"
    rm -f "$tmp"
    [ -n "$ver" ] || err "el repositorio aún no tiene releases publicados; usa --from-source"
  fi
  case "$ver" in
    v*) echo "$ver" ;;
    *) echo "v$ver" ;;
  esac
}

# Verifica sha256 de un archivo local contra el SHA256SUMS.txt del release.
# (el nombre local puede diferir del nombre del asset: se busca por asset).
verify_checksum() {
  local dir="$1" localfile="$2" asset="$3" sums_url="$4"
  if [ -z "$sums_url" ]; then
    warn "release sin SHA256SUMS.txt; omitiendo verificación"
    return 0
  fi
  curl -fsSL -o "$dir/SHA256SUMS.txt" "$sums_url" \
    || { warn "no se pudo descargar SHA256SUMS.txt; omitiendo verificación"; return 0; }
  local expected
  # Match tolerante: compara normalizando espacios a puntos, porque el
  # nombre del asset puede diferir del nombre en disco ("a b.deb" vs "a.b.deb").
  expected="$(awk -v a="$asset" '
    { h=$1; sub(/^[^ ]+[ ]+/, ""); g=$0; sub(/.*\//, "", g); gsub(/ /, ".", g); ga=a; gsub(/ /, ".", ga); if (g==ga) { print h; exit } }
  ' "$dir/SHA256SUMS.txt" | head -1)"
  [ -n "$expected" ] || { warn "sin entrada para $asset en SHA256SUMS.txt; omitiendo verificación"; return 0; }
  echo "$expected  $localfile" | ( cd "$dir" && sha256sum -c - ) \
    || err "checksum inválido para $asset (descarga corrupta o manipulada)"
  ok "checksum verificado: $asset"
}

download_install() {
  local tag="$1"
  INSTALL_VERSION="${tag#v}"
  info "Descargando Solaria $tag (precompilado $ARCH)..."
  local tmpd json deb_url tarball_url sums_url base stage deb_suffix
  case "$ARCH" in
    x86_64) deb_suffix='_amd64\.deb$' ;;
    aarch64) deb_suffix='_arm64\.deb$' ;;
  esac
  tmpd="$(mktemp -d)"
  json="$tmpd/release.json"
  github_api "releases/tags/$tag" > "$json" \
    || err "no existe el release $tag en $REPO (¿aún no se publica? usa --from-source)"
  deb_url="$(asset_url "$json" "$deb_suffix")"
  tarball_url="$(asset_url "$json" "linux-${ARCH}\\.tar\\.gz\$")"
  sums_url="$(asset_url "$json" 'SHA256SUMS\.txt$')"
  [ -n "$tarball_url" ] || err "el release $tag no trae precompilado $ARCH; usa --from-source"

  # Tarball: trae binario + wrapper + icono (el wrapper y el .desktop
  # los gestiona este instalador; el .deb no los incluye).
  base="solaria-${tag#v}-linux-$ARCH"
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
  ICON_SRC="$stage/solaria.png"
  tmark "descarga+verify+extract"

  # Vía .deb en sistemas apt (registra el paquete y resuelve deps vía apt).
  if [ -n "$deb_url" ] && command -v apt-get &>/dev/null; then
    info "Instalando paquete .deb..."
    stop_daemon
    curl -fsSL -o "$tmpd/solaria.deb" "$deb_url" \
      || err "falló la descarga del .deb"
    verify_checksum "$tmpd" "solaria.deb" "$(basename "$deb_url")" "$sums_url"
    run_privileged dpkg -i "$tmpd/solaria.deb" 2>/dev/null || true
    run_privileged apt-get install -f -y -qq \
      || err "apt no pudo resolver las dependencias del .deb"
    ok "Paquete .deb instalado"
  else
    # Vía binaria universal: deps de ejecución + despliegue del binario.
    install_system_deps
    deploy_binary "$stage/solaria-agent"
  fi
  tmark "deps+deploy"

  install_wrapper
  install_desktop_entry
  rm -rf "$tmpd"
}

# ── PATH ──
ensure_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    return
  fi
  local shell_rc="$HOME/.profile"
  case "${SHELL:-}" in
    */zsh) shell_rc="$HOME/.zshrc" ;;
    */bash) shell_rc="$HOME/.bashrc" ;;
  esac
  echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$shell_rc"
  info "Añadido $INSTALL_DIR al PATH en $shell_rc"
  info "Recarga tu shell: source $shell_rc"
  export PATH="$PATH:$INSTALL_DIR"
}

# ── Resuelve el binario como el wrapper (sin ejecutarlo) ──
resolve_binary() {
  for candidate in \
    "$LIB_DIR_DEFAULT/$BINARY_NAME" \
    "$APP_DIR/$BINARY_NAME"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  if command -v "$BINARY_NAME" &>/dev/null; then
    command -v "$BINARY_NAME"
    return 0
  fi
  return 1
}

# ── Verificación post-instalación (por ficheros; la app es GUI) ──
verify_install() {
  info "Verificando instalación..."
  [ -x "$INSTALL_DIR/solaria" ] \
    || err "falta el lanzador en $INSTALL_DIR/solaria"
  local bin
  bin="$(resolve_binary)" \
    || err "no se encontró el binario $BINARY_NAME (ni sistema, ni usuario, ni PATH)"
  local ver
  ver="$(installed_version)"
  [ -n "$ver" ] || ver="(versión desconocida)"
  ok "solaria $ver listo ($bin)"
}

# ── Resumen ──
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  Solaria instalado correctamente${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo ""
  echo "  Abrir app:   solaria"
  echo "  Guardar key: en la app, Configuración → Proveedores"
  echo "  Menú apps:   busca Solaria"
  echo ""
  echo "  Actualizar:   en la app, Configuración → Aplicación"
  echo "                (o re-ejecuta este instalador; SOLARIA_VERSION=vX.Y.Z para fijar)"
  echo "  Desinstalar:  curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/install.sh | bash -s -- --uninstall"
  echo ""
}

# ── Main ──
main() {
  echo ""
  echo -e "${CYAN}  Solaria Agent — Instalación (Linux)${NC}"
  echo ""

  if [ "$FROM_SOURCE" = "1" ]; then
    info "Modo fuente: clonando y compilando (15-30 min)"
    tmark "inicio"
    install_system_deps
    ensure_rust
    ensure_node
    clone_repo
    build_project
    tmark "deps+clone+build"
    install_binary
    install_desktop_entry
  else
    info "Modo rápido: precompilado desde GitHub Releases (~2-4 min)"
    tmark "inicio"
    local tag installed
    tag="$(resolve_tag)"
    installed="$(installed_version)"
    if [ -n "$installed" ] && [ "$installed" = "${tag#v}" ] && [ "$FORCE" != "1" ]; then
      ok "Solaria $installed ya está instalado y al día (usa --force para reinstalar)"
      tmark "total"
      exit 0
    fi
    if [ -n "$installed" ]; then
      info "Actualizando $installed → ${tag#v}..."
    fi
    download_install "$tag"
    tmark "release_completo"
  fi
  ensure_path
  verify_install
  tmark "wrapper+desktop+verify"
  print_summary
  tmark "total"
}

main "$@"
