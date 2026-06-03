export type Lang = 'es' | 'en'

type Translations = Record<string, {
  es: string
  en: string
}>

const translations: Translations = {
  // Chat
  'chat.welcome.title': { es: 'Bienvenido a Solaria', en: 'Welcome to Solaria' },
  'chat.welcome.agent': { es: 'Modo Agente', en: 'Agent Mode' },
  'chat.welcome.morning': { es: 'Buenos días', en: 'Good morning' },
  'chat.welcome.afternoon': { es: 'Buenas tardes', en: 'Good afternoon' },
  'chat.welcome.evening': { es: 'Buenas noches', en: 'Good evening' },
  'chat.welcome.ask': { es: '¿Qué necesitas hoy?', en: 'What do you need today?' },
  'chat.welcome.ask1': { es: '¿En qué puedo ayudarte?', en: 'How can I help you?' },
  'chat.welcome.ask2': { es: '¿Por dónde empezamos?', en: 'Where shall we start?' },
  'chat.welcome.ask3': { es: '¿Listo para crear algo?', en: 'Ready to create something?' },
  'chat.welcome.ask4': { es: '¿Qué vamos a hacer hoy?', en: 'What will we do today?' },
  'chat.welcome.ask.agent': { es: '¿Qué tarea vamos a resolver?', en: 'What task shall we solve?' },
  'chat.welcome.ask.agent1': { es: '¿Qué exploramos hoy?', en: 'What shall we explore today?' },
  'chat.welcome.ask.agent2': { es: 'Dame instrucciones para empezar', en: 'Give me instructions to start' },
  'chat.welcome.ask.agent3': { es: '¿Qué proyecto trabajamos?', en: 'What project are we working on?' },
  'chat.welcome.ask.agent4': { es: '¿Automatizamos algo hoy?', en: 'Let\'s automate something today?' },
  'chat.welcome.desc': { es: 'Tu agente de IA privado que funciona 100% offline.', en: 'Your private AI agent, 100% offline.' },
  'chat.welcome.agent_desc': { es: 'Dale instrucciones al agente y deja que ejecute herramientas en tu sistema.', en: 'Give the agent instructions and let it execute tools on your system.' },
  'chat.suggest.summarize': { es: 'Resume un documento', en: 'Summarize a document' },
  'chat.placeholder': { es: 'Escribe un mensaje...', en: 'Type a message...' },
  'chat.placeholder.agent': { es: 'Dale una tarea al agente...', en: 'Give the agent a task...' },
  'chat.templates': { es: 'Plantillas', en: 'Templates' },
  'chat.search_web': { es: 'Activar búsqueda web', en: 'Activate web search' },
  'chat.search_web.off': { es: 'Desactivar búsqueda web', en: 'Deactivate web search' },
  'chat.copy': { es: 'Copiar', en: 'Copy' },
  'chat.regenerate': { es: 'Regenerar respuesta', en: 'Regenerate response' },
  'chat.tokens': { es: 'tokens', en: 'tokens' },
  'chat.error': { es: 'Error', en: 'Error' },
  'chat.session_locked': { es: 'Sesión bloqueada por inactividad', en: 'Session locked due to inactivity' },
  'chat.resume': { es: 'Reanudar', en: 'Resume' },
  'chat.agent': { es: 'Agent', en: 'Agent' },
  'chat.clear': { es: 'Limpiar chat', en: 'Clear chat' },
  'chat.settings': { es: 'Configuración', en: 'Settings' },
  'chat.drop_files': { es: 'Suelta archivos aquí', en: 'Drop files here' },
  'chat.attach_file': { es: 'Adjuntar archivo', en: 'Attach file' },
  'chat.ollama_free': { es: 'Ollama es gratuito (local)', en: 'Ollama is free (local)' },
  'chat.quick_actions': { es: 'Acciones rápidas', en: 'Quick actions' },
  'chat.scroll_down': { es: 'Ir al final', en: 'Scroll to bottom' },
  'chat.scroll_up': { es: 'Ir al inicio', en: 'Scroll to top' },
  'chat.injection_warn': { es: 'Mensaje bloqueado: posible intento de inyección de prompt.', en: 'Message blocked: possible prompt injection attempt.' },

  // Quick actions
  'action.learn': { es: 'Aprender', en: 'Learn' },
  'action.summarize': { es: 'Resumir', en: 'Summarize' },
  'action.translate': { es: 'Traducir', en: 'Translate' },
  'action.analyze': { es: 'Analizar', en: 'Analyze' },
  'action.write': { es: 'Escribir', en: 'Write' },
  'action.ideas': { es: 'Ideas', en: 'Brainstorm' },
  'action.improve': { es: 'Mejorar', en: 'Improve' },
  'action.data': { es: 'Datos', en: 'Data' },

  // Quick action prompts
  'action.learn.prompt': { es: 'Eres Solaria, un tutor educativo. Ayuda al usuario a entender el tema. Sigue estos pasos:\n1. Evalúa el nivel de conocimiento actual del usuario\n2. Explica el concepto fundamental de forma simple\n3. Profundiza progresivamente con ejemplos\n4. Verifica la comprensión con preguntas\n5. Resume los puntos clave', en: 'You are Solaria, an educational tutor. Help the user understand the topic. Follow these steps:\n1. Assess the user\'s current knowledge level\n2. Explain the core concept simply\n3. Deepen progressively with examples\n4. Verify understanding with questions\n5. Summarize key points' },
  'action.summarize.prompt': { es: 'Eres Solaria, un asistente de resúmenes. Resume el contenido proporcionado de forma clara y concisa. Destaca los puntos principales, datos clave y conclusiones. Usa viñetas para mejor legibilidad.', en: 'You are Solaria, a summarization assistant. Summarize the provided content clearly and concisely. Highlight key points, data, and conclusions. Use bullet points for readability.' },
  'action.translate.prompt': { es: 'Eres Solaria, un traductor experto. Traduce el texto proporcionado manteniendo el tono, estilo y significado original.', en: 'You are Solaria, an expert translator. Translate the provided text while preserving the original tone, style, and meaning.' },
  'action.analyze.prompt': { es: 'Eres Solaria, un analista experto. Analiza el contenido proporcionado en profundidad.', en: 'You are Solaria, an expert analyst. Analyze the provided content in depth.' },
  'action.write.prompt': { es: 'Eres Solaria, un asistente de escritura. Ayuda a redactar contenido claro y persuasivo.', en: 'You are Solaria, a writing assistant. Help craft clear and persuasive content.' },
  'action.ideas.prompt': { es: 'Eres Solaria, un generador de ideas. Genera 5-7 ideas creativas y prácticas.', en: 'You are Solaria, an idea generator. Generate 5-7 creative and practical ideas.' },
  'action.improve.prompt': { es: 'Eres Solaria, un asistente de mejora. Revisa y sugiere mejoras específicas.', en: 'You are Solaria, an improvement assistant. Review and suggest specific improvements.' },
  'action.data.prompt': { es: 'Eres Solaria, un analista de datos. Interpreta datos y proporciona conclusiones.', en: 'You are Solaria, a data analyst. Interpret data and provide conclusions.' },

  // Sidebar
  'sidebar.new': { es: 'Nueva conversación', en: 'New conversation' },
  'sidebar.search': { es: 'Buscar conversaciones...', en: 'Search conversations...' },
  'sidebar.no_results': { es: 'Sin resultados', en: 'No results' },
  'sidebar.empty': { es: 'Sin conversaciones', en: 'No conversations' },
  'sidebar.pinned': { es: 'Anclados', en: 'Pinned' },
  'sidebar.today': { es: 'Hoy', en: 'Today' },
  'sidebar.yesterday': { es: 'Ayer', en: 'Yesterday' },
  'sidebar.older': { es: 'Anteriores', en: 'Earlier' },
  'sidebar.pin': { es: 'Anclar', en: 'Pin' },
  'sidebar.unpin': { es: 'Desanclar', en: 'Unpin' },
  'sidebar.delete': { es: 'Eliminar', en: 'Delete' },
  'sidebar.collapse': { es: 'Colapsar', en: 'Collapse' },
  'sidebar.expand': { es: 'Expandir', en: 'Expand' },

  // Settings
  'settings.title': { es: 'Configuración', en: 'Settings' },
  'settings.general': { es: 'General', en: 'General' },
  'settings.providers': { es: 'API Keys', en: 'API Keys' },
  'settings.search': { es: 'Búsqueda', en: 'Search' },
  'settings.agent': { es: 'Agente', en: 'Agent' },
  'settings.memory': { es: 'Memoria', en: 'Memory' },
  'settings.audit': { es: 'Auditoría', en: 'Audit' },
  'settings.default_provider': { es: 'Proveedor por defecto', en: 'Default provider' },
  'settings.default_model': { es: 'Modelo por defecto', en: 'Default model' },
  'settings.language': { es: 'Idioma', en: 'Language' },
  'settings.llm_params': { es: 'Parámetros del modelo', en: 'Model parameters' },
  'settings.temperature': { es: 'Temperatura', en: 'Temperature' },
  'settings.top_p': { es: 'Top P', en: 'Top P' },
  'settings.max_tokens': { es: 'Max tokens', en: 'Max tokens' },
  'settings.storage': { es: 'Almacenamiento', en: 'Storage' },
  'settings.clear_history': { es: 'Limpiar historial', en: 'Clear history' },
  'settings.export': { es: 'Exportar conversaciones', en: 'Export conversations' },
  'settings.import': { es: 'Importar conversaciones', en: 'Import conversations' },
  'settings.tavily_key': { es: 'Tavily API Key', en: 'Tavily API Key' },
  'settings.agent_desc': { es: 'Configura el comportamiento del agente de IA.', en: 'Configure agent behavior.' },

  // Agent
  'agent.running': { es: 'ejecutando...', en: 'running...' },
  'agent.completed': { es: 'completado', en: 'completed' },
  'agent.steps': { es: 'paso', en: 'step' },
  'agent.reasoning': { es: 'Razonando', en: 'Reasoning' },
  'agent.reasoning_ellipsis': { es: 'Razonando...', en: 'Reasoning...' },
  'agent.final': { es: 'Respuesta final → Chat central', en: 'Final answer → Main chat' },
  'agent.stop': { es: 'Detener agente', en: 'Stop agent' },
  'agent.close': { es: 'Cerrar panel', en: 'Close panel' },
  'agent.init': { es: 'Iniciando agente...', en: 'Starting agent...' },

  // Cookbook
  'cookbook.title': { es: 'Cookbook', en: 'Cookbook' },
  'cookbook.hardware': { es: 'Hardware detectado', en: 'Detected Hardware' },
  'cookbook.catalog': { es: 'Catálogo de modelos', en: 'Model Catalog' },
  'cookbook.downloaded_models': { es: 'Modelos descargados', en: 'Downloaded Models' },
  'cookbook.scan': { es: 'Escanear hardware', en: 'Scan hardware' },
  'cookbook.download': { es: 'Descargar', en: 'Download' },
  'cookbook.serve': { es: 'Servir en Ollama', en: 'Serve with Ollama' },
  'cookbook.delete': { es: 'Eliminar', en: 'Delete' },
  'cookbook.cancel': { es: 'Cancelar', en: 'Cancel' },
  'cookbook.downloading': { es: 'Descargando', en: 'Downloading' },
  'cookbook.complete': { es: 'Completado', en: 'Complete' },
  'cookbook.serving': { es: 'Activo', en: 'Serving' },
  'cookbook.cpu': { es: 'CPU', en: 'CPU' },
  'cookbook.ram': { es: 'RAM', en: 'RAM' },
  'cookbook.gpu': { es: 'GPU', en: 'GPU' },
  'cookbook.disk': { es: 'Disco', en: 'Disk' },
  'cookbook.cores': { es: 'núcleos', en: 'cores' },
  'cookbook.threads': { es: 'hilos', en: 'threads' },
  'cookbook.label': { es: 'Cookbook', en: 'Cookbook' },
  'cookbook.vram_req': { es: 'VRAM req.', en: 'VRAM req.' },
  'cookbook.ctx': { es: 'contexto', en: 'context' },
  'cookbook.size': { es: 'tamaño', en: 'size' },
  'cookbook.license': { es: 'Licencia', en: 'License' },
  'cookbook.no_downloads': { es: 'No hay modelos descargados aún.', en: 'No models downloaded yet.' },
  'cookbook.search_models': { es: 'Buscar modelos...', en: 'Search models...' },
  'cookbook.recommended': { es: 'Recomendado', en: 'Recommended' },
  'cookbook.runs_on_cpu': { es: 'Funciona en CPU', en: 'Runs on CPU' },
  'cookbook.needs_gpu': { es: 'Requiere GPU', en: 'Needs GPU' },
}

export function t(key: string, lang: Lang): string {
  const entry = translations[key]
  if (!entry) return key
  return entry[lang]
}

export function useTranslation(lang: Lang) {
  return (key: string) => t(key, lang)
}
