# Changelog

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
