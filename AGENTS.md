# Solaria — Session Progress

## Última sesión (2026-07-26)

### Completado — Polish v0.9.0

- **Chat central**: se agregaron `AttachmentCard`, `AssistantMessage`, `CollapseToggle`, indicador de streaming con cursor parpadeante y glow, status bar "Escribiendo... N KB recibidos", botones copiar/regenerar.
- **Adjuntos de archivos**: el type `Message` se extendió con `attachments?: MessageAttachment[]`, `sendMessage` propaga attachments, se muestran como file cards en burbuja del usuario.
- **Colapsar respuestas largas**: las respuestas del asistente con más de 8 líneas o 800 caracteres tienen toggle "Mostrar más / Mostrar menos".
- **Fix sidebar overflow**: los dropdowns de conversaciones ahora se renderizan con `createPortal` a `document.body` para evitar clipping. Wrapper principal cambiado a `overflow-visible`.
- **Emojis reemplazados**: se eliminaron todos los emojis de la UI (`⏺` → `BulletIcon`, etc.). Solo quedan en CLI de Rust (`✅`, `⚠️`).
- **Bug template literal**: corregidos `alert()` en `handleFilesSelected` que usaban comillas simples en vez de backticks, no interpolaban `file.name`.
- **Verificación**: `tsc --noEmit`, `npm test`, `cargo test`, `npm run build` pasan sin errores.

### Pendiente (próxima sesión)

1. **Prototipo de template con formulario inteligente** — `TemplateForm` para "Contrato de Arrendamiento" en Panamá.
2. **Adjuntos de PDF/imágenes/Office** — parsear PDFs, mostrar previews, exportar a PDF/DOCX.
3. **Sidebar estilo Codex** — secciones colapsables: Search, Workspace (Dashboard, Documentos, Skills, Configuración), Fijados, Recientes, Proyectos, Archivados.
4. **Auto-updater** — integración con backend `solariam.im` para actualizaciones automáticas.
