# Roadmap — Solaria Agent v0.4.0

> Deep Research Agentic System con Skills
> Enfoque: investigación, análisis y automatización para profesionales no-code.

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

### P2 — Skills profesionales

- [ ] `market-analysis` — análisis de competencia, drafts de campañas
- [ ] `report-generator` — datos → análisis → markdown estructurado
- [ ] `meeting-notes` — notas → estructura → action items
- [ ] `data-analysis` — CSV → limpieza → transformación → presentación
- [ ] `transcription-processing` — procesar texto → resumen ejecutivo

### P3 — Skill Factory (creación de skills desde el chat)

- [ ] El usuario dice "crea una skill que haga X"
- [ ] El agente genera el SKILL.md con frontmatter y workflow
- [ ] La skill se guarda en `.solaria/skills/` del proyecto actual

### P4 — Ecosistema y mejoras

- [ ] Integración con skills.sh para descubrimiento desde el chat
- [ ] Auto-activación de skills según contexto
- [ ] Tema claro
- [ ] Exportar conversaciones (formatos: markdown, PDF)
- [ ] Mejoras en UI del panel de investigación (ResearchAside tabs)

### Bugs conocidos

- [ ] Algunos fetch_url fallan con `{"": "url"}` (key vacía) cuando el modelo genera args mal formados
- [ ] La skill deep-research necesita testing en escenarios con múltiples fuentes PDF
- [ ] El contador de pasos en AgentTab muestra números inconsistentes cuando hay tool calls sin texto LLM

---

## 4. Bugs / Deuda técnica

- [x] Template selector accesible
- [x] Migración a `tokio::process::Command`
- [x] Sistema i18n funcional
- [x] Crate name corregido
- [x] Features de código eliminadas (v0.4.0)

---

## 5. Recursos

- [Issues](https://github.com/Angelcmp/solaria/issues)
- [PRs](https://github.com/Angelcmp/solaria/pulls)
- [SECURITY.md](./SECURITY.md)
- [README.md](./README.md)
