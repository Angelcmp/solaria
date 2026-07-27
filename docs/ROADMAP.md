# Solaria Roadmap

## Visión

Solaria es un asistente inteligente de escritorio pensado para **micro y pequeñas empresas de Panamá**. Corre en la computadora del usuario, habla español nativo, entiende el contexto legal/fiscal panameño y no requiere suscripción mensual. La meta es llevar a las empresas informales al mundo formal reduciendo la brecha de costos y complejidad: contratos, trámites, investigación y organización administrativa al alcance de un par de clics.

## Audiencia objetivo

| Perfil | Precio | Necesidad principal |
|---|---|---|
| **Emprendedor** | $19.99 | Formalización básica: RUC, contratos simples, preguntas frecuentes, lectura de documentos. |
| **Micro-empresario** | $49.99 | Operación comercial: contratos completos, exportación de documentos, memoria, agente de investigación. |
| **Profesional independiente** | $99.99 | Productividad avanzada: skills especializadas, modo offline, comparador de modelos, soporte dedicado. |

## Principios de diseño

- **Modo oscuro único**. Paleta intacta: `#131313`, `#1C1B1B`, `#2A2A2A`, `#0F0F0F`, `#00E5C9`, `#DCB263`, `#E5E5E5`, `#999999`.
- **Iconografía SVG inline**. Cada icono debe estar adaptado a la paleta (`stroke="#00E5C9"`, `#DCB263`, `#999999`, etc.). **No emojis ni iconos genéricos del sistema**. Los iconos son de 12px en cards de agente, 14px en tabs, 10px en meta.
- **Flat, espacioso, content-first**. Igual que el rediseño visual v0.9.0.
- **Cloud-first, local opcional**. El modo simple usa APIs de nube (OpenAI, Anthropic, Google). El modo privado con Ollama es opcional avanzado.
- **Sin suscripción**. Pago único. Ingresos recurrentes vienen de upgrades mayores y skills premium.

## Fases de lanzamiento

### v0.9.0 — Rediseño base (en curso)

Meta: interfaz moderna, estable y preparada para comercializar.

- [x] Rediseño de Chat (burbujas 70%, input prominente, code blocks, timeline de herramientas)
- [x] ResearchAside con tabs de Proceso/Documento/Referencias
- [x] ArtifactCard para reportes `.md`
- [x] SettingsPanel reorganizado: General, API Keys, Agente, Skills, Avanzado
- [x] Agente configurado con cards estilo StepCard (herramientas, parámetros colapsables, comparador)
- [x] Eliminación del workspace Legal
- [x] Corrección de bugs: templates (`Chat.tsx` template literal), skills auto-activate
- [x] Version bump a v0.9.0
- [ ] Sidebar estilo Codex (Search + Workspace + Fijados + Recientes + Proyectos + Archivados)
- [ ] Dashboard informativo en Workspace
- [ ] Sección Documentos generados

### v1.0.0 — Lanzamiento comercial Panamá

Meta: producto mínimo vendible con foco en Panamá.

- [ ] Adjuntar archivos al chat (PDF, imágenes, .docx, .xlsx, .pptx)
- [ ] Comando backend `read_document` para extraer texto de PDFs/Office
- [ ] Soporte multimodal para imágenes (GPT-4V / Claude Vision / Gemini)
- [ ] Exportar documentos a PDF y DOCX (`export_document` backend)
- [ ] Templates inteligentes con formularios (prototipo: Contrato de Arrendamiento)
- [ ] Biblioteca de templates legales panameños (20+)
- [ ] Inyección de legislación panameña en systemPrompt de templates
- [ ] Auto-updater vía `solariam.im/api/updates/latest.json`
- [ ] Landing page de venta conectada a solariam.im
- [ ] Flujo de activación por licencia (validación en backend)

### v1.1.0 — Skills y memoria mejoradas

- [ ] Marketplace/skills premium por industria (legal, contable, salud, comercio)
- [ ] Memoria semántica mejorada con indexación de proyectos
- [ ] Sugerencia inteligente de templates según contexto del chat
- [ ] Historial de documentos generados con búsqueda
- [ ] Integración básica con WhatsApp Business (exportar respuestas)

### v2.0.0 — Enterprise y multi-usuario

- [ ] Licencias multi-usuario para despachos y clínicas
- [ ] Roles y permisos (admin, editor, viewer)
- [ ] Base de conocimiento compartida por equipo
- [ ] Modo servidor/headless para empresas grandes
- [ ] Integraciones: facturación electrónica, calendario, correo

## Priorización técnica

| Feature | Valor de negocio | Esfuerzo | Prioridad |
|---|---|---|---|
| Exportar PDF/DOCX | Alto | Alto | v1.0 |
| Templates con formularios | Alto | Medio | v1.0 |
| Adjuntar PDF/Office/imágenes | Alto | Alto | v1.0 |
| Sidebar estilo Codex | Medio | Medio | v0.9 |
| Auto-updater | Medio | Bajo | v1.0 |
| Skills premium | Medio | Medio | v1.1 |
| Multi-usuario | Alto | Alto | v2.0 |

## Dependencias

- `tauri-plugin-updater` para actualizaciones.
- `pdf-extract` o `lopdf` para PDFs.
- `docx-rs` / `calamine` / `pptx-rs` para Office.
- `printpdf` o `genpdf` para exportación PDF.
- Backend en `solariam.im` para validación de licencias y updates.

## Métricas de éxito

| Métrica | Objetivo v1.0 (3 meses) |
|---|---|
| Instalaciones completadas | >500 |
| Conversaciones por usuario activo/semana | >3 |
| Documentos generados/semana | >50 en total |
| Tasa de recomendación (boca a boca) | >30% |
| Ingresos | >$2,500 USD |
