# Seguridad

## Visión general

Solaria ejecuta código local en tu máquina y se conecta a servicios externos (APIs de IA) bajo tu control. Este documento describe los riesgos identificados y las medidas implementadas.

---

## Riesgos identificados

### 1. Inyección de prompts (Prompt Injection)

**Riesgo:** Un usuario malintencionado podría engañar al modelo para que ejecute comandos peligrosos mediante instrucciones camufladas en el contenido que el agente procesa.

**Medidas implementadas:**
- El system prompt del agente instruye explícitamente al modelo a **nunca ignorar las reglas de seguridad**
- Las herramientas permitidas se configuran manualmente en Settings > Agente
- Antes de ejecutar cualquier comando peligroso, se muestran botones **Allow / Deny** en el panel AgentAside
- El usuario puede activar el modo **auto-confirm** para saltar las confirmaciones (bajo su responsabilidad)
- **Command allowlist**: modo whitelist donde solo se permiten comandos específicos (`ls`, `cat`, `git`, `npm`, etc.)
- Se puede activar el modo **restringir al directorio de trabajo** para bloquear accesos fuera de la carpeta configurada

---

### 2. Ejecución de comandos shell (Shell Injection)

**Riesgo:** La herramienta `shell` ejecuta comandos con `sh -c`. Si el modelo construye un comando peligroso, podría dañar el sistema.

**Medidas implementadas:**
- **Denylist de comandos peligrosos** en el backend (`tools.rs`): bloquea `rm -rf /`, `sudo`, `chmod 777`, `curl | bash`, fork bombs, etc.
- **Command allowlist**: permite restringir el shell a solo comandos de una lista blanca configurable
- **Confirmación Allow/Deny**: cualquier comando que coincida con el denylist pausa el agente y pide autorización
- **Rate limiting**: límite configurable de herramientas por minuto (evita abusos accidentales)
- **Session timeout**: bloquea el input del agente tras X minutos de inactividad
- El usuario ve **cada comando en tiempo real** en el panel AgentAside antes de que se ejecute

---

### 3. Acceso a archivos (Path Traversal)

**Riesgo:** `read_file` y `write_file` aceptan rutas absolutas. Un ataque podría leer archivos sensibles del sistema.

**Medidas implementadas:**
- **Bloqueo de rutas sensibles**: `/etc/shadow`, `/etc/ssh/`, `~/.ssh/`, `/boot/`, `/dev/`, `/proc/`, `/sys/`, etc.
- **Validación contra directorio de trabajo**: si se configura un working directory, se advierte o bloquea el acceso fuera de él
- **Modo restricción estricta**: bloquea completamente el acceso a archivos fuera del working directory
- **Confirmación en escrituras**: toggle para requerir confirmación en **todas** las llamadas a `write_file`
- **Auditoría local**: todas las operaciones de archivo se registran en `~/.solaria/audit.log`

---

### 4. API keys

**Riesgo:** Las API keys ingresadas en Settings se almacenan en texto plano.

**Medidas implementadas:**
- **Keyring del sistema operativo**: las keys se guardan en GNOME Keyring / KDE Wallet / macOS Keychain / Windows Credential Manager
- **Fallback a localStorage** si el keyring no está disponible (entornos headless)
- El webview de Tauri no comparte almacenamiento con navegadores externos
- Las keys se envían exclusivamente al proveedor que el usuario configuró

---

### 5. Content Security Policy (CSP)

**Estado:** Implementado.

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; connect-src 'self' http://localhost:* https:;
font-src 'self'; frame-src 'none'; object-src 'none'
```

- `script-src 'self'` — solo scripts propios, sin inline ni eval
- `connect-src` permite conexiones a localhost (Ollama) y cualquier HTTPS (APIs cloud)
- `frame-src 'none'` y `object-src 'none'` — previenen clickjacking y plugins
- `style-src 'unsafe-inline'` — necesario para Tailwind CSS (inline styles)

---

### 6. XSS via Markdown

**Estado:** Mitigado.

- Todo el texto se escapa con `escapeHtml()` antes del renderizado (incluye `"` y `'`)
- Las URLs de links se sanitizan con `sanitizeUrl()` (solo permite `http://`, `https://`, `mailto:`, `#`)
- Los bloques de código se renderizan con HTML escapado
- Atributos `target="_blank"` y `rel="noopener noreferrer"` en todos los links externos

---

## Resumen de acciones

| Prioridad | Acción | Estado |
|-----------|--------|--------|
| 🔴 Alta | Denylist de comandos shell peligrosos | ✅ Implementado en `tools.rs` |
| 🔴 Alta | Bloquear rutas sensibles del sistema | ✅ `/etc/shadow`, `~/.ssh/`, `/proc/`, etc. |
| 🔴 Alta | Validar rutas contra directorio de trabajo | ✅ Advertencia + modo bloqueo estricto |
| 🟡 Media | Cifrar API keys en disco | ✅ Keyring del SO con fallback localStorage |
| 🟡 Media | Confirmación antes de write_file | ✅ Toggle "Confirmar escrituras" en Settings |
| 🟡 Media | Command allowlist | ✅ Lista blanca configurable |
| 🟡 Media | Rate limiting | ✅ Slider de herramientas/minuto |
| 🟡 Media | Session timeout | ✅ Bloqueo automático por inactividad |
| 🟢 Baja | Sandboxing del agente (contenedores) | ❌ Planeado |
| 🟢 Baja | Auditoría local | ✅ `~/.solaria/audit.log` |
| 🟢 Baja | CSP y XSS sanitization | ✅ Implementado |

---

## Reportar vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor abre un issue en el repositorio de GitHub. No se requiere divulgación responsable formal — este es un proyecto open source en fase temprana.
