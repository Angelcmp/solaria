#!/usr/bin/env bash
#
# Solaria Agent — Instalador para Linux
#
#   Instalación rápida (recomendado):
#     curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash
#
#   Opciones (flags o variables de entorno):
#     --debug-build | SOLARIA_DEBUG_BUILD=1   Build debug (más rápido, ~5-10 min)
#     --skip-build  | SOLARIA_SKIP_BUILD=1    Omitir compilación (usa binario existente)
#     --skip-clone  | SOLARIA_SKIP_CLONE=1    Omitir clonado (usa checkout existente en APP_DIR)
#     --clean       | SOLARIA_CLEAN=1         Borra ~/.local/share/solaria si no es repo git
#     --uninstall                             Desinstala Solaria del sistema
#     --help                                  Muestra esta ayuda
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
    --debug-build) DEBUG_BUILD=1 ;;
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

# ── Uninstall ──
do_uninstall() {
  info "Desinstalando Solaria..."
  pkill -x "$BINARY_NAME" 2>/dev/null || true
  rm -f "$INSTALL_DIR/solaria" "$DESKTOP_DIR/solaria.desktop" \
        "$HOME/.solaria/solaria.pid"
  if [ -d "$LIB_DIR_DEFAULT" ]; then
    run_privileged rm -rf "$LIB_DIR_DEFAULT" \
      || warn "no se pudo borrar $LIB_DIR_DEFAULT (prueba con sudo)"
  fi
  info "Repo y datos conservados en: $APP_DIR y ~/.solaria"
  info "Para borrado total: rm -rf \"$APP_DIR\" ~/.solaria"
  ok "Solaria desinstalado"
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
if command -v free &>/dev/null; then
  MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
  [ "$MEM_GB" -lt 4 ] && warn "RAM ${MEM_GB}GB < 4GB recomendados; el build puede fallar o usar swap"
fi
FREE_KB=$(df -k "$HOME" | awk 'NR==2{print $4}')
[ "$FREE_KB" -lt 8388608 ] && warn "disco libre < 8GB; el build necesita ~6-10GB en ~/.local/share + target/"
[ "$(nproc)" -lt 2 ] && warn "solo $(nproc) CPU; la compilación tardará bastante"

# ── Comandos base: git + curl ──
need_cmd() {
  command -v "$1" &>/dev/null && return 0
  info "'$1' no encontrado, intentando instalar..."
  if command -v apt-get &>/dev/null; then
    run_privileged apt-get update -qq && run_privileged apt-get install -y -qq "$2"
  elif command -v dnf &>/dev/null; then
    run_privileged dnf install -y "$2"
  elif command -v pacman &>/dev/null; then
    run_privileged pacman -S --noconfirm "$2"
  elif command -v zypper &>/dev/null; then
    run_privileged zypper install -y "$2"
  else
    err "instala '$1' manualmente y re-ejecuta el instalador"
  fi
  command -v "$1" &>/dev/null || err "no se pudo instalar '$1'"
}
need_cmd git git
need_cmd curl curl

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
      build-essential pkg-config curl wget file xdg-utils \
      libssl-dev libsecret-1-dev \
      libwebkit2gtk-4.1-dev libgtk-3-dev \
      libayatana-appindicator3-dev librsvg2-dev patchelf \
    || err "falló apt. Revisa tu conexión e inténtalo de nuevo"
  elif command -v dnf &>/dev/null; then
    run_privileged dnf install -y \
      gcc gcc-c++ make pkg-config curl wget file xdg-utils \
      openssl-devel libsecret-devel \
      webkit2gtk4.1-devel gtk3-devel \
      libappindicator-gtk3-devel librsvg2-devel patchelf \
    || err "falló dnf"
  elif command -v pacman &>/dev/null; then
    run_privileged pacman -S --noconfirm \
      base-devel pkg-config curl wget file xdg-utils \
      openssl libsecret \
      webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg patchelf \
    || err "falló pacman"
  elif command -v zypper &>/dev/null; then
    run_privileged zypper install -y \
      gcc gcc-c++ make pkg-config curl wget file xdg-utils \
      libopenssl-devel libsecret-devel \
      webkit2gtk3-devel gtk3-devel \
      libappindicator-gtk3-devel librsvg-devel patchelf \
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

# ── Install binary + wrapper ──
install_binary() {
  local profile="release"
  [ "$DEBUG_BUILD" = "1" ] && profile="debug"

  BINARY_PATH="$APP_DIR/src-tauri/target/$profile/$BINARY_NAME"
  if [ ! -x "$BINARY_PATH" ]; then
    # Fallback: busca cualquier binario ejecutable del perfil
    BINARY_PATH=$(find "$APP_DIR/src-tauri/target/$profile" -maxdepth 1 -type f \
      -executable -name "$BINARY_NAME" 2>/dev/null | head -1)
  fi
  [ -n "${BINARY_PATH:-}" ] && [ -x "$BINARY_PATH" ] \
    || err "no se encontró el binario en src-tauri/target/$profile/ (¿falló el build?)"

  # Cierra instancias en ejecución (si no, `cp` falla con "text busy").
  # -x = match exacto: no mata a esta shell ni al wrapper.
  pkill -x "$BINARY_NAME" 2>/dev/null || true
  sleep 1

  mkdir -p "$INSTALL_DIR"

  # Destino preferido: /usr/local (requiere sudo una vez); si no, local.
  local dest_dir="$LIB_DIR"
  if [ "$dest_dir" = "$LIB_DIR_DEFAULT" ]; then
    if mkdir -p "$dest_dir" 2>/dev/null && [ -w "$dest_dir" ]; then
      cp "$BINARY_PATH" "$dest_dir/$BINARY_NAME"
    elif run_privileged mkdir -p "$dest_dir" \
      && run_privileged cp "$BINARY_PATH" "$dest_dir/$BINARY_NAME" \
      && run_privileged chmod +x "$dest_dir/$BINARY_NAME"; then
      info "binario instalado en sistema (con sudo)"
    else
      dest_dir="$APP_DIR"
      warn "sin acceso a /usr/local; instalando en modo usuario ($dest_dir)"
      cp "$BINARY_PATH" "$dest_dir/$BINARY_NAME"
    fi
  else
    mkdir -p "$dest_dir"
    cp "$BINARY_PATH" "$dest_dir/$BINARY_NAME"
  fi
  chmod +x "$dest_dir/$BINARY_NAME" 2>/dev/null || true

  # Reemplaza el symlink legacy (si existe) por el wrapper real
  if [ -L "$INSTALL_DIR/solaria" ]; then
    rm -f "$INSTALL_DIR/solaria"
  fi
  cp "$APP_DIR/scripts/solaria" "$INSTALL_DIR/solaria"
  chmod +x "$INSTALL_DIR/solaria"

  ok "Binario instalado en $dest_dir/$BINARY_NAME"
  ok "Wrapper CLI instalado en $INSTALL_DIR/solaria"
}

# ── Desktop entry (Linux) ──
install_desktop_entry() {
  mkdir -p "$DESKTOP_DIR"
  local icon_src="$APP_DIR/src-tauri/icons/128x128.png"
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

# ── Verificación post-instalación ──
verify_install() {
  info "Verificando instalación..."
  "$INSTALL_DIR/solaria" version >/dev/null 2>&1 \
    || err "el comando solaria no responde. Revisa que $INSTALL_DIR esté en tu PATH"
  "$INSTALL_DIR/solaria" --help >/dev/null 2>&1 \
    || err "'solaria --help' falló"
  ok "solaria $($INSTALL_DIR/solaria version) responde correctamente"
}

# ── Resumen ──
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  Solaria instalado correctamente${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo ""
  echo "  Abrir app:   solaria"
  echo "  Guardar key: solaria set-key openai sk-..."
  echo "  Chat:        solaria ask \"tu pregunta\""
  echo "  Agente:      solaria agent \"tu tarea\""
  echo "  Menú apps:   busca Solaria"
  echo ""
  echo "  Actualizar:   curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/install.sh | bash"
  echo "  Desinstalar:  curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/install.sh | bash -s -- --uninstall"
  echo ""
}

# ── Main ──
main() {
  echo ""
  echo -e "${CYAN}  Solaria Agent — Instalación (Linux)${NC}"
  echo ""

  install_system_deps
  ensure_rust
  ensure_node
  clone_repo
  build_project
  install_binary
  install_desktop_entry
  ensure_path
  verify_install
  print_summary
}

main "$@"
