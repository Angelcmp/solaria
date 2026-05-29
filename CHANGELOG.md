# Changelog

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
