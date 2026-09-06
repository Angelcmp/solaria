# Auditoría de Pruebas — Solaria Agent v0.3.0

Fecha: 2026-05-28
Entorno: Linux / Tauri 2 / Rust + React

---

## 1. 📁 Directorio de Trabajo

| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Directorio visible en header | ✅ | Se muestra ruta completa en header y sobre input |
| Botón Explorar abre selector nativo | ✅ | Tauri dialog plugin |
| Cambiar directorio desde Settings | ✅ | Input + botón terminal + botón explorar |

---

## 2. 🧪 Git Integration

| Prueba | Resultado | Notas |
|--------|-----------|-------|
| `git_status` — estado del repo | ✅ | Muestra branch, working tree clean |
| `git_branches` — listar ramas | ✅ | Lista feature/prueba (current) y main |
| `git_log` — últimas X commits | ❌ | LLM generó `{tool_call>` (falta `<`) y sintaxis rota |
| `git_add` + `git_commit` | ❌ | LLM generó `{"name": "shell "arguments": ...}` (coma faltante entre name y arguments, espacio en vez de `,") |
| `git_diff` — diferencias | ✅ | Reportó árbol limpio correctamente |
| `git_push` — subir a remoto | ✅ | Detectó que no hay remoto configurado |
| `git_checkout` — cambiar rama | ⚠️ | Dijo que "main" no existe, pero `git_branches` la mostraba. Posible desincronización. |

### Issues detectados

1. **JSON mal formado del LLM**: El modelo genera errores de sintaxis JSON como `{"name": "shell "arguments": ...}` (falta coma) y `{tool_call>` (falta `<`). El parser actual no recupera de estos errores.
2. **Desincronización**: `git_checkout` reportó que "main" no existe, pero `git_branches` segundos antes la listaba.

---

## 3. 🔌 MCP

| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Server se conecta (punto verde) | ❌ | No probado aún |
| Tool filesystem ejecuta | ❌ | No probado aún |
| Tool GitHub ejecuta | ❌ | No probado aún |

---

## 4. 🎯 Skills

| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Skills visibles en Settings | ✅ | 10 skills instaladas listadas |
| Skill activa se refleja en respuesta | ⚠️ | Código generado visible en AgentAside pero NO en el chat central |
| Skill frontend-design activa | ✅ | El modelo usó guías de diseño |

### Issues detectados

1. **Código generado no aparece en chat central**: La respuesta final de la skill se ve en el panel lateral AgentAside con tool calls/results, pero el mensaje final en el chat central está vacío o no contiene el código.

---

## 5. 🔄 Flujo Completo

| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Crear componente + test + commit + push | ❌ | Bloqueado por errores de sintaxis JSON del LLM |

---

## Issues Prioritarios

| # | Issue | Impacto | Severidad |
|---|-------|---------|-----------|
| 1 | LLM genera JSON mal formado (comas faltantes, tags rotos) | Bloqueante — no ejecuta tools | 🔴 Alta |
| 2 | Respuesta final (código) no se muestra en chat central | UX — el usuario no ve el resultado | 🔴 Alta |
| 3 | `git_checkout` inconsistentes entre llamadas | Funcionalidad | 🟡 Media |
