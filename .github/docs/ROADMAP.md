# Solaria Roadmap

> **Pivote 2026-09-12:** Solaria pasa a ser un **harness de agente de código de escritorio, libre (MIT), BYO-model** — cualquier LLM local o API key. El roadmap detallado, con tareas y criterios de aceptación por versión, vive en **`PLAN-v0.12-a-v1.0.md`**.
>
> La versión anterior de este documento (asistente legal/fiscal para micro-empresas de Panamá, v0.9–v2.0) queda como histórico/comercial; el foco técnico actual es el de abajo.

## Visión

Solaria corre en la computadora del usuario, usa **cualquier modelo** (Ollama/LM Studio/vLLM/llama.cpp locales o cualquier API key, incluyendo endpoints OpenAI-compatible propios), y trabaja de forma autónoma como un harness de código de escritorio. UI limpia y consistente en Windows, macOS y Linux, con I/O de documentos. Sin lock-in de proveedor.

## Principios de diseño

- **Modo oscuro único**. Paleta: `#131313`, `#1C1B1B`, `#2A2A2A`, `#0F0F0F`, `#00E5C9`, `#DCB263`, `#E5E5E5`, `#999999`.
- **Acentos solo como tinte/estado**: teal `#00E5C9` y dorado `#DCB263` nunca en bordes/strokes/glows.
- **Iconografía SVG inline** adaptada a la paleta; sin emojis.
- **Flat, espacioso, content-first**.
- **BYO-model**: local por defecto, nube opcional.
- **Código libre (MIT)**.

## Estado y próximas versiones

| Versión | Foco | Estado |
|---|---|---|
| **v0.11** | Motor agnóstico de modelo: proveedores custom, Ollama remoto, native FC (OpenAI/Anthropic/Google/Cohere), registro central de modelos, primitivo de permisos | ✅ Completado (2026-09-12) |
| **v0.12** | Harness autónomo: `shell` con permisos, políticas por tool, tool calls en paralelo, plan/todo real, gestión de contexto, sub-agentes, fix MCP | ⏳ Pendiente |
| **v0.13** | UI limpia y multiplataforma: tokens, primitivas, app shell, store, vistas, i18n es/en | ⏳ Pendiente |
| **v1.0** | Documentos: adjuntos PDF/imágenes/Office, `read_document`, multimodal, export PDF/DOCX + release | ⏳ Pendiente |
| **v1.1+** | Skills premium, memoria, WhatsApp, multi-usuario | 🔭 Backlog |

Detalle de tareas, archivos, dependencias y criterios de aceptación: **`PLAN-v0.12-a-v1.0.md`**.

## Verificación obligatoria por versión

- Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Backend: `cargo check`, `cargo test`.
- Bump sincronizado en `package.json` = `src-tauri/Cargo.toml` = `src-tauri/tauri.conf.json` (lo valida el workflow de release).
- Entrada en `CHANGELOG.md` + resumen en `.github/docs/AGENTS.md`.

## Histórico

- **v0.9.6 → v0.10.1**: auto-release desde `main`, keyring por SO, updater Linux, parser de tool_calls robusto, native function calling OpenAI-compatible, fix de `glob`.
- **v0.9.1 → v0.9.5**: instaladores y updater para Linux x64/ARM, macOS ARM y Windows x64; GUI-only.
- **v0.9.0**: rediseño UI base.
- **Roadmap Panamá original**: conservado en `ROADMAP-v0.8.1.md` y `SALES_PITCH.md`.
