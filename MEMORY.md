# Memoria Persistente (RAG) — v0.8.0

> A partir de v0.8.0, Solaria incluye un sistema de memoria persistente con búsqueda vectorial que permite al agente recordar conversaciones previas y archivos de proyecto.

## ¿Qué es?

El sistema de memoria convierte texto (mensajes de chat, archivos) en **embeddings** (representaciones numéricas semánticas) y los guarda en una base de datos vectorial local. Antes de cada nueva pregunta, Solaria busca los chunks más relevantes y los inyecta automáticamente en el contexto del modelo como "memoria de referencia".

**Resultado:** el agente puede referenciar conversaciones pasadas ("la semana pasada hablamos sobre X"), conocer tu código indexado, y dar respuestas con más contexto sin que tengas que repetir información.

## Características

- 🧠 **Embeddings locales con Ollama** — sin enviar datos a servicios externos
- ☁️ **Ollama, OpenAI, o endpoint custom** — configurable desde Settings
- 💾 **SQLite + sqlite-vec** — almacenamiento embebido, sin Docker, sin servicios
- 🔍 **Búsqueda semántica** — encuentra por significado, no por palabras exactas
- 💬 **Indexa conversaciones automáticamente** — al cerrarse se guarda en memoria
- 📁 **Indexa archivos del proyecto** — `glob` recursivo por extensión
- ⚡ **Inyección automática** — el contexto se inyecta en system prompt, transparente al usuario
- 🗑️ **Borrado total o por fuente** — control granular desde Settings

## Requisitos

Para usar embeddings necesitas **una** de estas opciones:

### Opción A: Ollama (local, recomendado)

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Descargar un modelo de embeddings
ollama pull nomic-embed-text    # 274 MB, multilingüe, alta calidad
# o alternativas:
ollama pull mxbai-embed-large   # 670 MB, mejor calidad
ollama pull all-minilm          # 46 MB, más rápido, menor calidad
```

> El modelo `nomic-embed-text` es el más usado. Funciona bien en español e inglés.

### Opción B: OpenAI (cloud)

1. Obtén una API key en [platform.openai.com](https://platform.openai.com/api-keys)
2. En Solaria > Settings > Memoria, selecciona "OpenAI" como provider
3. Ingresa tu API key
4. Modelo recomendado: `text-embedding-3-small` (mejor precio/calidad)

### Opción C: Endpoint custom

Compatible con cualquier API que siga el formato OpenAI (`/v1/embeddings`). Por ejemplo:

- [Ollama](http://localhost:11434/v1/embeddings) — modo "OpenAI-compatible"
- [vLLM](https://docs.vllm.ai/) con embeddings
- [TEI (Text Embeddings Inference)](https://github.com/huggingface/text-embeddings-inference) de HuggingFace
- [LocalAI](https://localai.io/)
- Cualquier proxy compatible

## Configuración paso a paso

### 1. Abrir Settings

Pulsa `Ctrl+,` o ve al ícono de ⚙️ en la barra lateral.

### 2. Ir al tab "Memoria"

Es el quinto tab en la lista (después de General, API Keys, Búsqueda, Skills).

### 3. Activar memoria

Toggle "Activar memoria" → ON.

Verás aparecer todas las opciones de configuración.

### 4. Elegir provider

| Provider | Mejor para | Privacidad |
|----------|------------|------------|
| **Ollama (local)** | Privacidad total, sin costos | ✅ 100% local |
| **OpenAI** | Calidad consistente, sin GPU | ⚠️ Datos van a OpenAI |
| **Custom endpoint** | Modelos self-hosted (vLLM, TEI) | ✅ Si lo alojas tú |

### 5. Configurar el modelo

- **Ollama**: escribe el nombre del modelo (ej. `nomic-embed-text`) y verifica el host
- **OpenAI**: API key + modelo (ej. `text-embedding-3-small`)
- **Custom**: URL completa (ej. `http://localhost:8080/v1/embeddings`) + API key opcional

### 6. Ajustar parámetros

- **Top K resultados** (1-20): cuántos chunks se inyectan por búsqueda. Default: 5
- **Score mínimo** (0-1): filtra resultados poco relevantes. Default: 0.7 (70% similitud)
- **Inyección automática**: si está ON, el contexto se inyecta en cada mensaje
- **Indexar conversaciones**: guarda los últimos mensajes de cada chat al cerrarse
- **Indexar archivos del proyecto**: activa el botón "Indexar proyecto"

### 7. Probar

En la sección "Probar búsqueda", escribe una consulta y pulsa Enter. Verás qué tan relevante es cada chunk encontrado (score 0-1).

## Uso

### Caso 1: recordar conversaciones pasadas

Por defecto, cada conversación se indexa automáticamente al completarse. La próxima vez que preguntes algo relacionado, el agente tendrá acceso al contexto:

> Tú: "¿Qué opinamos sobre Rust vs Go?"
> (Solaria indexa: "Rust es más seguro, Go es más simple...")
> ... 2 semanas después ...
> Tú: "Recuérdame los pros de Go"
> Solaria busca en memoria → encuentra tu conversación previa → responde con contexto

### Caso 2: indexar un proyecto

Si tienes un proyecto con código, documentos o notas:

1. Asegúrate de que `workingDirectory` del agente apunte a tu proyecto
2. En Settings > Memoria, ve al final
3. (Opcional) Configura las extensiones a indexar (default: `md, txt, rs, ts, tsx, js, jsx, py, json, yaml, yml, toml`)
4. Pulsa "Indexar proyecto"
5. Espera (depende del tamaño — toma ~1-2s por archivo)
6. Ahora el agente conoce tu codebase

Por ejemplo, después de indexar, puedes preguntar:

> "¿Qué hace el archivo `src/lib/auth.ts`?" — Solaria encuentra el archivo y lo resume

### Caso 3: prueba manual

En Settings > Memoria > "Probar búsqueda", escribe consultas para verificar que la memoria tiene lo que necesitas antes de usarlo en producción.

## ¿Dónde se guardan los datos?

```
~/.solaria/
├── memory.db          # SQLite con sqlite-vec
├── memory.db-wal      # Write-Ahead Log (transient)
├── memory.db-shm      # Shared memory (transient)
├── audit.log          # Log de herramientas del agente
└── mcp_servers.json   # Configuración de servidores MCP
```

El archivo `memory.db` es portable: puedes copiarlo entre máquinas.

Para borrarlo todo: Settings > Memoria > "Borrar toda la memoria"

## Estructura interna

### Tabla `chunks` (texto)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | Identificador único |
| `source` | TEXT | `conversation` o `file` |
| `source_id` | TEXT | ID de conversación o ruta del proyecto |
| `text` | TEXT | Contenido del chunk |
| `metadata` | TEXT | JSON con info adicional (título, ruta) |
| `created_at` | INTEGER | Unix timestamp |

### Tabla `vec_chunks` (vectorial, sqlite-vec)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER PK | FK a `chunks.id` |
| `embedding` | float[768] | Vector del embedding |

> La dimensión **768** es fija (compatible con `nomic-embed-text` de Ollama y la mayoría de modelos all-MiniLM). Si usas un modelo con otra dimensión, el backend devolverá error de dim mismatch.

### ¿Cómo funciona una búsqueda?

```
Usuario: "¿Cómo era la sintaxis de Result en Rust?"

1. Frontend (useMemory.search):
   - Convierte el query a embedding vía Ollama
   - Llama a Tauri command `memory_search`

2. Backend (memory::MemoryStore::search):
   - SELECT con `MATCH vec_f32(embedding)` ORDER BY distance LIMIT 5
   - sqlite-vec hace KNN search en vec_chunks
   - JOIN con chunks para obtener el texto
   - Devuelve 5 resultados ordenados por distancia

3. Frontend (useMemory.formatContext):
   - Formatea los resultados como:
     1. [conversación previa, relevancia 0.89]
     "El enum Result tiene dos variantes: Ok y Err..."
     
     2. [archivo: src/error.rs, relevancia 0.72]
     "pub enum Result<T, E> { Ok(T), Err(E) }..."

4. Inyección (App.tsx → runAgent/sendMessage):
   - Se añade al system prompt del LLM como "CONTEXTO RELEVANTE DE MEMORIA"
   - El LLM lo usa (o no) para enriquecer su respuesta
```

## Privacidad

- **Embeddings locales (Ollama)**: nada sale de tu equipo
- **Embeddings OpenAI**: solo el texto a indexar/consultar se envía a la API de OpenAI (no se almacena en sus servers por defecto)
- **Almacenamiento**: todo en `~/.solaria/memory.db` local
- **Transparencia**: el contexto inyectado se muestra como "CONTEXTO RELEVANTE DE MEMORIA" en el system prompt — el modelo sabe que es referencia, no instrucción

## Rendimiento

| Operación | Tiempo típico |
|-----------|---------------|
| Indexar 1 chunk (~2000 chars) | 50-200ms (Ollama) / 100-300ms (OpenAI) |
| Buscar 1 query (top 5) | 100-300ms (Ollama) / 150-400ms (OpenAI) |
| Indexar proyecto (100 archivos) | 5-30s (depende del modelo) |
| Tamaño DB | ~1MB por 1000 chunks |

## Limitaciones actuales

- **Dimensión fija**: 768. Modelos con otras dim fallan al indexar/buscar
- **Sin re-ranking**: la búsqueda es KNN puro, sin cross-encoder
- **Sin deduplicación**: chunks idénticos se guardan múltiples veces
- **Sin compresión**: embeddings se guardan como float32 raw (12KB por chunk)
- **Sin hybrid search**: solo vectorial, no BM25 ni keyword fallback
- **No hay re-index automático**: si cambias el modelo, hay que borrar y re-indexar

## API Tauri expuesta

Si quieres construir una UI custom o un plugin, estos son los comandos disponibles:

### `memory_index_text(source, source_id, text, metadata, ...)`

Indexa un texto. Lo chunkifica automáticamente si excede el límite.

```typescript
const id = await invoke<number>('memory_index_text', {
  source: 'conversation',
  sourceId: 'conv-123',
  text: 'Mensaje largo a indexar...',
  metadata: JSON.stringify({ title: 'Mi chat' }),
  provider: 'ollama',
  model: 'nomic-embed-text',
  ollamaHost: 'http://localhost:11434',
  apiKey: null,
  apiUrl: null,
})
```

### `memory_search(query, top_k, ...)`

Busca los K chunks más relevantes.

```typescript
const results = await invoke<SearchResult[]>('memory_search', {
  query: 'Rust Result enum',
  topK: 5,
  provider: 'ollama',
  model: 'nomic-embed-text',
  // ... args de embedding
})
```

### `memory_stats()`

Obtiene estadísticas.

```typescript
const stats = await invoke<MemoryStats>('memory_stats')
// { total_chunks: 234, total_conversations: 12, ... }
```

### `memory_index_project_files(working_dir, extensions, ...)`

Indexa recursivamente un directorio. Excluye `node_modules`, `target`, `dist`, archivos ocultos.

```typescript
const count = await invoke<number>('memory_index_project_files', {
  workingDir: '/home/user/proyecto',
  extensions: ['md', 'ts', 'rs'],  // opcional
  provider: 'ollama',
  model: 'nomic-embed-text',
  // ... args
})
```

### `memory_delete_source(source, source_id)`

Borra todos los chunks de una fuente (ej. una conversación completa).

### `memory_clear()`

Borra toda la base de datos de memoria.

## Solución de problemas

### "Embedding dim X does not match memory dim 768"

Estás usando un modelo con dimensión distinta a 768. Soluciones:
- Cambiar a un modelo compatible: `nomic-embed-text`, `mxbai-embed-large`, `all-minilm`
- O borrar la DB y crear una nueva con la dimensión correcta (próximamente: dimensión configurable)

### "No se puede conectar con Ollama"

Verifica:
1. Ollama está corriendo: `ollama serve` o `systemctl status ollama`
2. El host es correcto en Settings (default: `http://localhost:11434`)
3. El modelo está descargado: `ollama list`
4. No hay firewall bloqueando el puerto

### "La búsqueda no encuentra nada"

- Baja el "Score mínimo" en Settings (prueba con 0.3-0.5)
- Verifica que indexaste contenido: revisa las estadísticas
- Comprueba que el query y los chunks indexados usan el mismo modelo

### "La indexación es muy lenta"

- Usa un modelo más pequeño: `all-minilm` en vez de `mxbai-embed-large`
- Reduce las extensiones indexadas (solo `.md` y `.txt`, sin código)
- Si usas GPU, asegúrate de que Ollama la detecte: `ollama ps`

### "Quiero usar un modelo con otra dimensión"

Por ahora no es posible. La dimensión 768 es fija. Si necesitas otra dimensión (ej. 384 para `all-MiniLM-L6`, 1536 para `text-embedding-3-small` de OpenAI), hay que:

1. Borrar `~/.solaria/memory.db`
2. Modificar `DEFAULT_DIM` en `src-tauri/src/memory.rs:11`
3. Recompilar

Esto se hará configurable en una versión futura.

## Roadmap

Mejoras planeadas:
- Dimensión configurable (384, 768, 1024, 1536, 3072)
- Hybrid search (vectorial + BM25)
- Re-ranking con cross-encoder
- Deduplicación semántica
- Compresión de embeddings
- Auto-detección de modelo y dimensión
- UI para explorar/borrar chunks individuales
- Métricas de uso (queries más frecuentes, score promedio)
