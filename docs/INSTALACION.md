# Instalar Solaria

> Versión actual: **v0.9.5** · Releases: <https://github.com/Angelcmp/solaria/releases>
>
> Solaria es una app gráfica: la terminal solo la lanza (`solaria` abre la
> ventana). Este documento es la guía completa de instalación para
> solaria.im y espeja la sección de instalación del `README.md` del
> repositorio. Si algo difiere, manda el `README.md`.

## Requisitos

- Conexión a internet.
- **Linux**: x86_64 o aarch64. En Linux el instalador puede pedir sudo una vez (dependencias del sistema).
- **macOS**: Apple Silicon (arm64). Intel no soportado. Sin sudo y sin dependencias.
- **Windows**: 10 o superior, x64. Sin admin.

## Linux

Un solo comando para todas las distros (~1-2 min):

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash
```

El instalador detecta tu distro y arquitectura, descarga el binario
precompilado del último Release (verificado con sha256), instala solo las
dependencias de ejecución y deja el lanzador `solaria` listo más la entrada
de menú. Si la versión instalada ya está al día, no hace nada.

### Ubuntu / Debian (vía `.deb`)

En sistemas con `apt` se instala el paquete `.deb` del Release, que registra
la app y resuelve las dependencias vía `apt` (`apt-get install -f`).

- Tiempo medido: **~60s** (Ubuntu 24.04), **~85s** (Debian 12).

### Fedora / RHEL (vía tarball + `dnf`)

Sin `.deb`: descarga el tarball verificado e instala el stack de ejecución
(webkit/gtk) con `dnf`.

- Tiempo medido: **~75-106s** (Fedora 41).

### Arch Linux (vía tarball + `pacman`)

Tarball verificado + dependencias con `pacman` (el instalador sincroniza la
base de datos solo, sin actualizar tu sistema).

- Tiempo medido: **~70s**.

### openSUSE (vía tarball + `zypper`)

Tarball verificado + dependencias con `zypper` (con `refresh` previo).

- Tiempo medido: **~111s** (Tumbleweed).

### Otras distros

Cualquier distro x86_64/aarch64 moderna con `curl` y `tar` funciona por la
vía tarball: el instalador usa el gestor que encuentre (`apt`, `dnf`,
`pacman` o `zypper`). En contenedores mínimos instala antes `curl` y
`ca-certificates` y reintenta.

## macOS Apple Silicon (~2-4 min)

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install-macos.sh | bash
```

Instala el binario (`darwin-aarch64`, verificado con sha256) en
`~/.local/share/solaria` y el lanzador `solaria` en `~/.local/bin`
(añadido a tu PATH en `~/.zshrc`; recarga con `source ~/.zshrc` o abre una
terminal nueva). El primer arranque de la GUI pedirá clic derecho → Abrir
(build sin firma de Apple).

## Windows x64 (~2-4 min)

```powershell
irm https://raw.githubusercontent.com/Angelcmp/solaria/main/install.ps1 | iex
```

Instala el binario (`win-x86_64`, verificado con sha256) en
`%LOCALAPPDATA%\solaria` y el lanzador `solaria.ps1` en una carpeta `bin`
que se añade a tu PATH de usuario. Para `glob`/`grep` del agente se
recomienda [Git for Windows](https://git-scm.com/download/win).

## Primeros pasos

1. Abre la app (`solaria` en Linux, Menú inicio en Windows, Solaria.app en macOS).
2. Guarda tu API key en **Configuración → Proveedores** (OpenAI, Anthropic, DeepSeek, Groq, Ollama…).
3. Tu versión instalada está en **Configuración → Aplicación**.

## Actualizar, fijar versión, reinstalar, desinstalar

- **Actualizar**: en la app, **Configuración → Aplicación → Buscar actualizaciones** (o re-ejecuta el instalador: no hace nada si estás al día).
- **Desinstalar**: en la app, **Configuración → Aplicación → Desinstalar** (doble confirmación; borra binarios y datos).

```bash
# Fijar versión con el instalador
SOLARIA_VERSION=v0.9.5 curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash

# Reinstalar aunque esté al día
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --force

# Desinstalar todo con el instalador (alternativa al botón de la app)
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --uninstall
```

## Compilar desde fuente (opcional)

Todas las arquitecturas, 15-30 min (requiere Rust, Node y ~8 GB de disco):

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/install.sh | bash -s -- --from-source
```

## Problemas comunes

- **`curl: command not found`** (contenedores mínimos): instala `curl` y
  `ca-certificates` con tu gestor de paquetes y reintenta.
- **`solaria: command not found` tras instalar**: el lanzador vive en
  `~/.local/bin`; el instalador lo añade a tu PATH automáticamente.
  Abre una terminal nueva o ejecuta `source ~/.bashrc`
  (en macOS: `source ~/.zshrc`; en Windows: abre una terminal nueva).
- **GUI en macOS bloqueada por Gatekeeper**: clic derecho sobre la app →
  Abrir → Abrir. Solo pasa la primera vez.
- **Instalación corrupta o a medias**: re-ejecuta con `--force` (Linux/macOS)
  o `-Force` (Windows).
