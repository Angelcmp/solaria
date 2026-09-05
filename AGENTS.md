# Solaria — Session Progress

## Última sesión (2026-09-05)

### Completado — Instalación Linux rápida, Fase 1 (precompilados)

- **CI de releases** (`.github/workflows/release.yml` nuevo): trigger tag `v*`, runner `ubuntu-24.04` x86_64; deps del sistema + `npm ci` + `tauri build`; empaqueta tarball `solaria-<ver>-linux-x86_64.tar.gz` (binario + wrapper + icono) y publica tarball + `SHA256SUMS.txt` + `.deb`/`.AppImage` vía `softprops/action-gh-release`.
- **`install.sh` modo descarga por defecto**: `resolve_tag` (`SOLARIA_VERSION`), `asset_url`/`json_tag` (python3 o grep), `verify_checksum` contra `SHA256SUMS.txt`; `.deb` + `apt-get install -f` en apt, tarball + `install_system_deps` en el resto; `install_binary` refactorizado en `deploy_binary` + `install_wrapper`; `ICON_SRC`/`WRAPPER_SRC` parametrizables; `--from-source` conserva flujo fuente; `git` solo exigido en modo fuente.
- **`README.md`**: sección instalación reescrita (2-4 min, `SOLARIA_VERSION`, `--from-source`, update/reinstall); **`CHANGELOG.md`**: entrada `[Unreleased]`.
- **Verificación**: `bash -n`, `--help`, flag desconocido, YAML válido, parseo de release JSON (con y sin python3), checksum válido/inválido.
- **Release v0.9.1 publicado y validado al 100%** (esta sesión): PR #19 mergeado, tag `v0.9.1`, CI Release verde en 8 min (tarball + `.deb`/`.AppImage` + `SHA256SUMS.txt`); corregido sums con espacios en nombres (republicado) + match tolerante y renombre a puntos en workflow; one-liner real verificado en Ubuntu (`.deb`, checksums OK, `solaria 0.9.1` responde) y Fedora (tarball, 106s, responde). Bugs extra: `unzip` para `fnm`.
- **Benchmark multi-distro** (esta sesión, `docs/BENCHMARK.md`): harness `scripts/bench/` (mock API + tarball/`.deb` stub, `GITHUB_API` + `SOLARIA_TIMING` nuevos en `install.sh`), 5 distros en podman en frío: Ubuntu 60s, Debian 85s, Fedora 75s, Arch 70s, openSUSE TW 111s (todas OK, `solaria version` responde). Encontró y corrigió 4 bugs: fallback `http`, `pacman -Sy`, preflight sin `awk`, nombres zypper.
- **Fase 1b — reinstall inteligente + uninstall total** (`install.sh`): `installed_version()` y skip si coincide (`--force` para forzar); `stop_daemon()` (stop graceful + pkill + pid) en deploy y `.deb`; `--uninstall` borra todo (dpkg `--remove`, `/usr/bin`, wrapper, desktop, icono, repo, `~/.solaria`). E2E en podman Ubuntu: install → skip 0.1s → `--force` → uninstall sin restos.
- **Fase 2 — `solaria update` / `solaria uninstall`** (`cli.rs`, `main.rs`): `update [--check]` compara semver contra último Release y delega vía `exec` a `install.sh` (`SOLARIA_VERSION`=tag); `uninstall [--yes]` confirma interactivamente (exige `--yes` sin TTY) y ejecuta `install.sh --uninstall`. Overrides `SOLARIA_API_BASE`/`SOLARIA_INSTALL_SH_URL`. Tests unitarios de versiones OK; ayuda actualizada.
- **Siguiente**: precompilados aarch64 y/o soporte macOS.

## Sesión anterior (2026-09-04)

### Completado — CLI v0.9.0 + instalador Linux (`31401f9`, PR #18)

- **Comandos nuevos** (`cli.rs`, `main.rs`): `version` (`--version`/`-V`), `status`/`stop` vía `~/.solaria/solaria.pid` con check `/proc/<pid>` y limpieza de pid rancio.
- **`serve` con pid real**: guarda el pid del hijo daemon, detecta instancia corriendo, reporta pid file.
- **Parser en cualquier posición**: `--provider=`/`--model=`/`--api-key=`/`--host=`/`--dir=`, `-d`; resto posicional = prompt; flag desconocido → error. `ask` sin prompt solo lee stdin con pipe (no bloquea TTY).
- **Wrapper reescrito** (`scripts/solaria`): orden `/usr/local/lib/solaria/` → `~/.local/share/solaria/` → `target/release` → PATH; inyecta `--dir $PWD` solo a `ask`/`agent` tras el subcomando; respeta `--dir` explícito.
- **Instalador canónico** (`install.sh` nuevo, 414 líneas): preflight, deps por distro, clonado, `tauri build`, verify, `--debug-build`/`--skip-build`/`--skip-clone`/`--clean`/`--uninstall`; `scripts/install.sh` → shim legacy.
- **Bump 0.8.5 → 0.9.0** (`package.json`, `Cargo.toml`, `tauri.conf.json`); `README.md`: URL `install.sh`, requisitos y flags.
- **Verificación**: `CHANGELOG.md` con sección `[0.9.0]`, `README.md` CLI actualizado (esta sesión).

## Sesión anterior (2026-08-02)

### Completado — Transición suave colapsar/expandir en asides (duration-300 ease-in-out)

- **Técnica común**: contenedor único siempre montado con `style={{ width }}` + `transition-[width] duration-300 ease-in-out` + `overflow-hidden`; el contenido interno alterna visibilidad con `hidden` (wrapper de ancho fijo para no aplastar el contenido durante la animación).
- **ProgressPanel** (`ProgressPanel.tsx`): colapsar/expandir 400↔36; eliminado el swap duro `if (collapsed) return …`; tira (expandir + dot) y contenido en el mismo contenedor animado.
- **GeneralWorkspace sidebar** (`GeneralWorkspace.tsx`): colapsar/expandir `sidebarWidth`↔52; unidas las ramas `{!isCollapsed && …}`/`{isCollapsed && …}` en un solo contenedor con `overflow-hidden`; **transición desactivada durante el drag** de resize (estado `dragging`, `transition: dragging ? undefined : 'width 300ms cubic-bezier(0.4,0,0.2,1)'`) para que el ancho siga al cursor.
- **WikiListAside** (`WikiListAside.tsx` + `App.tsx`): prop `open`; render siempre montado (`open={wikiOpen}`) con ancho 320↔0; contenido lazy-load en wrapper `w-[320px]`.
- **WikiViewerAside** (`WikiViewerAside.tsx` + `App.tsx`): prop `open`; helpers `openWikiViewer`/`closeWikiViewer` con `wikiAnimOpen` (rAF al abrir) y cierre diferido 300ms (`wikiCloseTimerRef`) manteniendo el último archivo para animar la salida; ancho 600↔0.
- Se eliminó el `transition-all duration-250` muerto del sidebar (nunca animaba por el swap de ramas).
- **Verificación**: `tsc --noEmit`, `npm test` (11), `npm run build` pasan sin errores.

### Completado — SettingsPanel neutralizado (teal/dorado → escala de grises)

- **Header del panel**: engranaje `bg-[#00E5C9]/10` + `stroke="#00E5C9"` → `bg-[rgba(255,255,255,0.04)]` + `stroke="#E5E5E5"`; dot de versión `bg-[#00E5C9]/40` → `bg-[#666666]`.
- **Estados activos** (sidebar tabs, AdvancedTab sub-tabs, proveedores, chips de modelo, idioma, chips de modelo de memoria) → tinte `bg-[rgba(0,229,201,0.07/0.08/0.1)]` + `text-white`, eliminado todo `text-[#00E5C9]`.
- **ProvidersTab**: icono de provider `bg-[rgba(0,229,201,0.08)]`/`stroke="#00E5C9"` → neutro; "Configurada" dot `bg-[#00E5C9]` + texto → `bg-[#999999]` + `text-[#E5E5E5]`; link Tavily `text-[#00E5C9]` → `text-[#999999] hover:text-white`.
- **AgentTab**: resumen (`BulletIcon` dorado, iteraciones teal) → gris; iconos reloj/engranaje/estrella `stroke="#DCB263"` → `stroke="#999999"`; barra de sección `bg-[#00E5C9]` → `bg-[#666666]`; `const color` de `ToolIcon` (write teal/read dorado) → fijo `#999999`.
- **SkillsTab/SkillRow**: código install `text-[#DCB263]` + `bg-[rgba(220,178,99,0.08)]` → `text-[#E5E5E5]` + `bg-[rgba(255,255,255,0.04)]`; barras de sección → `bg-[#666666]`; dot skill enabled → `bg-[#999999]`; badge "Proyecto" → `bg-[rgba(255,255,255,0.06)] text-[#E5E5E5]`.
- **MemoryTab**: badge ON (via `SectionHeader` ya neutro), `db_path`/éxito indexado/check/barras de progreso → gris (`#E5E5E5`/`#999999`); source badges conversation/file → neutro.
- **McpTab**: dot "conectado(s)" → `bg-[#999999]`; icono y badge "Conectado" de servidor running → neutro; chips de tools → `bg-[rgba(255,255,255,0.04)] text-[#E5E5E5]`.
- **AuditTab**: dot de actividad y círculo+check de éxito → gris (rojo de error se mantiene); nombre de tool éxito `text-[#00E5C9]` → `text-[#E5E5E5]`.
- **CookbookTab**: icono de header, badges recommended/serving/CPU, GPU VRAM, descarga en curso, barra de progreso, dot de estado servido, `ollama:<model>` → gris; `StarIcon color` → `#999999`.
- **ModelManager**: mensaje de éxito `text-[#00E5C9]` → `text-[#E5E5E5]` (errores en rojo se mantienen).
- Los únicos usos de teal restantes son los tintes de fondo de estados activos `bg-[rgba(0,229,201,...)]` (restricción de diseño respetada: nunca en bordes/iconos/texto).
- **Verificación**: `tsc --noEmit`, `npm test` (11), `npm run build` pasan sin errores.

### Completado — Panel unificado Progress + ArtifactCard "Abrir en" + grises

- **Panel Progress unificado** (`ProgressPanel.tsx`, reemplaza ResearchAside): secciones Progress (N of M derivado de tool_call/tool_result, barra), Project (nombre + working folder), Archivos (writes con estado ✓/… y reads con "Mostrar en carpeta" vía `revealItemInDir`), Documentos (solo .md de write con "Abrir"), Instrucciones (`personaPrompt`), Contexto (skills vía `list_skills` + fuentes). Header con dot running (teal pulse)/stop/collapse/close; colapsado → tira 36px con botón expandir.
- **Persistencia por conversación**: `steps?: ConversationStep[]` en `Conversation` + `updateConvSteps` en `useChat.ts`; `App.tsx` guarda pasos al cambiar de conv (`handleSelectConversation`), al cerrar panel (`handlePanelClose`), y en `handleAgentComplete`; restaura al reabrir (`handlePanelOpen`). Estado `panelDismissed` por conv en localStorage `solaria-panel-dismissed` → al cerrar no se reabre sola; botón header en Chat ("Abrir panel de progreso", icono rayo) la restaura.
- **ArtifactCard estilo Codex**: prop `filePath`, icono documento neutro, sin fecha, botón `.md` (save + write_text_file), menú "Abrir en >" (En este chat / Con la app del sistema / Guardar como…), ruta propagada desde `useAgent.ts` con marcador `\n\n--- Archivo: <path>`.
- **write_file oculto en Proceso**: `toolContent?` en `AgentStep`; `toolArgs` usa placeholder `[CONTENIDO OCULTO — N caracteres]`; `extractReports` usa `toolContent`.
- **Referencias y sidebar en grises**: scoreColor/contadores/dots/URLs sin teal/dorado (error rojo semántico se mantiene); botón `+` y Abrir Markdowns gris oscuro; Skills gris con hover dorado (`group-hover`).
- **ResearchAside.tsx ELIMINADO** (sustituido por ProgressPanel).
- **Verificación**: `tsc --noEmit`, `npm test` (11), `cargo check`, `npm run build` pasan sin errores.

### Completado — Rediseño UI editorial (sidebar resizable, thinking blocks, bordes neutralizados)

- **Textarea auto-expansión a 250px**: helper `resizeInput()` (auto → min(scrollHeight, 250)) en `Chat.tsx`, llamado en `onChange` y vía `useEffect` dependiente de `[input]` para que crezca también al setear input programáticamente (templates, slash commands). `max-h-[250px]` en className.
- **Sidebar redimensionable** (`GeneralWorkspace.tsx`): estado `sidebarWidth` (default 260, clamp 200–400), persistido en `localStorage` `solaria-sidebar-width`, drag handle `cursor-col-resize` con listeners `mousemove/mouseup`, `w-[320px]` → `style={{ width }}`. Colapsado (52px) intacto.
- **Thinking blocks estilo Claude**: backend `providers.rs` emite `stream://thinking` (OpenAI `reasoning_content`, Anthropic `delta.thinking`); `useChat.ts` (Message.thinking + appendToAssistantThinking + listener); `Chat.tsx` componente `ThinkingBlock` colapsable (icono cerebro, chars, chevron, fondo neutro) renderizado antes del contenido.
- **Bordes/strokes/glows de acento neutralizados en TODOS los archivos**: teal `#00E5C9` / dorado `#DCB263` ahora SOLO como tintas de fondo o texto de estado; todos los `border-*`, `ring-*`, `focus:border-[#DCB263]`, `hover:border-[#DCB263]`, `border-[#00E5C9]/NN` → neutros `rgba(255,255,255,0.06–0.2)`; glows `stepGlow`/`stepGlowTeal` y `streaming-message::before` en `index.css` → blanco; focus shadow del input de chat → `focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]`. Glows del botón CTA con gradiente se MANTIENEN intactos.
- **Radios suavizados**: `rounded-lg` → `rounded-xl` en superficies clave (search de GeneralWorkspace/TemplateSelector, cards de ResearchAside, filas de conversación/proyecto, inputs de TemplateForm, cards de ModelComparator, surfaces de SettingsPanel).
- **Markdown.tsx**: blockquote `border-l-2 border-[#00E5C9]` → neutro; tool call chips `borderColor` → neutros (bg tint + text de acento intactos); task checkbox `border-[#00E5C9]` → neutro (fill `bg-[#00E5C9]` intacto).
- **Verificación**: `cargo check`, `tsc --noEmit`, `npm test` (11), `cargo test` (11), `npm run build` pasan sin errores.

### Pendiente (próxima sesión)

1. **Fase 2 Progress**: inyectar/parsear `<plan>` del agente para el Progress "N of M" real con checkmarks completados.
2. **Adjuntos de PDF/imágenes/Office** — parsear PDFs, mostrar previews, exportar a PDF/DOCX.
3. **Sidebar estilo Codex** — secciones colapsables: Search, Workspace (Dashboard, Documentos, Skills, Configuración), Fijados, Recientes, Proyectos, Archivados.
4. **Auto-updater** — integración con backend `solariam.im` para actualizaciones automáticas.

### Restricciones de diseño (mantener)

- Paleta Solaria intacta; acentos teal `#00E5C9` y dorado `#DCB263` SOLO como tintas de fondo (`bg-[rgba(0,229,201,0.06)]` / `bg-[rgba(220,178,99,0.08)]`), nunca en bordes/strokes/glows. Acentos SÍ permitidos como `text-[#00E5C9]` en badges/estados activos y como `fill`/`stroke` de iconos SVG, pero nunca como borde.
- Bordes neutros `rgba(255,255,255,0.06–0.08)`, hover `bg-[rgba(255,255,255,0.04)]`, inputs `bg-[#0F0F0F]`, botón CTA con gradiente existente intacto (sus glows hover se mantienen).
