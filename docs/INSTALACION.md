# Instalar Solaria

> Versión actual: **v0.9.4** · Releases: <https://github.com/Angelcmp/solaria/releases>
>
> Este documento espeja la sección de instalación del `README.md` del
> repositorio. Si algo difiere, manda el `README.md`.

## Requisitos

- **Linux**: x86_64 o aarch64 (Ubuntu/Debian, Fedora/RHEL, Arch, openSUSE y derivadas).
- **macOS**: Apple Silicon (arm64). Intel no soportado.
- **Windows**: 10 o superior, x64.
- Conexión a internet. En Linux puede pedir sudo una vez (dependencias del sistema).

## Linux (~1-2 min)

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash
```

El instalador descarga el binario precompilado del último Release
(`.deb` con verificación sha256 en sistemas con `apt`; tarball verificado
en el resto), instala solo las dependencias de ejecución, y deja el comando
`solaria` listo más la entrada de menú. Si la versión instalada ya está al
día, no hace nada.

Tiempos reales medidos (instalación limpia):

| Distro | Vía | Tiempo |
|---|---|---|
| Ubuntu 24.04 | `.deb` | ~60s |
| Arch | tarball | ~70s |
| Fedora 41 | tarball | ~75-106s |
| Debian 12 | `.deb` | ~85s |
| openSUSE TW | tarball | ~111s |

## macOS Apple Silicon (~2-4 min)

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install-macos.sh | bash
```

Instala el binario (`darwin-aarch64`, verificado con sha256) en
`~/.local/share/solaria` y el wrapper `solaria` en `~/.local/bin`.
Sin sudo y sin dependencias. El primer arranque de la GUI pedirá
clic derecho → Abrir (build sin firma de Apple); el CLI no está afectado.

## Windows x64 (~2-4 min)

```powershell
irm https://raw.githubusercontent.com/Angelcmp/solaria/main/install.ps1 | iex
```

Instala el binario (`win-x86_64`, verificado con sha256) en
`%LOCALAPPDATA%\solaria` y el wrapper `solaria.ps1` en una carpeta `bin`
que se añade a tu PATH de usuario. Sin admin. Para `glob`/`grep` del
agente se recomienda [Git for Windows](https://git-scm.com/download/win).

## Primeros pasos

```bash
solaria version                 # debe responder: solaria 0.9.4
solaria set-key openai sk-...   # guarda tu API key (también: deepseek, anthropic, groq, ollama)
solaria ask "¿qué hace este proyecto?"
```

## Actualizar, fijar versión, reinstalar, desinstalar

```bash
solaria update --check   # ver si hay versión nueva (sin instalar)
solaria update           # instalar la última (no hace nada si estás al día)

# Fijar versión con el instalador
SOLARIA_VERSION=v0.9.3 curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash

# Reinstalar aunque esté al día
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --force

# Desinstalar TODO (binarios, paquete .deb, repo, datos en ~/.solaria)
solaria uninstall --yes
```

> `solaria uninstall` sin `--yes` pide confirmación interactiva y se niega
> a borrar si no hay terminal.

## Compilar desde fuente (opcional)

Todas las arquitecturas, 15-30 min (requiere Rust, Node y ~8 GB de disco):

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --from-source
```

## Problemas comunes

- **`curl: command not found`** (contenedores mínimos): instala `curl` y
  `ca-certificates` con tu gestor de paquetes y reintenta.
- **`solaria: command not found` tras instalar**: el wrapper vive en
  `~/.local/bin`; el instalador lo añade a tu PATH automáticamente.
  Abre una terminal nueva o ejecuta `source ~/.bashrc`
  (en macOS: `source ~/.zshrc`).
- **GUI en macOS bloqueada por Gatekeeper**: clic derecho sobre la app →
  Abrir → Abrir. Solo pasa la primera vez.
- **Instalación corrupta o a medias**: re-ejecuta con `--force`.
