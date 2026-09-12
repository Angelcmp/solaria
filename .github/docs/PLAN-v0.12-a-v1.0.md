# Solaria — Plan de ejecución v0.12 → v1.0

> Documento de trabajo para retomar en próximas sesiones.
> Estado de lo ya hecho: ver `CHANGELOG.md` `[0.11.0]` y `AGENTS.md` (sección v0.11).
> Última actualización: 2026-09-12.

## Visión

Solaria v1.0 es un **harness de agente de código de escritorio, libre (MIT), BYO-model**: funciona con cualquier LLM local (Ollama, LM Studio, vLLM, llama.cpp) o cualquier API key (proveedores integrados o endpoints OpenAI-compatible propios). UI limpia y multiplataforma, I/O de documentos y capacidad de trabajar de forma autónoma.

## Estado tras v0.11 (completado)

- Motor agnóstico de modelo (proveedores custom con Base URL/auth/headers; Ollama remoto).
- Function calling nativo en OpenAI-compatible, Anthropic, Google y Cohere.
- Registro central de modelos con capacidades (`src/lib/models.ts`).
- Primitivo de permisos (`src/agent/permissions.ts`) con confirmación real y gate de escritura.
- Verificación: `tsc` limpio, `npm test` 32, `cargo test` 18 lib + 23 + 13, `npm run build` OK.

### Archivos clave tocados en v0.11

| Área | Archivos |
|---|---|
| Proveedores backend | `src-tauri/src/providers.rs`, `src-tauri/src/ollama.rs` |
| Native FC | `src-tauri/src/native_tools.rs` (nuevo), `src-tauri/src/lib.rs` (módulo + comandos) |
| Proveedores frontend | `src/hooks/useSettings.ts`, `src/hooks/useChat.ts`, `src/hooks/useAgent.ts`, `src/App.tsx`, `src/components/SettingsPanel.tsx` |
| Permisos | `src/agent/permissions.ts` (nuevo), `src/hooks/useAgent.ts`, `src/components/ProgressPanel.tsx`, `src/App.tsx` |
| Registro de modelos | `src/lib/models.ts` (nuevo), `src/App.tsx`, `src/components/SettingsPanel.tsx` |
| Tests | `src-tauri/tests/provider_config.rs`, `src-tauri/tests/tool_execution.rs`, `src/test/permissions.test.ts`, `src/test/models.test.ts` |
| Docs/versión | `CHANGELOG.md`, `AGENTS.md`, `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |

---

## v0.12 — Harness autónomo

**Objetivo:** que el agente resuelva tareas de código de varios pasos de forma autónoma y segura, como un harness de escritorio.

### 1. Tool `shell` (con permisos)
- [ ] Nuevo tool `shell` en `src-tauri/src/tools.rs`: ejecuta comando con `cwd` fijado al workspace, timeout configurable, captura stdout/stderr y devuelve salida truncada.
- [ ] Allowlist/denylist de comandos y bloqueo de operadores peligrosos (`rm -rf /`, `sudo`, pipes a shell externos) — decisión de diseño pendiente.
- [ ] Modos por tool: `auto` / `ask` / `deny` (reutilizar `ToolPolicy` de `src/agent/permissions.ts`).
- [ ] Registrar en la lista de tools del backend y en `list_tools`.
- [ ] Tests de integración: comando permitido, denegado, timeout y jail de cwd.
- **Archivos:** `src-tauri/src/tools.rs`, `src-tauri/src/lib.rs`, `src/lib/tools.ts`, `src/hooks/useAgent.ts`.
- **Riesgo:** inyección de prompt → el gate de permisos y el jail deben estar operativos ANTES de exponer `shell`.

### 2. Motor de permisos por herramienta
- [ ] Extender `useAgent.requiresPreConfirmation` para consultar políticas por tool (hoy solo `write_file` + `confirmWrite`).
- [ ] UI en Configuración → Agente para fijar política por herramienta.
- [ ] Registro de auditoría de comandos ejecutados (reutilizar `audit`).

### 3. Tool calls en paralelo
- [ ] `useAgent.streamLLM` hoy usa `nativeCalls[0]`; ejecutar todas las tool calls de una iteración (en paralelo cuando sean independientes) y devolver todos los resultados.
- [ ] Enviar el par assistant(con todas las tool_calls)/tool(una por id) en el formato correcto por proveedor.
- [ ] Tests.

### 4. Plan/todo real y Progress N of M
- [ ] Definir tool `update_plan` (lista de pasos con estado `pending`/`in_progress`/`done`).
- [ ] Parsear el plan del agente y alimentar `ProgressPanel` (hoy `doneCount`/`totalCount` derivan de tool_call/tool_result).
- [ ] Mostrar checkmarks de pasos completados.
- **Archivos:** `src/hooks/useAgent.ts`, `src/components/ProgressPanel.tsx`, `src/lib/tools.ts`, backend tool.

### 5. Gestión de contexto
- [ ] El loop resetea el historial a `[user, assistant]` al terminar (`useAgent.ts`); mantener historia persistente por conversación con token budget.
- [ ] Compactación/resumen cuando el contexto supere el umbral (usar `context` del registro de modelos).
- [ ] Ampliar `maxIterations` y permitir continuación.

### 6. Sub-agentes
- [ ] Herramienta para lanzar sub-tareas con contexto aislado y merge del resultado.
- [ ] Límite de profundidad y de tokens.

### 7. Fix MCP
- [ ] `mcprs::call_mcp_tool` nunca lee la respuesta (`mcp.rs:173`); implementar lectura y exponer las tools MCP al registro del agente.
- [ ] Tests.

### Criterios de aceptación v0.12
- El agente completa una tarea de código multi-paso respetando las políticas de permisos.
- `shell` no ejecuta nada sin aprobación cuando la política es `ask`, y nunca fuera del workspace.
- Tool calls en paralelo y `update_plan` reflejado fielmente en el panel.
- `tsc`, `npm test`, `cargo test` verdes.

---

## v0.13 — UI limpia y multiplataforma

**Objetivo:** diseño más limpio y sencillo, consistente en Windows/macOS/Linux.

- [ ] **Design tokens como fuente única** (`src/index.css`): erradicar los 500+ hex hardcodeados.
- [ ] **Primitivas compartidas**: Button, Modal, Dropdown/Menu, Tooltip, Input, Spinner, set de iconos (hoy hay dropdowns/modales duplicados en `GeneralWorkspace`, `Chat`, `ModelPicker`).
- [ ] **App shell**: titlebar custom (win/linux/macos), menú nativo en macOS, safe-area.
- [ ] **Fuentes empaquetadas** (IBM Plex + JetBrains Mono self-hosted) y CSP actualizada (hoy `font-src 'self'` bloquea Google Fonts, `index.html:8`).
- [ ] **Store central** (p. ej. Zustand) + persistencia; desmontar el god-component `App.tsx` (hoy ~30 props a `WorkspaceAside`, 24 a `Chat`).
- [ ] **Vistas/routing reales**: Chat, Workspace/Proyectos, Documentos, Settings.
- [ ] Dividir `SettingsPanel.tsx` (~2.5k líneas) por tabs; eliminar código muerto (`securityProfile`, `ollamaTimeout`, prev/next wiki) y duplicados (`AgentStep`≡`ConversationStep`).
- [ ] Responsive hasta 800px, navegación por teclado, focus trap.
- [ ] **i18n es/en completo**: eliminar strings hardcodeados en `GeneralWorkspace`, `SettingsPanel`, `ProgressPanel`, `ModelComparator`.

### Criterios de aceptación v0.13
- Sin duplicados ni código muerto; tokens usados en toda la app.
- UI consistente en los 3 OS; cobertura es/en.

---

## v1.0 — Documentos + release

**Objetivo:** producto vendible con I/O de documentos.

- [ ] **Adjuntos**: sniffing MIME, multi-selección, límites, drag&drop + picker, y soporte en el path del agente (hoy `App.tsx:354` los ignora en modo agente).
- [ ] **`read_document`** backend: PDF (`pdf-extract`/`lopdf`), DOCX (`docx-rs`), XLSX (`calamine`); imágenes → multimodal u OCR opcional.
- [ ] **Multimodal real**: partes de imagen en OpenAI/Anthropic/Gemini/Ollama (hoy el contenido es `String` en todo el pipeline).
- [ ] **Export nativo**: PDF (`printpdf`/`genpdf`), DOCX (`docx-rs`) y markdown; UI de gestión de documentos (listar, abrir carpeta, re-exportar).
- [ ] Reposicionar templates/docs al agente de código; actualizar `README.md`, `SECURITY.md` (hoy desactualizado), `ROADMAP.md`, `AGENTS.md`.
- [ ] CI en las 4 plataformas, tests, release v1.0.

### Dependencias nuevas (Rust)
`printpdf`/`genpdf`, `docx-rs`, `calamine`, `pdf-extract`/`lopdf`, `base64`, `infer`, `image` (+ `tesseract` opcional); Tauri `plugin-os` y `plugin-fs` según titlebar/jail; actualizar `src-tauri/capabilities/default.json` y CSP.

### Criterios de aceptación v1.0
- Adjuntar PDF/DOCX/XLSX/PNG de punta a punta en chat y agente; exportar PDF/DOCX; CI verde.

---

## Backlog posterior (v1.1+)

- [ ] Selección explícita de idioma del agente en el prompt.
- [ ] Skills premium por industria / marketplace.
- [ ] Memoria semántica mejorada y búsqueda de documentos generados.
- [ ] Integración WhatsApp Business.
- [ ] Multi-usuario / licencias (si aplica al pivote).

---

## Deuda técnica y bugs conocidos

- [ ] `CHANGELOG.md` tiene un bloque `[Unreleased]` obsoleto (fusionar con `[0.9.0]`).
- [ ] Tags locales solo llegan a `v0.9.5`; ejecutar `git fetch --tags` (los releases remotos existen hasta 0.10.1).
- [ ] `SECURITY.md` describe shell/allowlist/Docker eliminados; actualizar.
- [ ] `AnthropicChatMessage` solo se usa en el path no-stream; revisar si se puede unificar.
- [ ] `useAgent` resetea el historial al completar (`useAgent.ts`), limita a una tool call/iteración y a `maxIterations=10`.
- [ ] `ollama` no usa function calling nativo (habilitar por capacidad de modelo en v0.12).

## Notas de diseño (mantener)

- Paleta Solaria: teal `#00E5C9` y dorado `#DCB263` **solo** como tintes de fondo o texto de estado; nunca en bordes/strokes/glows.
- Bordes neutros `rgba(255,255,255,0.06–0.08)`, hover `bg-[rgba(255,255,255,0.04)]`.
- Iconografía SVG inline adaptada a la paleta; sin emojis.
