# Changelog

## [0.8.4] — 2026-06-07

### Added
- **CLI mode** — nuevo binario multipropósito: `solaria` (GUI, forkea al fondo), `solaria ask "prompt"` (one-shot chat), `solaria agent "task"` (agente de investigación), `solaria serve` (daemon con pid file)
- **Fork auto-detach** — al ejecutar `solaria` sin args, el proceso se forkea en background y libera la terminal inmediatamente (como `code` o `subl`)
- **Pipe stdin support** — `echo "texto" | solaria ask` lee desde stdin para integrarse con otras herramientas CLI
- **Flags en CLI**: `--provider`, `--model`, `--host`, `--dir`, `--dry` para controlar el modelo, directorio de trabajo y preview de tool calls
- **Nuevo módulo `cli.rs`** — parseo de argumentos, dispatch de comandos, agent loop simplificado en Rust con tool extraction y execution
- **`solaria --help`** — documentación de todos los comandos y flags disponibles

## [0.8.3] — 2026-06-07

### Added
- **Dimensión dinámica de vectores** — `vec0` table se adapta automáticamente a la dimensión del modelo de embeddings configurado (ya no está hardcodeada a 768). Tabla `config` persistente en SQLite.
- **Chunk overlap** — `chunk_text()` ahora acepta `overlap` para solapar chunks consecutivos
- **Filtros en búsqueda semántica** — `SearchFilters` con filtro por `sources` (conversación/archivo) y `max_age_days`
- **Decaimiento por recencia** — nuevo parámetro `recencyWeight` que mezcla similitud semántica + antigüedad
- **Deduplicación de resultados** — chunks del mismo `source:source_id` se colapsan al más relevante
- **Progreso en indexación** — eventos `memory://index-progress` con barra en Settings > Memory
- **Auto-index de proyecto** — al seleccionar un proyecto se indexan sus archivos automáticamente
- **Auto-re-index en segundo plano** — cada 5 min verifica si el proyecto activo necesita re-indexarse
- **Indexación de conversaciones completas + agentes** — todos los mensajes, incluyendo investigaciones del agente

### Changed
- **ROADMAP.md**: Cookbook marcado como completado
- **Settings > Memory**: campo "Peso recencia", barra de progreso en indexación

### Fixed
- **Error de dimensión al cambiar modelo de embeddings** — ya no falla si se usa mxbai-embed-large (1024d) o text-embedding-3-small (1536d)

## [0.8.1] — 2026-06-01

### Added
- **Panel Markdowns/Wiki**: nuevo `WikiAside` que lista archivos `.md` del directorio de trabajo del agente y los renderiza con `Markdown`. Botón de documento en el header del WorkspaceAside para alternar entre conversaciones y markdowns. Seleccionar un proyecto abre automáticamente el panel de markdowns
- **Comandos backend wiki**: `wiki_list_files(dir)` lista archivos `.md` no recursivo; `wiki_read_file(path)` lee contenido
- **Tab MCP en Settings**: UI completa para gestionar servidores MCP — listar, añadir, editar, eliminar, iniciar/detener, ver herramientas descubiertas. Persistencia en `~/.solaria/mcp_servers.json` (backends `mcp_list_servers`, `mcp_save_servers`, `mcp_start_server`, `mcp_stop_server`, `mcp_restart_all`, `mcp_list_tools` ya existían desde v0.3.0)

### Changed
- **Sidebar izquierda**: ancho expandido de 280px → **320px** en ambos paneles (WorkspaceAside y WikiAside)
- **Logo Solaria restaurado** en el header del sidebar (`<img src="/solaria-logo.svg">`) reemplazando el icono de reloj genérico
- **Filas de archivos en proyectos**: eliminados los iconos de carpeta/archivo. Ahora usan el mismo estilo visual que `ConvRow` (text-[0.7rem], px-3 py-2, rounded-xl, hover bg). Límite reducido a 8 archivos + 5 conversaciones para evitar scroll vertical
- **Badge de Conversaciones**: ahora cuenta solo conversaciones NO ancladas (antes contaba las ancladas). Proyectos muestran badge con el número de carpetas creadas
- **Scroll sin iconos de agente**: las conversaciones sin pin/archivo ya no muestran icono alguno — solo título y tiempo relativo
- **Botón de markdowns**: icono SVG de documento con líneas (cian `#00E5C9`, 14x14) reemplazó la letra "W" genérica. Tooltip y header del panel cambiados de "Wiki" a "Markdowns"

### Fixed
- **Scroll vertical innecesario en panel izquierdo**: corregido con `min-h-0` en el contenedor flex `flex-1` — sin esto, el tamaño mínimo implícito `min-content` impedía que se encogiera aunque tuviera `overflow-y-auto`
- **Scrollbar estandarizado**: unificado a `width/height: 4px`, thumb `#333` → `#444` hover (antes `#4b5563` → `#6b7280`). Aplicado global en `index.css` + Firefox con `scrollbarColor: '#333 transparent'` en 6 componentes. Code blocks: `3px` horizontal

## [0.8.0] — 2026-06-01

### Added
- **Memoria persistente con vector store (RAG)** — el agente ahora recuerda conversaciones previas y archivos del proyecto usando SQLite + sqlite-vec como motor de búsqueda vectorial embebido
- **Sistema de embeddings multi-provider** — soporte para Ollama (local), OpenAI, y endpoints compatibles custom
- **Indexación automática** — conversaciones se indexan al completarse; proyectos se indexan bajo demanda desde Settings
- **Búsqueda semántica inyectada en system prompt** — antes de cada mensaje, se buscan chunks relevantes y se inyectan como "Contexto relevante de memoria"
- **Tab Memoria en Settings** — configurar provider, modelo, top-k, score mínimo, auto-inject, indexar conversaciones/archivos, prueba de búsqueda, estadísticas y botón de limpieza
- **Comando `memory_index_project_files`** — escanea recursivamente un directorio de proyecto y indexa archivos por extensión (.md, .ts, .rs, .py, etc.) en la base de datos vectorial
- **Storage en `~/.solaria/memory.db`** — portable, sin servicios externos, formato SQLite estándar

### Technical
- Nuevas deps: `rusqlite` (con feature `bundled`), `sqlite-vec` 0.1, `zerocopy`
- Nuevos módulos Rust: `memory.rs` (SQLite + vec0), `embeddings.rs` (Ollama/OpenAI/custom + chunking)
- Nuevos comandos Tauri: `memory_index_text`, `memory_search`, `memory_stats`, `memory_delete_source`, `memory_clear`, `memory_index_project_files`
- `sqlite3_vec_init` registrado como auto-extension en `tauri::Builder::default()`
- Nuevo hook `useMemory` con API React completa (search, index, clear, formatContext)
- 4 tests nuevos para `embeddings::chunk_text` (casos: corto, vacío, largo, preservación de contenido)

## [0.7.0] — 2026-05-30

### Added
- **Sidebar reestructurada**: Skills section, Proyectos con CRUD (localStorage + diálogo nativo), conversaciones colapsables
- **Proyectos**: crear proyecto con nombre y carpeta → workingDirectory del agente se actualiza. Muestra contenido de la carpeta en sidebar
- **Conversaciones por proyecto**: `Conversation.projectId` asocia chats al proyecto. Aparecen bajo el proyecto en vez de "Conversaciones" general
- **Sidebar colapsable**: Conversaciones y Proyectos con toggle ▾ expandir/colapsar
- **Lista plana de conversaciones**: eliminados grupos por fecha, ahora tiempo relativo (1h, 2d, 1s, 1m). Anclados separados con ⭐
- **Botón ⋮ en top bar**: Exportar MD + Exportar PDF + Limpiar chat en menú compacto
- **Skill knowledge-builder**: construye wiki personal de markdown desde carpeta proyecto con cross-links automáticos [[wikilinks]]
- **Auto-naming de conversaciones**: título se actualiza automáticamente al primer mensaje
- **ResearchAside colapsable**: botón ← colapsa a tira de 36px con P/D/R tabs. Sin perder datos
- **Codex-style agent steps**: chips inline con glow animation para → web_search / → fetch_url
- **Markdown headings corregidos**: h1/h2/h3 ahora más grandes que párrafos (jerarquía visual correcta)
- **Tool steps auto-collapsed en ResearchAside**: tool_call y tool_result antiguos colapsados por defecto

### Fixed
- **glob no respetaba working_directory**: `glob_execute` ahora busca desde la carpeta del proyecto, no desde el CWD del proceso
- **grep no respetaba working_directory**: `grep_execute` usa working_dir como path por defecto
- **autoName no se ejecutaba en modo agente**: añadido `autoName` en `handleAgentComplete`
- **startAgentPrompt no guardaba título**: si la conversación existía con título "Nueva conversación", se actualiza con el primer mensaje
- **Tool pasos desaparecidos en top bar**: Quick actions ahora visible con agente activo

### Changed
- **ResearchAside**: eliminado header "Solaria completado". Tabs + dot status + stop + colapsar + cerrar en barra única
- **ResearchAside**: pasos con opacidad 60% (hover 95%), ancho 480px mantenido
- **Top bar**: logos y badges unificados (mismo tamaño `text-[0.65rem]`, `py-[3px]`, `rounded`)
- **Top bar**: logo Solaria sin texto, solo icono
- **Project files**: tamaño aumentado a `text-[0.75rem]` (12px)
- **glob**: excluye node_modules, .git, target automáticamente
- **fetch_url**: extrae texto de HTML en backend (elimina scripts, styles, tags)

## [0.6.1] — 2026-05-30

### Fixed
- **Chat truncaba contenido de write_file**: eliminado límite de 800 caracteres. Ahora el chat muestra el reporte completo (antes ResearchAside tenía más información que el chat)
- **Auto-reset del agente por prompt**: cada nuevo mensaje limpia el historial del agente. Ya no se arrastra contexto entre prompts
- **"No preguntar" reforzado**: reglas 1 y 2 del system prompt ahora usan **PROHIBIDO** con ejemplos concretos de frases a evitar. Agregada regla 9 sobre idioma
- **URL mal formada en tool args**: `tryFixJson` ahora detecta y corrige `"url":https://ejemplo.com`, `"url": "https://...}` (sin comilla de cierre), `"name":web_search"`, y `;"}` (punto y coma en lugar de comillas)
- **Tool call malformed ya no rompe el loop**: si `extractToolCall` falla pero la respuesta contiene `<tool_call>`, se envía un mensaje de error al modelo y continúa (en vez de finalizar prematuramente)
- **fetch_url ahora extrae texto de HTML**: el backend elimina tags HTML, scripts y styles antes de devolver el contenido. El LLM recibe texto limpio en vez de HTML crudo de 15000 chars
- **Contexto entre prompts en agente**: `messageHistoryRef` ahora guarda el último par pregunta/respuesta (sin tool calls), permitiendo al agente referenciar información de la conversación anterior
- **ResearchAside persistente**: ya no se limpian los pasos al enviar un nuevo mensaje. Los steps se acumulan entre prompts de la misma conversación
- **write_file ya no muestra el contenido completo en el chat**: ahora solo muestra "Archivo guardado: nombre.md". El ResearchAside tool_result también es compacto. El contenido completo se envía al LLM truncado a 500 caracteres como contexto

### Changed
- **ResearchAside tabs renombrados**: "Agente" → "Proceso", "Reporte" → "Documento", "Fuentes" → "Referencias"
- **ResearchAside rediseño minimalista**: menos bordes, tipografía más limpia, header simplificado, colores más sutiles
- **System prompt del agente**: reglas reescritas más estrictas para evitar preguntas al usuario. Eliminado el ofrecimiento de más ayuda al finalizar

## [0.6.0] — 2026-05-30

### Added
- **5 skills profesionales**: `market-analysis`, `report-generator`, `meeting-notes`, `data-analysis`, `transcription-processing`
- **Skill Factory** (P3): meta-skill `skill-factory` para crear skills desde el chat
- **Skills Discover** (P4): skill `skills-discover` para buscar e instalar skills desde skills.sh
- **Auto-activación de skills**: toggle en Settings + filtro por relevancia en backend (solo inyecta skills que coinciden con el mensaje del usuario)
- **Exportar conversaciones**: botón Markdown (guarda .md via diálogo nativo) y PDF (abre impresión con diseño Solaria)
- **ResearchAside mejorado**: barra de resumen de pasos, favicon en fuentes, botón copiar reporte, soporte múltiples reportes
- **Bilingüe**: todas las skills ahora funcionan en inglés y español, detectando el idioma del usuario
- **Persistencia de agent config**: `workingDirectory` y `autoActivateSkills` se guardan en localStorage

### Fixed
- **Project skills no visibles**: `list_skills` ahora resuelve automáticamente la raíz del proyecto (busca `.solaria/` subiendo directorios)
- **Contador de pasos inconsistente**: progress line ya no muestra `iteration/maxIterations`, usa solo el tool name

### Changed
- **Skills globales**: eliminadas 12 skills orientadas a código (deploy-to-vercel, diagnose, front-end-developer, shadcn, supabase, tdd, etc.) — solo queda `deep-research` global
- **Project skills**: ahora tienen toggle activar/desactivar (ya no son `force_enabled`)
- **`get_cwd`**: ahora busca `.solaria/` hacia arriba desde el directorio actual, en vez de devolver `src-tauri/`

## [0.5.2] — 2026-05-29

### Fixed
- **JSON crudo en chat**: Regex de `cleanToolCalls` reescrita para solo limpiar `{"name":"...","arguments":{...}}` (antes era muy agresiva y dejaba residuos de write_file con contenido anidado).
- **Chat se borraba entre pasos**: `fullAssistantContent` ahora acumula SIEMPRE texto + progreso + respuesta final. `chat_update` nunca usa fallbacks.
- **Respuesta final no se acumulaba**: El último mensaje sin tool_call ahora se concatena a `fullAssistantContent`.
- **Args inline ignorados**: `extractArgsFromTopLevel()` captura argumentos fuera del wrapper `arguments` (ej: `{"name":"fetch_url","url":"..."}`).
- **PDF: error genérico**: Mensaje específico: "No se puede leer PDFs directamente. Busca una página web (HTML)".
- **Agente se quedaba en loop de búsqueda**: skill deep-research reescrita: sin preguntas al usuario, límite 3 fetch, síntesis obligatoria.
- **Progress line rompía con `_`**: Cambiado de `_italic_` a `*italic*` para evitar conflicto con underscores en nombres de tools.
- **cleanToolCalls regex**: Regex de JSON genérico eliminada. Nueva regex específica que solo elimina `{"name":"...","arguments":{...}}`.

### Added
- **ResearchAside**: Nuevo panel derecho con tabs (Agente / Reporte / Fuentes). Reemplaza AgentAside. Tab Reporte previsualiza el .md escrito por el agente. Tab Fuentes lista URLs con estados.
- **Reporte visible en chat**: Cuando el agente usa `write_file`, el chat muestra preview del contenido + ruta del archivo.
- **Autolink**: URLs planas se convierten en links clickeables `#00E5C9`.
- **Blockquote renderer**: Markdown ahora renderiza `> blockquotes` con estilo Solaria.

### Changed
- **Tipografía**: Cuerpo IBM Plex Sans 300, H1/H2 font-medium 500, H3+ normal 400. Letter-spacing 0.015em.
- **Progreso en chat**: Formato `*→ tool · paso X/Y*` con animación pulse.
- **AgentAside eliminado**: Reemplazado por ResearchAside.

## [0.5.1] — 2026-05-29

### Fixed
- **deep-research skill reescrita**: Eliminada fase de preguntas al usuario. Límite estricto de 3 fetch attempts y 6 tool calls totales. Si fetch falla, usa snippet y sigue. Prohibido preguntar "quieres que profundice".
- **System prompt del agente**: 8 reglas estrictas — no preguntar, no pedir confirmación, límite de tools, síntesis forzada después de 3 herramientas, fuentes al final.
- **AgentAside**: Dots animados en tool calls en ejecución.
- **Markdown renderer**: Soporte para blockquotes (`> `) con estilo visual.
- **Acumulación en chat**: `fullAssistantContent` ahora acumula SIEMPRE todo (razonamiento + progreso + respuesta final). Nunca se borra el contenido previo.
- **Args inline**: `extractArgsFromTopLevel()` captura argumentos fuera del wrapper `arguments` (ej: `{"name":"fetch_url","url":"..."}`).
- **PDF error**: Mensaje claro: "No se puede leer PDFs directamente. Busca una página web (HTML)".
- **ResearchAside**: Nuevo panel derecho con tabs (Agente / Reporte / Fuentes). Reemplaza AgentAside. Tab Agente muestra steps del agente. Tab Reporte previsualiza el .md escrito por el agente. Tab Fuentes lista URLs de búsquedas y fetches con estado (pendiente/obtenido/error).
- **Autolink**: URLs planas se convierten en links clickeables `#00E5C9`.
- **Tipografía**: Cuerpo IBM Plex Sans 300, H1/H2 font-medium 500, H3+ normal 400. Letter-spacing 0.015em. Listas weight 300.

## [0.5.0] — 2026-05-29

### Added
- **Skills locales de proyecto**: El agente ahora descubre skills desde `.solaria/skills/` en el directorio de trabajo. Skills del proyecto siempre están activas y tienen prioridad sobre las globales con el mismo nombre.
- **Comando `create_skill`**: Permite crear skills de proyecto programáticamente (backend). Guarda SKILL.md con frontmatter YAML en `.solaria/skills/<slug>/`.
- **Skill `deep-research`**: Pipeline de investigación profunda (5 fases): formulación de preguntas → búsqueda web → análisis → reporte estructurado `.md` → revisión final. Incluye citas de fuentes, evaluación de confianza y síntesis transversal.
- **SkillsTab actualizado**: Muestra skills del proyecto (`source: "project"`) y globales (`source: "global"`) separadas visualmente. Skills de proyecto tienen badge "Proyecto".

### Changed
- `skills.rs`: `SkillDefinition` ahora incluye campo `source` ("global" | "project"). Nueva función `discover_all_skills()` con overlay (proyecto > global). `get_enabled_skills_prompt()` acepta `working_dir` opcional para inyectar también skills locales.
- `lib.rs`: `list_skills` y `get_skills_prompt` ahora aceptan `working_dir` opcional. Nuevo comando `create_skill`.
- `useAgent.ts`: `get_skills_prompt` ahora pasa `workingDirectory` del agente.
- `SettingsPanel.tsx`: `SkillsTab` recibe `workingDirectory` y muestra skills por origen.

## [0.4.0] — 2026-05-29

### 🎯 Nueva dirección: Deep Research Agentic System con Skills

Solaria cambia su enfoque: de un agente de código a un **asistente de investigación y análisis** potenciado por skills. El agente ahora se especializa en investigación profunda, análisis de datos, generación de reportes y automatización de tareas para profesionales no-code.

### ❌ Eliminado (no alineado con la nueva visión)

- **8 herramientas Git**: eliminadas `git_status`, `git_log`, `git_branches`, `git_add`, `git_commit`, `git_push`, `git_checkout`, `git_diff` — tanto del backend (`git.rs`) como del frontend
- **Herramienta `shell`**: eliminada — ejecución de comandos bash ya no es parte del agente
- **Sandbox Docker**: eliminado completamente (`sandbox.rs`, comandos `check_docker`/`stop_sandbox`, settings UI)
- **Sistema de Plugins**: eliminado (`plugins.rs`, comandos `list_plugins`/`execute_plugin`, pestaña Plugins en Settings)
- **Perfiles de seguridad**: eliminados (Explorar/Ejecutar, allowlist, rate limiting, session timeout)
- **Pestaña MCP en Settings**: eliminada (la infraestructura MCP se mantiene para uso futuro)
- **Pestaña Agente**: simplificada — ahora solo muestra toggle, iteraciones, directorio y confirmar escrituras
- **AgentAside**: simplificado — renombrado a "Solaria Research", eliminado footer de directorio
- **7 templates de código**: eliminados Code Review, Debug Issue, System Design, Refactor Code, Explain Code, Algorithm Design, Build API
- **Quick action "Código"**: eliminada de acciones rápidas
- **Keys de i18n**: eliminadas claves de código, docker, allowlist, rate limit, etc.

### ✨ Mejorado para el nuevo enfoque

- **System prompt del agente**: reescrito para enfoque en investigación, análisis y reportes
- **AgentConfig**: simplificado — eliminados `sandboxEnabled`, `sandboxImage`, `sandboxAirGapped`, `securityProfile`, `sessionTimeout`, `rateLimit`, `useAllowlist`, `commandAllowlist`, `autoConfirm`, `restrictToWorkDir`
- **Tool descriptions**: actualizadas para enfoque research (leer docs, buscar en web, escribir reportes)
- **Settings UI**: simplificada a 5 tabs (General, API Keys, Búsqueda, Skills, Auditoría)
- **ROADMAP.md**: pendiente actualizar con nueva hoja de ruta

### Technical
- 3 módulos Rust eliminados (`git.rs`, `sandbox.rs`, `plugins.rs`), ~550 líneas menos
- 16 comandos Tauri eliminados
- 29 tests backend + 11 frontend pasando

## [0.3.0] — 2026-05-28

### Added
- **Git Integration**: 8 herramientas git para el agente (`git_status`, `git_log`, `git_branches`, `git_add`, `git_commit`, `git_push`, `git_checkout`, `git_diff`). Operan sobre git local sin necesidad de autenticación externa. Las operaciones destructivas requieren confirmación manual.
- **MCP Protocol**: Cliente JSON-RPC 2.0 sobre stdio conectado al loop del agente. Descubrimiento dinámico de tools desde servidores MCP. Tools registradas como `mcp__server__toolname`.
- **MCP Settings UI**: Pestaña en Settings para añadir, activar/desactivar y eliminar servidores MCP. Persistencia en `~/.solaria/mcp_servers.json`.
- **Servidores MCP pre-configurados**: GitHub (`@modelcontextprotocol/server-github`) y Filesystem (`@modelcontextprotocol/server-filesystem`), desactivados por defecto.
- **ROADMAP.md**: Actualizado con secciones Git y MCP.

### Changed
- `tools.rs`: `get_all_tools()` ahora incluye git tools + MCP tools dinámicas. `execute_tool()` y `execute_tool_sandboxed()` despachan git/MCP tools.
- `audit.rs`: Agregada persistencia de configuración MCP.
- `useAgent.ts`: Tool descriptions incluyen git tools. Default `allowedTools` actualizado.
- `SettingsPanel.tsx`: `AVAILABLE_TOOLS` incluye git tools. Nueva pestaña MCP con `McpTab` component.

- **Skills Integration**: Integración con el ecosistema skills.sh. Skills instaladas via `npx skills add <repo>@<skill> -g` se detectan automáticamente desde `~/.agents/skills/`. El contenido de las skills activas se inyecta en el system prompt del agente como guías de mejores prácticas.
- **Skills Settings UI**: Pestaña Skills en Settings para activar/desactivar skills individualmente. Persistencia en `~/.solaria/skills_enabled.json`.

### Technical
- Nuevo módulo `src-tauri/src/git.rs` — operaciones git asíncronas con `tokio::process::Command`.
- Nuevo módulo `src-tauri/src/mcp.rs` — cliente MCP con `tokio::sync::Mutex` para estado compartido Send-safe.
- Nuevo módulo `src-tauri/src/skills.rs` — parser de SKILL.md con frontmatter YAML, detección de skills instaladas.
- 40 tests backend + 11 frontend pasando.
