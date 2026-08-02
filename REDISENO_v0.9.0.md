# Rediseño Visual Solaria v0.9.0 — Plan de Implementación

> Inspiración: Claude · GitHub Copilot/Codex · Cursor AI  
> Paleta Solaria intacta: `#131313` `#00E5C9` `#DCB263` `#1C1B1B` `#2A2A2A`

---

## Filosofía del cambio

Migrar de una estética "chat app tradicional" (burbujas densas, input pequeño, packing apretado) a una interfaz **flat, espaciosa, content-first**, donde los mensajes respiran, el input es prominente, y los pasos del agente se ven como un dashboard de investigación profesional.

**Lo que no cambia:** paleta completa, fuente IBM Plex Sans, modo oscuro único, logo Solaria, gradient teal-gold del botón enviar, colores de syntax highlighting, scrollbar estilizada.

---

## Decisiones de diseño confirmadas

| Decisión | Valor elegido |
|----------|---------------|
| Burbujas de usuario | `max-w-[70%]` (mantener formato burbuja, mejorado) |
| Tool calls visuales | Resumen minimal en chat central, timeline detallado en **ResearchAside** |
| Números de línea en code blocks | **Sí** |
| Artifact Card para reportes `.md` | **Prioridad** |
| ResearchAside width | `480px` → **`420px`** |
| Avatar del asistente | Logo SVG existente de Solaria |

---

## Fases de implementación

### Fase 1 — Layout base y espaciado

| Cambio | Actual | Nuevo |
|--------|--------|-------|
| Chat width | `max-w-[800px]` | `max-w-[880px]` |
| Padding lateral | `px-4` (16px) | `px-8` (32px) |
| Header | `border-b` + `backdrop-blur-[12px]` | **Sin border-b** + `backdrop-blur-[16px]` |
| Header padding | `py-1.5` | `pt-3 pb-2` (más aire) |
| ResearchAside | `w-[480px]` | `w-[420px]` |

**Archivos:** `src/App.tsx`, `src/components/Chat.tsx`

---

### ✅ Fase 2 — Mensajes mejorados (burbujas 70%)

#### Burbuja de usuario

| Propiedad | Valor |
|-----------|-------|
| Max-width | `70%` (mantener) |
| Alineación | Derecha |
| Fondo | `bg-[#1C1B1B]` (surface plano) |
| Borde | `border border-[rgba(255,255,255,0.08)]` |
| Texto | `text-[0.8125rem]` (13px), `text-[#E5E5E5]`, weight 300 |
| Padding | `px-4 py-2.5` |
| Border-radius | `rounded-2xl` (16px) **uniforme** (eliminar asimetría `12px_12px_4px_12px`) |
| Sin gradient dorado | Reemplazado por surface neutro |

#### Mensaje de asistente

| Propiedad | Valor |
|-----------|-------|
| Formato | **Flat** (sin burbuja) |
| Avatar | Logo SVG Solaria 16×16 a la izquierda del primer bloque de cada respuesta |
| Separación entre mensajes | `mb-6` (24px) |
| Padding interno | `pt-2 pb-1` |
| Texto | Mismo estilo Markdown, pero con más aire alrededor |

**Archivos:** `src/components/Chat.tsx`, posible ajuste en `src/index.css`

---

### ✅ Fase 3 — Input prominente

| Propiedad | Valor |
|-----------|-------|
| Border-radius | `rounded-2xl` (16px) |
| Borde | `border-[rgba(255,255,255,0.12)]` (más visible) |
| Textarea font-size | `text-[0.9375rem]` (15px) |
| Botón enviar tamaño | 36×36px (más grande) |
| Botón enviar hover | Eliminar `scale-105`. Solo sombra: `shadow-[0_0_12px_rgba(0,229,201,0.15)]` |
| Focus state | `focus-within:border-[rgba(220,178,99,0.25)]` + `shadow-[0_0_0_1px_rgba(220,178,99,0.1)]` |
| Toolbar botones | `h-7` (28px), icono + label visible (ej. "🔍 Buscar") |
| Toolbar hover | `bg-[rgba(255,255,255,0.04)]` |

**Archivos:** `src/components/Chat.tsx`

---

### ✅ Fase 4 — Code blocks profesionales

| Propiedad | Valor |
|-----------|-------|
| Fondo | `#0F0F0F` (más oscuro que chat → profundidad) |
| Borde | `rgba(255,255,255,0.08)` |
| Pre padding | `16px 18px` |
| Font-size | `0.8125rem` |
| **Números de línea** | Columna `w-8`, `text-[0.7rem]`, color `#444`, `select-none`, `pr-3 text-right` |

**Archivos:** `src/lib/Markdown.tsx`, `src/index.css`

---

### ✅ Fase 5 — Tool call timeline (ResearchAside)

#### En chat central (resumen minimal)

- Reemplazar chips inline `→ web_search` / `→ fetch_url` por **una sola línea** mientras el agente corre:
  > `⏺ Ejecutando 3 herramientas...`
- Visible solo durante ejecución activa.
- Al completar: desaparece o muestra `✅ 3 herramientas · 2 fuentes`

#### En ResearchAside → Tab "Proceso" (timeline detallado)

De lista vertical opaca a **timeline vertical** con:

| Elemento | Estilo |
|----------|--------|
| Icono de estado | ⏳ pending (dorado `#DCB263`), ✅ done (teal `#00E5C9`), ❌ error (rojo `#ef4444`) |
| Timestamp | Relativo (`hace 3s`) en `text-[0.55rem] text-[#666666]` |
| Título del paso | Tool name en `text-[0.6875rem] text-[#E5E5E5]` |
| Args | Font-mono `0.6rem`, dentro de card colapsable |
| Card | `flex items-start gap-2.5 p-3 rounded-lg bg-[#1C1B1B] border border-[rgba(255,255,255,0.06)]` |
| Borde izquierdo | `border-l-2` dorado (`tool_call`), teal (`fetch_url`), rojo (`error`) |
| Opacidad pasos viejos | `opacity-50` (no 60%) |

**Colapso inteligente:** pasos antiguos colapsados por defecto, con summary line visible:  
`⏺ 3 herramientas ejecutadas · 2 fuentes obtenidas`

**Archivos:** `src/components/Chat.tsx`, `src/components/ResearchAside.tsx`

---

### ✅ Fase 6 — Artifact Card (nuevo componente)

**Nuevo archivo:** `src/components/ArtifactCard.tsx`

Se muestra cuando el agente genera un reporte `.md` largo (detectar `write_file` con extensión `.md`).

| Propiedad | Valor |
|-----------|-------|
| Fondo | `bg-[#0F0F0F]` |
| Borde | `border border-[rgba(255,255,255,0.08)]` |
| Border-radius | `rounded-xl` (12px) |
| Padding | `p-4` |

**Estructura interna:**
- **Header:** icono documento + nombre del archivo + fecha
- **Preview:** Markdown truncado a 8 líneas con gradiente fade-out en la parte inferior
- **Footer:** botones `[Ver completo]` `[Copiar]` `[Descargar .md]`

**Integración:** Renderiza como mensaje del asistente pero con estilo diferenciado (no es chat burbuja, es artifact panel).

**Archivos:** `src/components/ArtifactCard.tsx` (nuevo), `src/components/Chat.tsx`

---

### ✅ Fase 7 — Sidebar refinada (WorkspaceAside)

| Elemento | Actual | Nuevo |
|----------|--------|-------|
| Item radius | `rounded-xl` | `rounded-lg` (8px, más plano) |
| Item activo | Borde teal + fondo | **Sin borde**, solo `bg-[rgba(0,229,201,0.06)]` |
| Texto items | `text-[0.7rem]` | `text-[0.75rem]` (12px) |
| Search input | `bg-[#222] rounded-xl` | `bg-[#1C1B1B] rounded-lg border-[rgba(255,255,255,0.06)]` |
| Colapsables | Instantáneo | **Transición suave** de altura + opacidad |

**Archivos:** `src/components/WorkspaceAside.tsx`

---

### ✅ Fase 8 — ResearchAside tabs restantes

| Tab | Mejora |
|-----|--------|
| **Documento** | Fondo `#0F0F0F`, borde sutil, estilo "viewer" aislado |
| **Referencias** | Lista compacta: favicon + dominio + status dot (`●`) + score |

**Archivos:** `src/components/ResearchAside.tsx`

---

### ✅ Fase 9 — Efectos y animaciones refinados

| Efecto | Actual | Nuevo |
|--------|--------|-------|
| `stepGlow` / `stepGlowTeal` | Siempre animado | **Desactivar en idle**, activar solo en `running` |
| Botón enviar hover glow | `20px rgba(0,229,201,0.3)` | `12px rgba(0,229,201,0.15)` |
| Steps viejos opacidad | `60%` | `50%` |
| Markdown cuerpo | `text-[0.8125rem] lh 1.8` | `text-[0.875rem]` (14px), `lh 1.7` |
| Markdown weight | 300 | **Mantener 300** |

**Archivos:** `src/index.css`, `src/lib/Markdown.tsx`

---

## Checklist de archivos a modificar

| Orden | Archivo | Fases que afecta |
|-------|---------|------------------|
| 1 | `src/index.css` | Fase 4, 9 (code blocks, animaciones, markdown) |
| 2 | `src/components/Chat.tsx` | Fase 1, 2, 3, 5 (layout, burbujas, input, resumen tools) |
| 3 | `src/components/WorkspaceAside.tsx` | Fase 7 (sidebar refinada) |
| 4 | `src/components/ResearchAside.tsx` | Fase 1, 5, 8 (width 420px, timeline, tabs) |
| 5 | `src/components/WikiAside.tsx` | Fase 1 (ajustar width si depende del padre) |
| 6 | `src/lib/Markdown.tsx` | Fase 4, 9 (números de línea, tipografía) |
| 7 | `src/components/ArtifactCard.tsx` | Fase 6 (nuevo componente) |
| 8 | `src/App.tsx` | Fase 1 (layout widths globales) |

---

## Resumen de tokens de diseño final

| Token | Valor | Uso |
|-------|-------|-----|
| `solaria-bg` | `#131313` | Fondo raíz, chat |
| `solaria-surface` | `#1C1B1B` | Sidebar, burbujas usuario, cards |
| `solaria-deep` | `#0F0F0F` | Code blocks, Artifact Card, viewer |
| `solaria-high` | `#2A2A2A` | Hover states, cards de settings |
| `solaria-gold` | `#DCB263` | Acento, badges, bordes tool calls |
| `solaria-teal` | `#00E5C9` | Acento, badges activos, links |
| `solaria-white` | `#FFFFFF` | Texto primario ocasional |
| `solaria-gray` | `#E5E5E5` | Texto principal |
| `solaria-gray-muted` | `#999999` | Texto secundario |
| `solaria-gray-dim` | `#666666` | Placeholders, inactivo |
| `solaria-border` | `rgba(255,255,255,0.08)` | Bordes estándar |
| `solaria-border-subtle` | `rgba(255,255,255,0.06)` | Bordes muy sutiles |
| `solaria-border-active` | `rgba(220,178,99,0.25)` | Focus states dorado |

---

## Notas de implementación

- **Tailwind v4:** Los estilos se aplican vía clases utility. No hay `tailwind.config.js` — la config está en `src/index.css` bajo `@theme`.
- **Tipografía:** IBM Plex Sans se mantiene. No cambiar fuente.
- **Scrollbars:** Mantener estilo actual (`4px`, thumb `#333` → `#444`).
- **Solo modo oscuro:** No agregar tema claro.
- **Backward compatibility:** Los cambios son puramente visuales; la lógica de estado no se modifica.

---

Generado: 2026-07-16  
Versión objetivo: v0.9.0
