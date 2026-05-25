#!/usr/bin/env bash
set -euo pipefail

REPO="Angelcmp/solaria"
BRANCH="main"
BINARY_NAME="solaria-agent"
INSTALL_DIR="${SOLARIA_INSTALL_DIR:-$HOME/.local/bin}"
APP_DIR="$HOME/.local/share/solaria"
DESKTOP_DIR="$HOME/.local/share/applications"

# ── Colors ──
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}::${NC} $1"; }
ok()    { echo -e "${GREEN}ok${NC}  $1"; }
err()   { echo -e "${RED}error${NC} $1"; exit 1; }

# ── Detect OS / arch ──
detect_platform() {
  case "$(uname -s)" in
    Linux)  OS="linux" ;;
    Darwin) OS="macos" ;;
    *)      err "Sistema no soportado: $(uname -s). Solo Linux y macOS." ;;
  esac
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|aarch64|arm64) ;;
    *) err "Arquitectura no soportada: $ARCH" ;;
  esac
  [ "$ARCH" = "arm64" ] && ARCH="aarch64"
  info "Detectado: $OS ($ARCH)"
}

# ── Check / install prerequisites ──
ensure_rust() {
  if command -v rustc &>/dev/null; then
    ok "Rust $(rustc --version | cut -d' ' -f2)"
  else
    info "Instalando Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
    ok "Rust instalado"
  fi
}

ensure_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_VER" -ge 18 ]; then
      ok "Node $(node --version)"
      return
    fi
  fi
  info "Instalando Node.js via fnm..."
  if ! command -v fnm &>/dev/null; then
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
  fi
  fnm install 22
  fnm use 22
  ok "Node $(node --version) instalado"
}

install_system_deps() {
  if [ "$OS" != "linux" ]; then
    return
  fi
  if ! command -v pkg-config &>/dev/null; then
    info "Instalando dependencias del sistema..."
    if command -v apt &>/dev/null; then
      sudo apt update -qq
      sudo apt install -y -qq \
        libwebkit2gtk-4.1-dev libgtk-3-dev \
        libayatana-appindicator3-dev librsvg2-dev patchelf
    elif command -v dnf &>/dev/null; then
      sudo dnf install -y webkit2gtk4.1-devel gtk3-devel \
        libappindicator-gtk3-devel librsvg2-devel patchelf
    elif command -v pacman &>/dev/null; then
      sudo pacman -S --noconfirm webkit2gtk-4.1 gtk3 \
        libappindicator-gtk3 librsvg patchelf
    else
      warn "No se pudo instalar dependencias automáticamente. Consulta README.md"
    fi
    ok "Dependencias del sistema instaladas"
  else
    ok "pkg-config disponible"
  fi
}

# ── Clone or download ──
clone_repo() {
  if [ -d "$APP_DIR/src" ]; then
    info "Actualizando repositorio existente..."
    cd "$APP_DIR"
    git pull --ff-only
    cd -
  else
    info "Clonando repositorio..."
    git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$APP_DIR"
  fi
  ok "Repositorio listo en $APP_DIR"
}

# ── Build ──
build_project() {
  info "Instalando dependencias npm..."
  cd "$APP_DIR"
  npm install
  ok "Dependencias npm instaladas"

  info "Compilando Solaria Agent (tauri build)... esto puede tomar varios minutos"
  npm run tauri build
  ok "Build completado"
}

# ── Install binary ──
install_binary() {
  mkdir -p "$INSTALL_DIR"

  BINARY_PATH=$(find "$APP_DIR/src-tauri/target/release" -maxdepth 1 -type f -executable -name "$BINARY_NAME" 2>/dev/null | head -1)

  if [ -z "$BINARY_PATH" ]; then
    BINARY_PATH=$(find "$APP_DIR/src-tauri/target/release" -maxdepth 1 -type f -executable ! -name "*.d" ! -name "*.so" ! -name "*.rlib" 2>/dev/null | head -1)
  fi

  if [ -z "$BINARY_PATH" ]; then
    err "No se encontró el binario compilado en src-tauri/target/release/"
  fi

  cp "$BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"
  chmod +x "$INSTALL_DIR/$BINARY_NAME"
  ok "Binario instalado en $INSTALL_DIR/$BINARY_NAME"
}

# ── Desktop entry (Linux) ──
install_desktop_entry() {
  [ "$OS" != "linux" ] && return
  mkdir -p "$DESKTOP_DIR"

  # Find icon
  local icon_src="$APP_DIR/src-tauri/icons/128x128.png"
  local icon_dst="$HOME/.local/share/icons/solaria.png"
  if [ -f "$icon_src" ]; then
    mkdir -p "$(dirname "$icon_dst")"
    cp "$icon_src" "$icon_dst"
  fi

  cat > "$DESKTOP_DIR/solaria.desktop" << EOF
[Desktop Entry]
Name=Solaria
Comment=Tu asistente de IA, local y privado
Exec=$INSTALL_DIR/$BINARY_NAME
Icon=${icon_dst:-solaria}
Terminal=false
Type=Application
Categories=Utility;AI;
StartupNotify=true
EOF

  chmod +x "$DESKTOP_DIR/solaria.desktop"
  ok "Desktop entry creado"
}

# ── Ensure INSTALL_DIR is in PATH ──
ensure_path() {
  local shell_rc
  case "$SHELL" in
    */zsh) shell_rc="$HOME/.zshrc" ;;
    */bash) shell_rc="$HOME/.bashrc" ;;
    *) shell_rc="$HOME/.profile" ;;
  esac

  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$shell_rc"
    info "Añadido $INSTALL_DIR al PATH en $shell_rc"
    info "Recarga tu shell: source $shell_rc"
  fi
}

# ── Print summary ──
print_summary() {
  echo ""
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  Solaria instalado correctamente 🚀${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
  echo ""
  echo "  Ejecuta:  $INSTALL_DIR/$BINARY_NAME"
  echo "  Desde el menú de aplicaciones como Solaria"
  echo ""
  echo "  Para actualizar: curl -fsSL https://raw.githubusercontent.com/$REPO/$BRANCH/scripts/install.sh | bash"
  echo ""
}

# ── Main ──
main() {
  echo ""
  echo -e "${CYAN}  Solaria Agent — Instalación${NC}"
  echo ""

  detect_platform
  ensure_rust
  ensure_node
  install_system_deps
  clone_repo
  build_project
  install_binary
  install_desktop_entry
  ensure_path
  print_summary
}

main "$@"
