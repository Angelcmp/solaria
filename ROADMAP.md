# Roadmap

> Basado en el análisis completo del código fuente (v0.1.0).

---

## Leyenda

| Icono | Significado |
|-------|-------------|
| ✅ | Implementado |
| 🟡 | Parcial / Mejorable |
| ❌ | No implementado |
| 📋 | Planeado (desde SECURITY.md) |

---

## 1. Funcionalidades existentes (estado actual)

### Chat

| Feature | Estado | Notas |
|---------|--------|-------|
| Conversaciones con IA | ✅ | Ollama local + 8 providers cloud |
| Streaming de respuestas | ✅ | Tauri events + SSE, todos los providers |
| Historial persistente (localStorage) | ✅ | |
| Template selector (40+ templates) | 🟡 | El botón para abrirlo no está visible en la UI (`showTemplates` nunca se activa) |
| Acciones rápidas (8 botones) | ✅ | |
| Renderizado Markdown | ✅ | Con syntax highlighting básico |
| Búsqueda web (Tavily) | ✅ | Modo chat y modo agente |
| Adjuntar archivos / imágenes | ❌ | |
| Regenerar respuesta | ✅ | |
| Multi-modelo por conversación | ❌ | El modelo es fijo por conversación |

### Modo Agente

| Feature | Estado | Notas |
|---------|--------|-------|
| Herramientas: shell, read, write, glob, grep, web_search, fetch_url | ✅ | |
| Panel lateral de pasos (AgentAside) | ✅ | |
| Confirmación Allow/Deny | ✅ | |
| Lista blanca de comandos (allowlist) | ✅ | |
| Rate limiting | ✅ | |
| Session timeout / bloqueo | ✅ | |
| Restricción a directorio de trabajo | ✅ | |
| Auditoría local (`~/.solaria/audit.log`) | ✅ | |
| Streaming de pasos del agente | ✅ | Live reasoning via `liveThinking` + event stream |
| Web search dentro del agente | ✅ | Tavily como herramienta del agente |
| Sandboxing en contenedores | ✅ | Docker con --read-only, tmpfs, sin red |
| Herramienta `fetch_url` / navegación web | ✅ | Con límite de 15KB, validación de tipo |

### Providers

| Feature | Estado | Notas |
|---------|--------|-------|
| Ollama (local) | ✅ | |
| OpenAI, Anthropic, DeepSeek, Groq, Google, Cohere, Kimi, GLM | ✅ | BYOK |
| Almacenamiento de API keys en keyring del SO | ✅ | Fallback a localStorage |
| Configuración de temperatura/top_p/etc | ❌ | No hay controles de parámetros del modelo |
| Cost tracking / uso de tokens | ❌ | |

### UI/UX

| Feature | Estado | Notas |
|---------|--------|-------|
| Sidebar de conversaciones (colapsable) | ✅ | |
| Anclar / renombrar / eliminar conversaciones | ✅ | |
| Tema oscuro | ✅ | Solo existe tema oscuro |
| Tema claro | ❌ | |
| Internacionalización (i18n) | 🟡 | Settings tiene selector `es`/`en` pero no cambia ningún string |
| Atajos de teclado | ❌ | |
| Búsqueda de conversaciones | ❌ | |
| Exportar conversaciones | 🟡 | Solo exportación manual, sin importación |
| Importar conversaciones | ❌ | |

### Backend (Rust)

| Feature | Estado | Notas |
|---------|--------|-------|
| Comandos IPC Tauri | ✅ | 12 comandos registrados |
| Rate limiter | ✅ | Global (no por conversación) |
| CSP configurada | ✅ | |
| Consultas síncronas en agent tools | 🟡 | `glob_execute` y `grep_execute` usan `std::process::Command` síncrono en vez de `tokio::process` |

### Testing y CI

| Feature | Estado | Notas |
|---------|--------|-------|
| Tests unitarios (frontend) | ❌ | No hay tests |
| Tests unitarios (backend) | ❌ | No hay tests |
| Tests de integración | ❌ | No hay tests |
| CI/CD (GitHub Actions) | ❌ | No hay workflows |
| Lint / typecheck en CI | ❌ | |

---

## 2. Próximas features (priorizadas)

### P0 ✅ Completado

- [x] **Streaming de respuestas** — Tauri events + SSE para todos los providers.
- [x] **Parámetros de modelo** — Temperatura, top_p, max_tokens configurables.
- [x] **Regenerar respuesta** — Botón en el último mensaje assistant.

### P1 ✅ Completado

- [x] **Sandboxing del agente** — Ejecución en contenedores Docker.
- [x] **Búsqueda web dentro del agente** — Tavily como herramienta.
- [x] **Herramienta `fetch_url`** — Lectura de URLs desde el agente.
- [x] **Streaming de pasos del agente** — Live reasoning tokens en tiempo real.

### P2 ✅ Completado

- [x] **Internacionalización (i18n)** — Sistema de traducciones es/en con `t(key, lang)`. Cubre: quick actions, welcome, placeholders, tooltips, settings, sidebar, agent, folder drag & drop, cost tracking.
- [x] **Atajos de teclado** — `Ctrl+N`, `Ctrl+,`, `Ctrl+L`, `Ctrl+E`.
- [x] **Búsqueda de conversaciones** — Filtro en el sidebar.
- [x] **Importar conversaciones** — Desde JSON exportado.
- [x] **Template selector accesible** — Botón en toolbar del chat.

### P3 ✅ Completado

- [x] **Tests unitarios (frontend)** — Vitest + React Testing Library.
- [x] **Tests unitarios (backend)** — Tests Rust con `cargo test`.
- [x] **CI/CD (GitHub Actions)** — Lint, typecheck, test, build en cada PR.
- [x] **Model download UI para Ollama** — Interfaz para descargar modelos desde la app.

### P4 — Extras

- [x] **Adjuntar archivos al chat** — Drag & drop + file button, texto plano hasta 1MB.
- [x] **Auto-naming de conversaciones** — IA genera títulos automáticos tras el primer mensaje.
- [x] **Conversaciones archivadas** — Vista toggle en sidebar, botón Archive/Restore/Delete.
- [x] **Cost tracking** — Precios por modelo (OpenAI, Anthropic, etc), tooltip en contador de tokens.
- [x] **Plugins / herramientas extensibles** — Scripts en `~/.solaria/plugins/*.sh` registrados automáticamente.

---

## 3. Bugs / Deuda técnica

- [x] **Template selector** — Botón agregado en toolbar del chat.
- [x] **`glob_execute` y `grep_execute` síncronos** — Migrados a `tokio::process::Command`.
- [x] **Crate name** — `homeangelsolaria` → `solaria-desktop`.
- [x] **`language` setting** — Sistema i18n funcional con `t(key, lang)`.
- [x] **`clearChat` duplicado** — Eliminado.

---

## 4. Recursos

- [Issues](https://github.com/Angelcmp/solaria/issues)
- [PRs](https://github.com/Angelcmp/solaria/pulls)
- [SECURITY.md](./SECURITY.md)
- [README.md](./README.md)
