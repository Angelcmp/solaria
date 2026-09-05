# Benchmark — Instalación rápida por distro (modo descarga)

Fecha: 2026-09-05 · Método: contenedores podman limpios (una corrida en frío por distro),
`install.sh` en modo descarga contra mock local de GitHub Releases
(`scripts/bench/`). Binario stub (el pipeline —API, descarga, checksum,
deps, deploy, verify— es el real). Tiempos en segundos, pared total.

## Resultados

| Distro | Imagen | Vía | Inicio¹ | Descarga² | Deps+deploy | Total |
|---|---|---|---|---|---|---|
| Ubuntu 24.04 | `ubuntu:24.04` | `.deb` | 13 | 0 | 45 | **60** |
| Debian 12 | `debian:12` | `.deb` | 10 | 0 | 73 | **85** |
| Fedora 41 | `fedora:41` | tarball | 0 | 0 | 73 | **75** |
| Arch | `archlinux:latest` | tarball | 0 | 1 | 66 | **70** |
| openSUSE TW | `opensuse/tumbleweed` | tarball | 26 | 0 | 82 | **111** |

¹ `inicio` = `apt-get update` + instalar `curl` (Ubuntu/Debian) o
`zypper refresh` + `curl`/`gawk` (Tumbleweed). Fedora/Arch ya los traían.
² Descarga contra mock en localhost (~0s). En el mundo real suma tu ancho de
banda: tarball ~10-30 MB + API de GitHub (~1-2s).

## Gráfico (total, segundos)

```text
Ubuntu 24.04    60s  ██████████████████████
Debian 12       85s  ███████████████████████████████
Fedora 41       75s  ███████████████████████████
Arch            70s  █████████████████████████
openSUSE TW    111s  ████████████████████████████████████████
```

## Lectura

- **Todas instalan en ~1-2 min**, frente a 15-30 min compilando desde fuente.
- El grueso es el gestor de paquetes instalando el stack webkit/gtk
  (45-82s); el `.deb` no es automáticamente más rápido que el tarball —
  gana Ubuntu por espejos rápidos, no por el formato.
- Tumbleweed es el más lento por `zypper refresh` + stack completo en frío.
- Las 5 terminan con `solaria version` respondiendo correctamente.

## Bugs encontrados por el benchmark (ya corregidos en `install.sh`)

- Fallback sin python3 solo matcheaba `https://` (rompía GHES/proxies/mock `http`).
- `pacman -S` sin `-Sy` fallaba en Arch virgen (DB sin sincronizar).
- Preflight exigía `awk`/`free`/`df`/`nproc` incondicionales (Tumbleweed mínimo no trae `awk`); ahora tolerante + `need_cmd awk gawk`.
- Nombres zypper inválidos (`webkit2gtk3-devel`, `libappindicator-gtk3-devel` no existen en TW) → `webkitgtk3-devel` (provee `pkgconfig(webkit2gtk-4.1)`), `libappindicator3-devel` + `zypper refresh` previo.

## Para repetirlo

```bash
scripts/bench/bench-install.sh setup
scripts/bench/bench-install.sh server-start
scripts/bench/bench-install.sh run <ubuntu|debian|fedora|arch|tumbleweed>
scripts/bench/bench-install.sh server-stop
```

Logs con marcas `BENCH-TIME` por etapa en `/tmp/solaria-bench/logs/*.log`.
Con un release real publicado basta apuntar `GITHUB_API` a `https://api.github.com`
y `SOLARIA_VERSION` al tag para medir descargas reales.
