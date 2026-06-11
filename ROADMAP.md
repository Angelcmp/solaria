# Roadmap — Solaria Agent v0.8.1

> Deep Research Agentic System con Skills + Knowledge Base
> Enfoque: investigación, análisis, proyectos, y sistema de conocimiento personal.

---

## Leyenda

| Icono | Significado |
|-------|-------------|
| ✅ | Implementado |
| 🟡 | Parcial / Mejorable |
| ❌ | No implementado |
| 🔄 | En progreso |
| 🗑️ | Eliminado (v0.4.0) |

---

## 1. Funcionalidades actuales

### Chat

| Feature | Estado | Notas |
|---------|--------|-------|
| Conversaciones con IA | ✅ | Ollama local + 8 providers cloud |
| Streaming de respuestas | ✅ | Tauri events + SSE, todos los providers |
| Historial persistente (localStorage) | ✅ | |
| Template selector (34+ templates) | ✅ | Sin templates de código |
| Acciones rápidas (8 botones) | ✅ | Sin acción "Código" |
| Renderizado Markdown | ✅ | Con syntax highlighting básico |
| Búsqueda web (Tavily) | ✅ | Modo chat y modo agente |
| Adjuntar archivos / imágenes | ✅ | Drag & drop + file button, texto plano hasta 1MB |
| Regenerar respuesta | ✅ | |
| Multi-modelo por conversación | ✅ | Selector en header, modelo por conversación |

### Modo Agente (Research Focus)

| Feature | Estado | Notas |
|---------|--------|-------|
| Herramientas: read_file, write_file, glob, grep, web_search, fetch_url | ✅ | 6 herramientas de investigación |
| Búsqueda web dentro del agente | ✅ | Tavily como herramienta del agente |
| Fetch URL | ✅ | Lectura de contenido web |
| Panel lateral de pasos (AgentAside) | ✅ | Renombrado "Solaria Research" |
| Confirmación en escrituras | ✅ | Solo write_file requiere confirmación |
| Skills activas en system prompt | ✅ | Skills instaladas vía skills.sh se inyectan como guías |
| Streaming de pasos del agente | ✅ | Live reasoning en tiempo real |

### Providers

| Feature | Estado | Notas |
|---------|--------|-------|
| Ollama (local) | ✅ | |
| OpenAI, Anthropic, DeepSeek, Groq, Google, Cohere, Kimi, GLM | ✅ | BYOK |
| Almacenamiento de API keys en keyring del SO | ✅ | Fallback a localStorage |
| Configuración de temperatura/top_p/etc | ✅ | Temperatura, top_p, max_tokens configurables |
| Cost tracking / uso de tokens | ✅ | Precios por modelo, tooltip en contador de tokens |

### UI/UX

| Feature | Estado | Notas |
|---------|--------|-------|
| Sidebar de conversaciones (colapsable) | ✅ | |
| Anclar / renombrar / eliminar conversaciones | ✅ | |
| Tema oscuro | ✅ | Solo existe tema oscuro |
| Tema claro | ❌ | |
| Internacionalización (i18n) | ✅ | Sistema de traducciones es/en |
| Atajos de teclado | ✅ | `Ctrl+N`, `Ctrl+,`, `Ctrl+L` |
| Búsqueda de conversaciones | ✅ | Filtro en el sidebar |
| Exportar conversaciones | 🟡 | Solo exportación manual |
| Importar conversaciones | ✅ | Desde JSON exportado |

### Testing y CI

| Feature | Estado | Notas |
|---------|--------|-------|
| Tests unitarios (frontend) | ✅ | Vitest + React Testing Library, 11 tests |
| Tests unitarios (backend) | ✅ | 3 tests con `cargo test` |
| Tests de integración | ✅ | 11 tests: tool execution, audit log, provider config |
| CI/CD (GitHub Actions) | ✅ | tsc + vitest + cargo check + test + clippy |

---

## 2. Features eliminadas (v0.4.0)

| Feature | Motivo |
|---------|--------|
| Git tools (8) | Solo relevantes para desarrollo de código |
| Shell tool | Innecesaria y riesgosa para research no-code |
| Docker sandbox | Orientado a ejecución segura de código |
| Plugin system (bash scripts) | No-code no es bash scripting |
| Perfiles de seguridad (Explorar/Ejecutar) | Diseñados para code execution |
| Rate limiting / allowlist / session timeout | Mecanismos de protección para shell |
| Pestaña MCP en Settings | Se mantiene infraestructura, se oculta UI |
| Pestaña Plugins en Settings | Eliminada con el sistema de plugins |
| Templates de código (7) | Code Review, Debug, System Design, etc. |
| Quick action "Código" | Reemplazado por enfoque research |

---

## 3. Nueva hoja de ruta

### P0 — Skills locales de proyecto ✅

- [x] Detectar `.solaria/skills/` en cualquier proyecto
- [x] Comando `create_skill` para crear skills desde el backend
- [x] Skills locales + globales (overlay: proyecto > global)

### P1 — Deep Research Skill ✅

- [x] Skill `deep-research` con pipeline: pregunta → búsqueda → extraer → analizar → reporte `.md`
- [x] Multi-paso autónomo con verificación de fuentes
- [x] Salida estructurada en markdown con citas y evaluación de confianza

## Pendientes para próxima sesión

### P2 — Skills profesionales ✅

- [x] `market-analysis` — análisis de competencia, drafts de campañas
- [x] `report-generator` — datos → análisis → markdown estructurado
- [x] `meeting-notes` — notas → estructura → action items
- [x] `data-analysis` — CSV → limpieza → transformación → presentación
- [x] `transcription-processing` — procesar texto → resumen ejecutivo

### P3 — Skill Factory ✅

- [x] El usuario dice "crea una skill que haga X"
- [x] El agente genera el SKILL.md con frontmatter y workflow
- [x] La skill se guarda en `.solaria/skills/` del proyecto actual
- [x] Meta-skill `skill-factory` que enseña al agente a crear skills desde el chat

### P4 — Ecosistema y mejoras ✅

- [x] Integración con skills.sh para descubrimiento desde el chat (skill `skills-discover`)
- [x] Auto-activación de skills según contexto (toggle en Settings + filtro por relevancia en backend)
- [x] ~~Tema claro~~ (descartado — solo modo oscuro)
- [x] Exportar conversaciones (markdown via save dialog, PDF via print)
- [x] Mejoras en UI del panel de investigación (ResearchAside tabs: resumen de pasos, favicon en fuentes, copiar reporte, reports múltiples)
- [x] ResearchAside colapsable + opacidad 60% pasos antiguos
- [x] Tool steps auto-collapsed (tool_call/tool_result viejos colapsados)
- [x] Botón ⋮ con export MD/PDF + limpiar chat
- [x] Markdown headings corregidos (h1 > h2 > h3 >= p)
- [x] Codex-style chips para pasos del agente con glow animation
- [x] Skills globales eliminadas (solo deep-research)

### P5 — Proyectos y navegación ✅

- [x] Sidebar: nueva sección Proyectos con CRUD (nombre + carpeta via diálogo Tauri)
- [x] Al seleccionar proyecto → workingDirectory del agente se actualiza
- [x] Contenido de carpeta visible en sidebar (archivos + subcarpetas)
- [x] Conversaciones asociadas a proyecto (projectId)
- [x] Conversaciones generales vs proyecto separadas en sidebar
- [x] Secciones colapsables (Conversaciones + Proyectos)
- [x] Lista plana con tiempo relativo (1h, 2d, 1s, 1m)
- [x] Anclados separados con ⭐
- [x] Auto-naming de título en primer mensaje

### P6 — Sistema de Conocimiento

- [x] Skill `knowledge-builder`: construye wiki .md con resúmenes, conceptos, cross-links [[wiki]]
- [x] glob/grep respetan working_directory del proyecto
- [x] fetch_url extrae texto de HTML automáticamente

### P7 — Odyssey Features

> Inspirado en [pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus)

- [x] **Memoria persistente con vector store (RAG)** — SQLite + sqlite-vec como motor de búsqueda vectorial embebido. Embeddings multi-provider (Ollama, OpenAI, custom). Indexación automática de conversaciones y proyectos. Búsqueda semántica inyectada en system prompt. (v0.8.0)
- [x] **UI de MCP en Settings** — UI completa para gestionar servidores MCP: listar, añadir, editar, eliminar, iniciar/detener, ver herramientas descubiertas. (v0.8.1)
- [x] **Cookbook: descubrimiento y descarga de modelos** — escanear hardware, explorar catálogo curado de 15 modelos GGUF, descargar desde HuggingFace con barra de progreso (resume, velocidad, ETA, cancelable) y servir automáticamente en Ollama con un clic. (v0.8.2)
- [x] **Comparador de modelos (blind test)** — probar modelos side-by-side sin saber cuál es cuál, votar y sintetizar resultado. (v0.8.5)
- [x] ~~**PWA / responsive mobile**~~ — descartado.
- [x] **WikiAside: panel de markdowns** — lista archivos `.md` del working directory del agente, renderizado inline. Botón toggle en WorkspaceAside. Backend `wiki_list_files`/`wiki_read_file`. (v0.8.1)

### Bugs conocidos (todos resueltos ✅)

- [x] ~~fetch_url falla con `{"": "url"}`~~ (v0.6.1)
- [x] ~~deep-research con PDFs~~ (v0.5.2)
- [x] ~~Contador de pasos inconsistente~~ (v0.6.1)
- [x] ~~Chat truncaba write_file~~ (v0.6.1)
- [x] ~~Agente arrastraba historial~~ (v0.6.1)
- [x] ~~"No preguntar" no respetado~~ (v0.6.1)
- [x] ~~glob no respetaba working_directory~~ (v0.7.0)
- [x] ~~Conversaciones sin título en modo agente~~ (v0.7.0)

---

## 5. Recursos

- [Issues](https://github.com/Angelcmp/solaria/issues)
- [PRs](https://github.com/Angelcmp/solaria/pulls)
- [SECURITY.md](./SECURITY.md)
- [README.md](./README.md)
