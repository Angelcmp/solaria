#!/usr/bin/env bash
# Benchmark del modo descarga de install.sh en 5 distros (podman + mock local).
# Uso:
#   scripts/bench/bench-install.sh setup        # stub + tarball + .deb + sums
#   scripts/bench/bench-install.sh server-start # mock API en :8000 (fondo)
#   scripts/bench/bench-install.sh run <id>     # ubuntu|debian|fedora|arch|tumbleweed
#   scripts/bench/bench-install.sh server-stop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${BENCH_WORK:-/tmp/solaria-bench}"
TAG="v9.9.9-bench"
VER="${TAG#v}"
BASE_URL="${BENCH_BASE_URL:-http://host.containers.internal:8000}"
MOCK_PORT="${BENCH_PORT:-8000}"

IMAGES_ubuntu="docker.io/library/ubuntu:24.04"
IMAGES_debian="docker.io/library/debian:12"
IMAGES_fedora="docker.io/library/fedora:41"
IMAGES_arch="docker.io/library/archlinux:latest"
IMAGES_tumbleweed="docker.io/opensuse/tumbleweed:latest"

image_of() {
  case "$1" in
    ubuntu|debian|fedora|arch|tumbleweed) eval "echo \$IMAGES_$1" ;;
    *) echo "distro desconocida: $1" >&2; exit 1 ;;
  esac
}

cmd_setup() {
  rm -rf "$WORK"; mkdir -p "$WORK/assets" "$WORK/logs"
  # Stub del binario: responde version/--help como el real para el verify.
  mkdir -p "$WORK/stub"
  cat > "$WORK/stub/solaria-agent" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  version|--version|-V) echo "solaria 9.9.9-bench" ;;
  -h|--help) echo "solaria (stub de benchmark)";;
  *) exit 0 ;;
esac
EOF
  chmod +x "$WORK/stub/solaria-agent"
  # Stage del tarball: binario + wrapper real + icono real.
  local stage="$WORK/assets/solaria-${VER}-linux-x86_64"
  mkdir -p "$stage"
  cp "$WORK/stub/solaria-agent" "$stage/"
  cp "$ROOT/scripts/solaria" "$stage/solaria"
  cp "$ROOT/src-tauri/icons/128x128.png" "$stage/solaria.png"
  chmod +x "$stage/solaria-agent" "$stage/solaria"
  tar -czf "$WORK/assets/solaria-${VER}-linux-x86_64.tar.gz" -C "$WORK/assets" "solaria-${VER}-linux-x86_64"
  # .deb con Depends reales para que apt resuelva el stack webkit de verdad.
  local pkg="$WORK/debpkg"
  rm -rf "$pkg"; mkdir -p "$pkg/DEBIAN" "$pkg/usr/bin"
  cp "$WORK/stub/solaria-agent" "$pkg/usr/bin/"
  cat > "$pkg/DEBIAN/control" <<EOF
Package: solaria-agent
Version: ${VER}
Architecture: amd64
Maintainer: bench <bench@localhost>
Depends: libwebkit2gtk-4.1-0, libgtk-3-0, libssl3
Description: Solaria Agent (stub de benchmark)
 Binario sustituto para medir el instalador, no el build.
EOF
  podman run --rm -v "$WORK:/work:z" "${IMAGES_ubuntu}" \
    bash -c 'dpkg-deb --build /work/debpkg /work/assets/solaria-agent_'"${VER}"'_amd64.deb'
  ( cd "$WORK/assets" && sha256sum "solaria-${VER}-linux-x86_64.tar.gz" "solaria-agent_${VER}_amd64.deb" > SHA256SUMS.txt )
  cat "$WORK/assets/SHA256SUMS.txt"
  echo "setup OK en $WORK/assets"
}

cmd_server_start() {
  MOCK_TAG="$TAG" BASE_URL="$BASE_URL" ASSET_DIR="$WORK/assets" MOCK_PORT="$MOCK_PORT" \
    nohup python3 "$ROOT/scripts/bench/mock_server.py" > "$WORK/logs/mock-server.log" 2>&1 &
  echo $! > "$WORK/mock-server.pid"
  for _ in $(seq 1 20); do
    curl -fsSL "http://127.0.0.1:${MOCK_PORT}/repos/bench/solaria/releases/tags/${TAG}" >/dev/null 2>&1 && break
    sleep 0.5
  done
  curl -fsSL "http://127.0.0.1:${MOCK_PORT}/repos/bench/solaria/releases/tags/${TAG}"
  echo; echo "mock server OK (pid $(cat "$WORK/mock-server.pid"))"
}

cmd_server_stop() {
  kill "$(cat "$WORK/mock-server.pid")" 2>/dev/null || true
  rm -f "$WORK/mock-server.pid"
  echo "mock server detenido"
}

# Prerrequisitos del arnés (no medidos): curl, CA, tar.
prologue() {
  case "$1" in
    ubuntu|debian)
      echo 'apt-get update -qq && apt-get install -y -qq curl ca-certificates tar gzip' ;;
    fedora)
      echo 'dnf install -y -q curl ca-certificates tar gzip' ;;
    arch)
      echo 'pacman -Sy --noconfirm --needed curl ca-certificates tar gzip' ;;
    tumbleweed)
      echo 'zypper --non-interactive refresh && zypper --non-interactive install -y curl ca-certificates tar gzip' ;;
  esac
}

cmd_run() {
  local id="$1" img log t0 t1
  img="$(image_of "$id")"
  log="$WORK/logs/${id}.log"
  : > "$log"
  echo "=== [$id] $img ===" | tee -a "$log"
  podman run --rm -v "$ROOT/install.sh:/bench/install.sh:ro,z" "$img" \
    bash -c "$(prologue "$id")" >> "$log" 2>&1 \
    || { echo "[$id] falló el prólogo" | tee -a "$log"; return 1; }
  t0="$(date +%s)"
  podman run --rm -v "$ROOT/install.sh:/bench/install.sh:ro,z" "$img" \
    bash -c 'export GITHUB_API="'"$BASE_URL"'" REPO="bench/solaria" SOLARIA_VERSION="'"$TAG"'" SOLARIA_TIMING=1; bash /bench/install.sh' >> "$log" 2>&1
  local rc=$?
  t1="$(date +%s)"
  echo "BENCH-TIME etapa=pared_total fase_s=$((t1 - t0)) total_s=$((t1 - t0))" >> "$log"
  echo "[$id] rc=$rc pared=$((t1 - t0))s log=$log" | tee -a "$log"
  return $rc
}

case "${1:-}" in
  setup) cmd_setup ;;
  server-start) cmd_server_start ;;
  server-stop) cmd_server_stop ;;
  run) cmd_run "${2:?falta distro: ubuntu|debian|fedora|arch|tumbleweed}" ;;
  *) echo "uso: $0 {setup|server-start|server-stop|run <distro>}" >&2; exit 1 ;;
esac
