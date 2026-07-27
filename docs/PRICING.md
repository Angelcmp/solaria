# Solaria — Modelo de Precios

## Filosofía de precios

Solaria se vende como **software de por vida** (one-time license). No hay suscripción mensual. El pago único genera confianza en el microempresario panameño, que rechaza gastos fijos recurrentes.

Los ingresos recurrentes a largo plazo vienen de:
- **Major upgrades**: v1 → v2 con descuento para usuarios viejos.
- **Skills premium**: paquetes especializados por industria (legal avanzado, contable, médico, comercial).
- **Soporte extendido**: asistencia vía WhatsApp para empresas con mayor urgencia.

## Estructura de planes

| Plan | Precio USD | Público objetivo |
|---|---|---|
| **Solaria Emprendedor** | **$19.99** | Personas en proceso de formalización, vendedores informales, profesionales independientes que recién empiezan. |
| **Solaria Negocio** | **$49.99** | Micro y pequeñas empresas ya operando (tiendas, talleres, farmacias, ferreterías, consultorios). |
| **Solaria Profesional** | **$99.99** | Abogados junior, contadores, médicos, arquitectos, consultores que necesitan investigación y análisis avanzado. |

## Comparativa por feature

| Feature | Emprendedor | Negocio | Profesional |
|---|---|---|---|
| Chat con IA (cloud) | ✅ | ✅ | ✅ |
| Adjuntar PDF e imágenes | ✅ | ✅ | ✅ |
| Leer documentos Office (.docx, .xlsx, .pptx) | ✅ | ✅ | ✅ |
| Templates básicos (15) | ✅ | ✅ | ✅ |
| Templates legales de Panamá (30+) | ❌ | ✅ | ✅ |
| Exportar a PDF/DOCX | ❌ | ✅ | ✅ |
| Agente de investigación | ❌ | ✅ | ✅ |
| Memoria persistente | ❌ | ✅ | ✅ |
| Skills especializadas | ❌ | ❌ | ✅ |
| Modo offline con Ollama | ❌ | ❌ | ✅ |
| Comparador ciego de modelos | ❌ | ❌ | ✅ |
| Templates con formularios inteligentes | ❌ | ✅ | ✅ |
| Historial de documentos generados | ❌ | ✅ | ✅ |
| Soporte | Comunidad | WhatsApp prioritario | WhatsApp dedicado |
| Auto-updates | ✅ | ✅ | ✅ |
| Licencia de por vida | ✅ | ✅ | ✅ |

## Justificación de precios por segmento

### Emprendedor — $19.99

- **Benchmark**: Una consulta legal básica en Panamá cuesta $50-$80. Solaria cuesta menos de la mitad y se usa ilimitadamente.
- **Mensaje**: "Paga menos que una sola consulta y ten un asistente legal/comercial disponible todos los días."
- **Objetivo**: Convertir usuarios informales en clientes formales. Bajar la barrera de entrada.

### Negocio — $49.99

- **Benchmark**: Una hora de contador o asistente administrativo cuesta $40-$60. Solaria cuesta lo mismo que una hora pero acelera semanas de trabajo.
- **Mensaje**: "El precio de una hora de contador, pero te ayuda con contratos, cartas, investigación y documentos todo el año."
- **Objetivo**: Negocios que ya facturan y necesitan orden administrativo sin contratar personal.

### Profesional — $99.99

- **Benchmark**: Un profesional en Panamá factura $80-$200/hora. Una sola investigación acelerada por Solaria recupera el costo.
- **Mensaje**: "Recuperás la inversión con una sola tarde de investigación que Solaria hace en minutos."
- **Objetivo**: Productividad avanzada, análisis de documentos, skills especializadas.

## Costos ocultos para el usuario

Solaria no cobra mensualidad, pero el usuario debe pagar el uso de APIs de IA (OpenAI, Anthropic, Google). Esto es transparente:

| Proveedor | Costo típico | Para qué uso |
|---|---|---|
| OpenAI (GPT-4o-mini) | ~$0.60-$2.00/mes | Chat normal, plantillas, 100-300 mensajes/mes |
| Anthropic (Claude Haiku) | ~$1.00-$3.00/mes | Documentos largos, análisis legal |
| Google (Gemini) | Similar a OpenAI | Opción alternativa |
| Ollama local | $0 | Requiere PC con GPU/CPU decente para máxima privacidad |

**Mensaje de venta**: "Solaria es tuyo para siempre. Solo pagás tu consumo de IA si usás modelos de nube. Con GPT-4o-mini, una pyme gasta menos de $2 al mes."

## Estrategia de descuentos y promociones

| Escenario | Descuento | Condición |
|---|---|---|
| Lanzamiento v1.0 | 30% off | Primeras 100 compras |
| Upgrade de Emprendedor a Negocio | $15.00 | Pagás la diferencia neta |
| Upgrade de Negocio a Profesional | $35.00 | Pagás la diferencia neta |
| Compra 3+ licencias | 20% off | Para negocios familiares o equipos pequeños |
| Recomendación exitosa | $5.00 crédito | Cuando un referido compra cualquier plan |

## Proyección de ingresos (Panamá, primeros 6 meses)

| Mes | Emprendedor | Negocio | Profesional | Ingreso estimado |
|---|---|---|---|---|
| 1 | 10 | 5 | 2 | $499.78 |
| 2 | 20 | 10 | 5 | $1,399.55 |
| 3 | 35 | 20 | 10 | $2,599.15 |
| 4 | 50 | 35 | 15 | $4,248.50 |
| 5 | 70 | 50 | 25 | $6,248.30 |
| 6 | 90 | 70 | 35 | $8,647.10 |
| **Total 6 meses** | **275** | **190** | **92** | **$23,642.38** |

*Proyección conservadora basada en boca a boca, gremios, AMPYME y una landing page localizada en Panamá.*

## Upgrades futuros (one-time)

| Upgrade | Precio | Para quién |
|---|---|---|
| v1 → v2 | $14.99-$29.99 según plan | Todos los usuarios viejos |
| Skill Pack Legal Avanzado | $9.99 | Profesionales y Negocios |
| Skill Pack Contable | $9.99 | Negocios |
| Skill Pack Médico | $14.99 | Profesionales |
| Soporte Premium 1 año | $19.99 | Emprendedor y Negocio |

## Formas de pago recomendadas para Panamá

- Tarjetas Visa/Mastercard vía Stripe/PayPal.
- ACH (bancos panameños) para empresas.
- Yappy (Banco General) para pagos rápidos de personas.
- Pago en efectivo en puntos de pago (TropiPay, o aliados comerciales) para emprendedores informales.

## Comparación contra competidores

| Competidor | Modelo | Costo anual | Privacidad | Contexto Panamá |
|---|---|---|---|---|
| ChatGPT Plus | Suscripción | $240/año | Datos en OpenAI | No conoce leyes panameñas |
| Claude Pro | Suscripción | $240/año | Datos en Anthropic | Inglés-céntrico |
| Copilot | Suscripción | $240/año | Datos en Microsoft | Para código, no pymes |
| Abogado/Contador | Por hora | $2,000+/año | Local | Excelente, pero caro |
| **Solaria** | **Pago único** | **$19.99-$99.99** | **Local o cloud comercial** | **Templates y leyes panameñas** |

## Mensaje de precio clave

> **"Un pago único. Tu asistente para siempre. Menos de lo que cuesta una consulta con un abogado, y te ayuda con contratos, trámites, investigación y documentos todo el año."**
