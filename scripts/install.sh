#!/usr/bin/env bash
# Compat: el instalador canónico ahora vive en la raíz del repo.
#   Nueva URL: https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh
# Este shim funciona clonado en local Y vía curl|bash (descarga el canónico).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [ -f "$HERE/../install.sh" ]; then
  exec bash "$HERE/../install.sh" "$@"
else
  exec bash -c 'curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- "$@"' _ "$@"
fi
