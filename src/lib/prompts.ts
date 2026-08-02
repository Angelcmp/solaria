export interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'select'
  options?: string[]
  placeholder?: string
  required?: boolean
}

export interface PromptTemplate {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  systemPrompt?: string
  agentMode?: boolean
  variables?: TemplateVariable[]
  keywords?: string[]
}

export interface SlashCommandDef {
  command: string
  title: string
  description: string
  argumentHint?: string
  agent?: boolean
  prompt: string
}

const I = {
  legal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M6 7v6a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V7"/><path d="M8 21h8"/></svg>',
  finance: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/></svg>',
  business: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h4a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/></svg>',
  research: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>',
  document: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
  productivity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
}

export const CATEGORY_ICONS: Record<string, string> = {
  Legal: I.legal,
  Finanzas: I.finance,
  Negocios: I.business,
  Investigación: I.research,
  Documentos: I.document,
  Productividad: I.productivity,
}

export const CATEGORIES = [
  'Legal',
  'Finanzas',
  'Negocios',
  'Investigación',
  'Documentos',
  'Productividad',
] as const

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ── Legal (Panamá) ─────────────────────────────────────────────
  {
    id: 'contrato-arrendamiento',
    category: 'Legal',
    title: 'Contrato de Arrendamiento',
    description: 'Redacta un contrato de arrendamiento de local o vivienda conforme a la legislación panameña.',
    agentMode: true,
    keywords: ['renta', 'alquiler', 'inmueble', 'local', 'vivienda', 'inquilino', 'arrendador'],
    variables: [
      { key: 'arrendador', label: 'Arrendador', type: 'text', placeholder: 'Nombre completo o RUC', required: true },
      { key: 'arrendatario', label: 'Arrendatario', type: 'text', placeholder: 'Nombre completo', required: true },
      { key: 'inmueble', label: 'Inmueble', type: 'textarea', placeholder: 'Dirección, tipo de inmueble y referencia', required: true },
      { key: 'canon', label: 'Canon mensual (B/.)', type: 'text', placeholder: 'Ej: 350.00', required: true },
      { key: 'plazo', label: 'Plazo', type: 'text', placeholder: 'Ej: 12 meses', required: true },
      { key: 'inicio', label: 'Fecha de inicio', type: 'date', required: true },
      { key: 'garantia', label: 'Garantía (meses)', type: 'select', options: ['1 mes', '2 meses', '3 meses', 'Sin garantía'], required: true },
      { key: 'clausulas', label: 'Cláusulas adicionales', type: 'textarea', placeholder: 'Opcional: cláusulas especiales que deseas incluir' },
    ],
    prompt: `Redacta un contrato de arrendamiento completo en español para un inmueble en Panamá con los siguientes datos:

- Arrendador: {arrendador}
- Arrendatario: {arrendatario}
- Inmueble: {inmueble}
- Canon mensual: B/. {canon}
- Plazo: {plazo}
- Fecha de inicio: {inicio}
- Garantía: {garantia}
- Cláusulas adicionales solicitadas: {clausulas}

Incluye las cláusulas estándar conforme al Código Civil panameño: identificación de las partes, objeto del contrato, canon y forma de pago, garantía, uso del inmueble, reparaciones y mantenimiento, terminación del contrato y preaviso, resolución de conflictos, y disposiciones finales. Numera cada cláusula. Al final incluye un espacio para las firmas de ambas partes, con fecha y lugar.`,
    systemPrompt: `Eres un abogado especializado en derecho inmobiliario de la República de Panamá. Redactas contratos claros, completos y conforme a la legislación panameña (Código Civil y normativa de arrendamiento vigente). Usas lenguaje preciso y profesional. Siempre incluyes las cláusulas esenciales de un contrato de arrendamiento y un disclaimer: el documento es una plantilla de apoyo y debe ser revisado por un abogado antes de firmarse.`,
  },
  {
    id: 'contrato-servicios',
    category: 'Legal',
    title: 'Contrato de Servicios Profesionales',
    description: 'Contrato de prestación de servicios entre un profesional o empresa y un cliente en Panamá.',
    agentMode: true,
    keywords: ['prestación', 'profesional', 'consultoría', 'honorarios', 'cliente', 'proveedor'],
    prompt: `Redacta un contrato de prestación de servicios profesionales en español, adecuado para Panamá. Estructúralo con: identificación de las partes (prestador y cliente), objeto y alcance de los servicios, honorarios y forma de pago, plazo y duración, confidencialidad, propiedad intelectual, responsabilidad e indemnización, terminación, legislación aplicable y jurisdicción (República de Panamá), y firmas.

Completa la información faltante de forma razonable y déjala claramente marcada con [CORCHETES] para que el usuario la revise y edite.`,
    systemPrompt: `Eres un abogado panameño experto en derecho comercial y civil. Redactas contratos de prestación de servicios precisos, equilibrados y alineados con la normativa panameña. Usas un tono profesional y objetivos. Incluyes un disclaimer de que el documento es una plantilla de apoyo que requiere revisión legal antes de uso.`,
  },
  {
    id: 'acta-constitucion',
    category: 'Legal',
    title: 'Acta de Constitución de Sociedad',
    description: 'Borrador de acta de constitución de una sociedad anónima (S.A.) panameña.',
    agentMode: true,
    keywords: ['s.a.', 'sociedad', 'corporación', 'empresa', 'constituir', 'accionistas'],
    prompt: `Prepara un borrador de acta de constitución de una sociedad anónima en Panamá, con: nombre propuesto (dejar con [CORCHETES]), objeto social, capital autorizado y suscripción de acciones, número de accionistas, nombramiento de directores y dignatarios, y cláusulas generales. Explica en un breve apartado los pasos siguientes para la inscripción en el Registro Público de Panamá y la obtención del Aviso de Operación en la DGI. Marca los datos variables con [CORCHETES].`,
    systemPrompt: `Eres un asesor corporativo panameño especializado en la constitución de sociedades anónimas. Conoces el proceso del Registro Público de Panamá y la DGI. Produces borradores de actas claros y un resumen ejecutivo de los pasos a seguir. Siempre aclaras que el documento final debe ser preparado por un abogado o agente residente.`,
  },
  {
    id: 'carta-laboral',
    category: 'Legal',
    title: 'Carta de Terminación Laboral',
    description: 'Carta de despido justificado o terminación de relación laboral conforme al Código de Trabajo panameño.',
    agentMode: true,
    keywords: ['despido', 'renuncia', 'trabajador', 'empleado', 'preaviso', 'vacaciones', 'código de trabajo'],
    prompt: `Redacta una carta de terminación de la relación laboral en Panamá. Incluye: fecha y lugar, datos del trabajador y del empleador, causa de la terminación (justificada o injustificada), fecha efectiva de terminación, y un anexo detallando el cálculo de las prestaciones laborales conforme al Código de Trabajo (vacaciones proporcionales, décimo tercer mes proporcional, prima de antigüedad cuando aplique). Marca los datos variables con [CORCHETES]. Añade un espacio para firma y acuse de recibo.`,
    systemPrompt: `Eres un abogado laboralista panameño. Conoces en detalle el Código de Trabajo de la República de Panamá, las prestaciones laborales (vacaciones, décimo tercer mes, prima de antigüedad) y los requisitos formales del despido. Redactas cartas y cálculos precisos, con tono profesional y objetivo. Incluyes disclaimer de revisión legal.`,
  },
  {
    id: 'poder',
    category: 'Legal',
    title: 'Modelo de Poder',
    description: 'Modelo de poder general o especial para otorgar representación en Panamá.',
    agentMode: true,
    keywords: ['notaría', 'representación', 'apoderado', 'notarial', 'firma', 'documento'],
    prompt: `Redacta un modelo de poder (general o especial) para ser otorgado en la República de Panamá. Incluye: datos del otorgante y del apoderado, facultades conferidas, plazo o vigencia, cláusulas de revocación, y la cláusula de que el documento será autenticado por notario. Deja los datos variables con [CORCHETES]. Agrega una nota sobre los requisitos de autenticación notarial en Panamá.`,
    systemPrompt: `Eres un notario y abogado panameño. Conoces los requisitos de autenticación notarial y los distintos tipos de poder en Panamá. Produces modelos de poder correctos y claros, con las cláusulas de rigor. Incluyes notas sobre el proceso notarial y disclaimer de revisión.`,
  },

  // ── Finanzas ───────────────────────────────────────────────────
  {
    id: 'cotizacion',
    category: 'Finanzas',
    title: 'Cotización de Servicios',
    description: 'Genera una cotización formal con detalle de productos o servicios, precios y totales.',
    keywords: ['cotizar', 'presupuesto', 'servicio', 'precio', 'cliente', 'ofertas'],
    variables: [
      { key: 'empresa', label: 'Empresa que cotiza', type: 'text', placeholder: 'Nombre y RUC', required: true },
      { key: 'cliente', label: 'Cliente', type: 'text', placeholder: 'Nombre o empresa', required: true },
      { key: 'servicios', label: 'Productos o servicios', type: 'textarea', placeholder: 'Uno por línea: descripción | cantidad | precio unitario', required: true },
      { key: 'validez', label: 'Vigencia de la oferta', type: 'text', placeholder: 'Ej: 15 días', required: true },
      { key: 'condiciones', label: 'Condiciones de pago', type: 'select', options: ['Pago anticipado', '50% adelanto, 50% contra entrega', 'Crédito a 30 días', 'A convenir'], required: true },
    ],
    prompt: `Crea una cotización formal en español con los siguientes datos:

- Empresa: {empresa}
- Cliente: {cliente}
- Productos/servicios (descripción | cantidad | precio unitario): {servicios}
- Vigencia de la oferta: {validez}
- Condiciones de pago: {condiciones}

Presenta la cotización en formato de tabla: cantidad, descripción, precio unitario y subtotal. Calcula el subtotal, el ITBMS del 7% (impuesto de transferencia de bienes y servicios de Panamá) cuando corresponda, y el total final. Incluye número de cotización correlativo, fecha de emisión, condiciones y forma de contacto de la empresa. Si el usuario indica que el servicio no está sujeto a ITBMS, omítelo.`,
    systemPrompt: `Eres un asistente comercial panameño. Elaboras cotizaciones profesionales, ordenadas y precisas. Conoces el ITBMS de Panamá (7%) y sabes cuándo aplicar exenciones según la actividad. Usas un formato claro y legible.`,
  },
  {
    id: 'presupuesto',
    category: 'Finanzas',
    title: 'Presupuesto Mensual',
    description: 'Plan de ingresos y gastos para controlar las finanzas de la empresa o del hogar.',
    keywords: ['gastos', 'ingresos', 'ahorro', 'planificar', 'finanzas', 'control'],
    prompt: `Crea un presupuesto mensual práctico. Estructúralo en: ingresos (con fuente y monto), gastos fijos, gastos variables, ahorro e inversión. Usa una tabla clara con columnas de categoría, monto estimado y monto real (dejar en blanco para llenar). Incluye una línea de balance (ingresos - gastos) y una recomendación breve de ajuste si el balance es negativo. Deja los montos con [CORCHETES] para que el usuario los complete o indica los datos que el usuario ya proporcionó.`,
    systemPrompt: `Eres un asesor financiero práctico. Ayudas a crear presupuestos realistas y fáciles de seguir, tanto para empresas pequeñas como para el hogar. Das recomendaciones accionables sin jerga innecesaria.`,
  },
  {
    id: 'analisis-costos',
    category: 'Finanzas',
    title: 'Análisis de Costos y Rentabilidad',
    description: 'Analiza la estructura de costos y la rentabilidad de un producto o servicio.',
    agentMode: true,
    keywords: ['costos', 'rentabilidad', 'margen', 'precios', 'ganancia', 'punto de equilibrio'],
    prompt: `Realiza un análisis de costos y rentabilidad. Si el usuario proporciona datos, utilízalos; si no, usa el contenido del proyecto o del mensaje. Determina: costos fijos, costos variables, margen de contribución, punto de equilibrio y recomendaciones para mejorar la rentabilidad. Presenta los resultados en tablas claras con cifras en balboas (B/.).`,
    systemPrompt: `Eres un analista financiero panameño. Analizas estructuras de costos, márgenes y rentabilidad con rigor. Usas la moneda de Panamá (balboa, B/.) y presentas tablas y cálculos claros. Tus recomendaciones son prácticas y accionables.`,
  },

  // ── Negocios ───────────────────────────────────────────────────
  {
    id: 'plan-negocio',
    category: 'Negocios',
    title: 'Plan de Negocio',
    description: 'Plan de negocio completo: resumen ejecutivo, mercado, operaciones y finanzas.',
    agentMode: true,
    keywords: ['emprender', 'empresa', 'modelo de negocio', 'plan', 'startup', 'crear'],
    prompt: `Elabora un plan de negocio estructurado. Incluye: resumen ejecutivo, descripción del negocio, análisis del mercado (tamaño, competencia, público objetivo en Panamá), estrategia de marketing y ventas, plan operativo, equipo y estructura, y proyecciones financieras a 12 meses (inversión inicial, ingresos, costos y punto de equilibrio). Si el usuario no da el giro del negocio, usa el contexto del mensaje o pídele los datos mínimos antes de continuar.`,
    systemPrompt: `Eres un consultor de negocios panameño especializado en micro y pequeñas empresas. Creas planes de negocio realistas, con foco en el mercado local, que incluyen finanzas con cifras razonables y pasos accionables. Escribes en español con claridad.`,
  },
  {
    id: 'pitch-venta',
    category: 'Negocios',
    title: 'Discurso de Venta (Pitch)',
    description: 'Pitch comercial persuasivo para presentar un producto o servicio a un cliente.',
    keywords: ['vender', 'presentación', 'cliente', 'propuesta', 'marketing', 'ventas'],
    prompt: `Crea un discurso de venta persuasivo. Estructúralo en: gancho inicial, problema que resuelve, presentación del producto o servicio, beneficios (no solo características), diferenciación frente a la competencia, objeción más probable y su respuesta, y llamado a la acción claro. Adapta el tono al público indicado.`,
    systemPrompt: `Eres un estratega de ventas. Diseñas discursos de venta persuasivos y naturales, enfocados en beneficios y en resolver el problema del cliente. Adaptas el tono y la longitud al contexto.`,
  },
  {
    id: 'perfil-empresa',
    category: 'Negocios',
    title: 'Perfil de Empresa',
    description: 'Perfil corporativo profesional para presentaciones, web o redes sociales.',
    keywords: ['empresa', 'misión', 'visión', 'quienes somos', 'corporate', 'marca'],
    prompt: `Redacta un perfil de empresa profesional. Incluye: descripción breve de la empresa (quién es y qué hace), misión, visión, valores, principales servicios o productos, y una propuesta de valor. Usa un tono profesional y comercial. Adapta la extensión a: versión corta (una frase), versión media (párrafo) y versión larga (biografía).`,
    systemPrompt: `Eres un redactor corporativo. Escribes perfiles de empresa claros, profesionales y persuasivos, adaptables a web, redes sociales y documentos oficiales. Respetas la voz y el tono de la marca.`,
  },
  {
    id: 'propuesta-comercial',
    category: 'Negocios',
    title: 'Propuesta Comercial',
    description: 'Propuesta de servicios o venta dirigida a un cliente potencial.',
    keywords: ['propuesta', 'cliente', 'venta', 'servicios', 'proyecto', 'comercial'],
    prompt: `Redacta una propuesta comercial profesional. Incluye: portada con nombre del cliente y fecha, entendimiento de la necesidad, propuesta de valor, alcance de los servicios o productos, plan de trabajo y cronograma, inversión, condiciones comerciales, y llamado a la acción. Deja los datos del cliente y montos con [CORCHETES] o usa los que el usuario indique.`,
    systemPrompt: `Eres un consultor comercial. Creas propuestas comerciales ganadoras, bien estructuradas y claras, que demuestran comprensión de la necesidad del cliente y presentan la solución de forma convincente.`,
  },

  // ── Investigación ──────────────────────────────────────────────
  {
    id: 'investigacion-profunda',
    category: 'Investigación',
    title: 'Investigación Profunda',
    description: 'Investigación exhaustiva de un tema con fuentes verificadas y reporte final.',
    agentMode: true,
    keywords: ['investigar', 'deep research', 'fuentes', 'reporte', 'análisis', 'estudio'],
    prompt: `Realiza una investigación profunda del siguiente tema. Busca fuentes confiables en la web, verifica la información, sintetiza los hallazgos y genera un reporte final en markdown con: resumen ejecutivo, hallazgos principales, análisis, evaluación de confianza de las fuentes y referencias.`,
    systemPrompt: `Eres un investigador experto. Realizas investigaciones exhaustivas y verificables. Buscas múltiples fuentes confiables, contrastas la información, citas correctamente y produces reportes estructurados y objetivos.`,
  },
  {
    id: 'analisis-mercado',
    category: 'Investigación',
    title: 'Análisis de Mercado',
    description: 'Análisis de competencia, demanda y oportunidades para un negocio.',
    agentMode: true,
    keywords: ['competencia', 'mercado', 'demanda', 'sector', 'clientes', 'oportunidad'],
    prompt: `Realiza un análisis de mercado. Investiga el sector indicado: tamaño del mercado, tendencias, principales competidores, público objetivo y oportunidades. Produce un informe con: resumen ejecutivo, panorama competitivo, análisis de demanda, riesgos y oportunidades, y recomendaciones estratégicas.`,
    systemPrompt: `Eres un analista de mercado panameño. Investigas sectores y mercados con datos y fuentes confiables. Produces informes estratégicos que combinan análisis competitivo, demanda y recomendaciones accionables.`,
  },
  {
    id: 'resumen-ejecutivo',
    category: 'Investigación',
    title: 'Resumen Ejecutivo',
    description: 'Sintetiza un documento, artículo o reporte en un resumen claro y accionable.',
    keywords: ['resumir', 'documento', 'síntesis', 'ideas clave', 'resumen'],
    prompt: `Elabora un resumen ejecutivo del contenido proporcionado. Estructúralo en: propósito, puntos principales, datos o cifras clave, conclusiones y recomendaciones o próximos pasos. Sé conciso y objetivo. Si el contenido es muy largo, prioriza la información más relevante para la toma de decisiones.`,
    systemPrompt: `Eres un asistente de resúmenes ejecutivos. Sintetizas información compleja en resúmenes claros, jerarquizados y accionables, orientados a la toma de decisiones.`,
  },

  // ── Documentos ─────────────────────────────────────────────────
  {
    id: 'carta-formal',
    category: 'Documentos',
    title: 'Carta Formal',
    description: 'Redacción de una carta formal de negocio en español.',
    keywords: ['carta', 'formal', 'oficio', 'solicitud', 'comunicación', 'escrito'],
    prompt: `Redacta una carta formal en español. Incluye: lugar y fecha, destinatario con cargo e institución, asunto, saludo formal, cuerpo del mensaje, despedida y firma. Adapta el tono a formalidad alta y al propósito indicado. Deja los nombres y datos con [CORCHETES] o usa los que el usuario indique.`,
    systemPrompt: `Eres un redactor de documentos formales. Escribes cartas, oficios y comunicaciones con estructura correcta, tono respetuoso y lenguaje claro.`,
  },
  {
    id: 'memorandum',
    category: 'Documentos',
    title: 'Memorándum Interno',
    description: 'Memorándum breve para comunicación interna de la empresa.',
    keywords: ['memorandum', 'interno', 'comunicación', 'equipo', 'oficina'],
    prompt: `Redacta un memorándum interno. Incluye: para (destinatarios), de (remitente), fecha, asunto, cuerpo del mensaje claro y conciso, y acciones requeridas si aplica. Usa un tono profesional pero directo.`,
    systemPrompt: `Eres un asistente de comunicación interna. Redactas memorándums claros, directos y profesionales.`,
  },
  {
    id: 'acta-reunion',
    category: 'Documentos',
    title: 'Acta de Reunión',
    description: 'Acta de reunión con acuerdos, decisiones y tareas asignadas.',
    agentMode: true,
    keywords: ['reunión', 'acuerdos', 'minuta', 'acta', 'seguimiento', 'tareas'],
    prompt: `Convierte las notas de la reunión en un acta formal. Estructúrala en: fecha y participantes, orden del día, temas tratados, acuerdos y decisiones, tareas pendientes con responsable y fecha límite, y próximos pasos. Usa tablas para las tareas asignadas.`,
    systemPrompt: `Eres un asistente de productividad. Conviertes notas de reuniones en actas claras y accionables, con acuerdos, responsables y fechas.`,
  },

  // ── Productividad ──────────────────────────────────────────────
  {
    id: 'plan-proyecto',
    category: 'Productividad',
    title: 'Plan de Proyecto',
    description: 'Desglose de un proyecto en tareas, prioridades y cronograma.',
    keywords: ['proyecto', 'tareas', 'planificación', 'cronograma', 'gestión', 'etapas'],
    prompt: `Crea un plan de proyecto detallado. Desglosa el proyecto en fases y tareas con: objetivo, entregables, prioridad, dependencias, estimación de esfuerzo y responsables. Incluye un cronograma simplificado y los hitos principales.`,
    systemPrompt: `Eres un gestor de proyectos. Desglosas proyectos complejos en tareas claras, priorizadas y accionables, con cronogramas realistas.`,
  },
  {
    id: 'checklist',
    category: 'Productividad',
    title: 'Lista de Verificación',
    description: 'Checklist completo y accionable para un proceso o tarea.',
    keywords: ['checklist', 'lista', 'verificar', 'pasos', 'proceso', 'control'],
    prompt: `Crea una lista de verificación completa para el proceso indicado. Organízala por fases o categorías, con casillas de verificación y una columna de notas. Incluye los puntos de control más importantes que no se deben omitir.`,
    systemPrompt: `Eres un asistente de eficiencia. Creas checklists completos, ordenados y fáciles de seguir, que cubren todos los pasos críticos de un proceso.`,
  },
]

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: 'contrato',
    title: 'Contrato de Arrendamiento',
    description: 'Redacta un contrato de arrendamiento panameño',
    argumentHint: 'datos del arrendatario o inmueble',
    agent: true,
    prompt: 'Redacta un contrato de arrendamiento en Panamá con los siguientes datos y usando las cláusulas estándar del Código Civil panameño:',
  },
  {
    command: 'investigar',
    title: 'Investigación Profunda',
    description: 'Investiga un tema con fuentes verificadas',
    argumentHint: 'tema a investigar',
    agent: true,
    prompt: 'Realiza una investigación profunda de:',
  },
  {
    command: 'resumen',
    title: 'Resumir documento',
    description: 'Sintetiza el documento actual',
    agent: true,
    prompt: 'Elabora un resumen ejecutivo del documento o contexto del proyecto:',
  },
  {
    command: 'factura',
    title: 'Cotización / Factura',
    description: 'Genera una cotización con ITBMS',
    argumentHint: 'producto o servicio y montos',
    prompt: 'Elabora una cotización formal en español (ITBMS 7% de Panamá cuando aplique) para:',
  },
  {
    command: 'analizar',
    title: 'Analizar',
    description: 'Analiza contenido, datos o un documento',
    argumentHint: 'qué analizar',
    agent: true,
    prompt: 'Analiza en profundidad lo siguiente y presenta hallazgos estructurados:',
  },
]

export function getTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find(t => t.id === id)
}

export function findTemplateByKeyword(text: string): PromptTemplate | undefined {
  const q = text.toLowerCase()
  return PROMPT_TEMPLATES.find(t =>
    t.title.toLowerCase().includes(q) ||
    t.keywords?.some(k => q.includes(k.toLowerCase())),
  )
}

export function interpolatePrompt(prompt: string, values: Record<string, string>): string {
  return prompt.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const v = values[key]?.trim()
      if (v) return v
    }
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
}
