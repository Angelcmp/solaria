# Solaria Agent

**Tu agente de IA, local y privado.**

Solaria es un agente de inteligencia artificial que corre directamente en tu computadora. Sin cuentas, sin nube, sin enviar tus datos a nadie. Habla con modelos locales vía Ollama o conecta tus propias API keys de OpenAI, Anthropic, DeepSeek, Kimi y más. Activa el modo agente y deja que la IA ejecute comandos, explore archivos y automatice tareas por ti.

---

## Nuestra Visión

Solaria Agent nació con una idea simple: **hacer que la inteligencia artificial sea útil y accesible para todos.**

No queremos que la IA reemplace tu pensamiento, sino que lo potencie. Que puedas hacer en segundos lo que antes tomaba horas. Que tengas el control total sobre tus datos, tus modelos y tu experiencia.

Creemos en una IA que:
- **Respete tu privacidad** — tus conversaciones nunca salen de tu equipo sin tu consentimiento
- **Sea transparente** — sabes exactamente qué modelo está procesando tus datos y dónde

---

## Capturas

> *(Agrega aquí capturas de la interfaz)*

---

## Características

| | |
|---|---|
| **🤖 Chat con IA** | Conversaciones con modelos locales (Ollama) o cloud (BYOK) |
| **🔧 Modo Agente** | La IA ejecuta comandos shell, lee/escribe archivos, busca en tu código |
| **🔒 100% privado** | Sin cuentas, sin telemetría, sin servers. Tus datos se quedan donde tú decides |
| **🌐 Búsqueda web** | Conecta Tavily para que la IA busque información actualizada |
| **📚 Templates** | 40+ plantillas de prompt para código, escritura, análisis, traducción |
| **🎨 Markdown nativo** | Las respuestas se renderizan con syntax highlighting, tablas y código |
| **🔄 Historial persistente** | Las conversaciones se guardan localmente en tu navegador |
| **🧠 Memoria persistente (RAG)** | El agente recuerda conversaciones previas y archivos de proyecto. Ver [MEMORY.md](./MEMORY.md) |

## Privacidad

**Tus datos son tuyos.**

No usamos tus conversaciones para entrenar modelos de IA. Tus chats se quedan en tu dispositivo y nunca se almacenan en nuestros servidores sin tu permiso explícito.

| Qué pasa con tus datos | Solaria |
|------------------------|---------|
| Conversaciones | Se guardan en localStorage (tu navegador/disco) |
 | API keys | Se almacenan localmente, solo se envían al proveedor que elijas |
| Telemetría | Cero. No hay analytics, no hay tracking |
| Cuentas | No necesitas registrarte ni crear cuenta |
| Código abierto | El código es transparente, puedes auditarlo tú mismo |

---

## Requisitos

- **Node.js** >= 18
- **Rust** (via [rustup](https://rustup.rs/))
- **Tauri CLI**: `cargo install tauri-cli --version "^2.0"`
- **Dependencias del sistema** (Linux):

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

> Para macOS y Windows, consulta [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

---

## Instalación

### Rápida (recomendada)

```bash
curl -fsSL https://raw.githubusercontent.com/Angelcmp/solaria/main/scripts/install.sh | bash
```

El script instala automáticamente Rust, Node.js, dependencias del sistema, clona el repositorio y compila Solaria.

### Manual

```bash
# Clonar
git clone https://github.com/Angelcmp/solaria
cd solaria

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (levanta automáticamente Vite en localhost:1420)
npm run tauri dev

# Build para producción (frontend embebido, no requiere servidor local)
npm run tauri build
```

> Si al ejecutar `solaria` (modo GUI) ves `Could not connect to localhost: Connection refused`, asegúrate de haber corrido primero `npm run tauri build` para generar un binario de producción, o usa `npm run tauri dev` que levanta el servidor de desarrollo automáticamente.

Una vez compilado, el binario `src-tauri/target/release/solaria-agent` se puede ejecutar directamente desde la terminal:

```bash
# GUI (se forkea al fondo; requiere un entorno gráfico)
./src-tauri/target/release/solaria-agent

# Configura tu API key (OpenAI, Anthropic, etc.)
./src-tauri/target/release/solaria-agent set-key openai sk-...

# Chat one-shot (por defecto usa OpenAI gpt-4o-mini)
./src-tauri/target/release/solaria-agent ask "resume este archivo"

# Agente de investigación sobre el directorio actual
./src-tauri/target/release/solaria-agent agent "investiga este proyecto" --dir .

# Daemon con pid file
./src-tauri/target/release/solaria-agent serve
```

También puedes usar el wrapper `scripts/solaria` desde el repo, que usa el directorio actual como `--dir` por defecto:

```bash
./scripts/solaria set-key openai sk-...
./scripts/solaria agent "encuentra todos los TODOs"
./scripts/solaria ask "explica este código"
```

Los instaladores se generan en `src-tauri/target/release/bundle/`:
- **Linux**: `.deb` (Debian/Ubuntu) y `.AppImage`
- **Windows**: `.msi`
- **macOS**: `.dmg`

---

## Proveedores de IA

### Local (sin conexión)
| Proveedor | Modelos recomendados |
|-----------|---------------------|
| Ollama | Qwen3.5, Llama3.2/3.1, DeepSeek-R1, Mistral, Gemma3/4, Phi3 |

### Cloud (trae tu propia API key)
| Proveedor | Modelos recomendados |
|-----------|---------------------|
| OpenAI | GPT-4o, GPT-4o-mini, o1, o3-mini |
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.7 |
| DeepSeek | DeepSeek V4 Flash, V4 Pro |
| Kimi (Moonshot) | Kimi K2.6, K2-0905 Preview |
| Google | Gemini 2.0 Flash, 1.5 Pro, 2.5 Pro Preview |
| Groq | Llama 3.3 70B, Llama 4 Scout |
| Cohere | Command R7B, R+ |
| GLM (Z.AI) | GLM 4.7, 4.7 Flash, 4.5 |

---

## Modo Agente

Activa el agente con el botón `[🤖 AGENT]` en el input de chat. El modelo puede ejecutar herramientas directamente en tu sistema:

### Herramientas disponibles

| Herramienta | Descripción | Ejemplo |
|-------------|------------|---------|
| `shell` | Ejecuta comandos en la terminal | `ls -la`, `git status`, `npm install` |
| `read_file` | Lee el contenido de archivos | Revisar logs, código fuente, configs |
| `write_file` | Escribe o modifica archivos | Crear scripts, editar configuraciones |
| `glob` | Busca archivos por patrón | `**/*.ts`, `src/**/*.rs` |
| `grep` | Busca texto dentro de archivos | Encontrar funciones, TODO, errores |

Puedes configurar las herramientas permitidas y el directorio de trabajo en **Settings > Agente**.

### Desde la terminal

El mismo binario `solaria` (o `solaria-agent`) incluye un modo CLI. Por defecto usa **OpenAI** (`gpt-4o-mini`), así que no necesitas tener Ollama corriendo:

```bash
# Guardar tu API key (solo una vez)
solaria set-key openai sk-...

# Ejecutar el agente desde el directorio actual
solaria agent "revisa el código y sugiere mejoras"

# Especificar directorio, proveedor y modelo
solaria agent "documenta este proyecto" --dir ./docs --provider anthropic --model claude-3-5-sonnet-20241022

# Usar una API key sin guardarla
solaria agent "investiga esto" --api-key sk-...

# Preview de herramientas sin ejecutarlas
solaria agent "borra los archivos temporales" --dry

# Chat one-shot (también acepta stdin vía pipe)
solaria ask "¿qué hace este proyecto?"
cat README.md | solaria ask "resume esto"
```

Flags disponibles: `--provider`, `--model`, `--api-key`, `--host`, `--dir`, `--dry`.

> Para usar un modelo local (Ollama), añade `--provider ollama --model <modelo> --host http://localhost:11434`.

---

## Arquitectura

```
solaria-desktop/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Chat.tsx              # Panel central de mensajes
│   │   ├── AgentAside.tsx        # Panel lateral del agente (pasos)
│   │   ├── WorkspaceAside.tsx    # Panel lateral de conversaciones
│   │   ├── SettingsPanel.tsx     # Panel de configuración
│   │   └── TemplateSelector.tsx  # Selector de plantillas
│   ├── hooks/
│   │   ├── useChat.ts            # Estado y lógica del chat
│   │   ├── useAgent.ts           # Loop del agente y herramientas
│   │   └── useSettings.ts        # Configuración persistente
│   └── lib/
│       ├── Markdown.tsx          # Renderizador Markdown con sintaxis
│       ├── tools.ts              # Definiciones de herramientas
│       └── templates.ts          # 40+ plantillas de prompt
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── lib.rs                # Comandos Tauri (IPC)
│   │   ├── providers.rs          # 8 proveedores de IA
│   │   ├── ollama.rs             # Conexión con Ollama
│   │   ├── search.rs             # Búsqueda web (Tavily)
│   │   └── tools.rs              # Ejecución de herramientas
│   └── Cargo.toml
└── package.json
```

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| Desktop | Tauri 2 (Rust) |
| Backend IA | Rust con reqwest, tokio, serde |
| Modelos locales | Ollama (cualquier modelo) |
| Modelos cloud | OpenAI, Anthropic, DeepSeek, Groq, Google, Cohere, Kimi, GLM |
| Búsqueda web | Tavily API |

---

## Seguridad

Revisa [SECURITY.md](./SECURITY.md) para el análisis completo de riesgos: inyección de prompts, ejecución de comandos, acceso a archivos, XSS, CSP y API keys.

---

## Licencia

MIT

```
MIT License

Permiso otorgado, sin costo, a cualquier persona que obtenga una copia
de este software y archivos de documentación asociados para usar,
copiar, modificar, fusionar, publicar, distribuir, sublicenciar
y/o vender copias del Software.

El software se proporciona "TAL CUAL", sin garantía de ningún tipo.
Ver el archivo [LICENSE](./LICENSE) para más detalles.
```

---

Construido con [Tauri](https://tauri.app/), [React](https://react.dev/) y [Rust](https://www.rust-lang.org/).
