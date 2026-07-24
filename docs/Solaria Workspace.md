# Solaria Workspace

## Visión

Solaria Workspace es la evolución de Solaria Agent hacia un **producto profesional 100% local**, diseñado para instalarse en la computadora del usuario y adaptarse a distintas áreas de trabajo. El objetivo es comercializar el agente a micro y medianas empresas, profesionales independientes y despachos especializados, manteniendo como ventaja diferenciadora el **procesamiento local de datos** (sin enviar documentos ni información sensible a la nube) y el **soporte de múltiples proveedores de LLM**.

Cada profesión tendrá un **modo de workspace propio** que transforma el panel lateral en una herramienta especializada para gestionar casos, clientes, documentos, plazos y acciones específicas del área.

---

## Ventaja competitiva frente a Claude Cowork y Codex

| Aspecto | **Claude Cowork** | **GitHub Copilot / Codex** | **Solaria Workspace** |
|---------|-------------------|---------------------------|----------------------|
| **Enfoque** | Trabajo de conocimiento general | Desarrollo de software | Profesiones técnicas (legal, contable, médico, comercio, etc.) |
| **Privacidad** | Cloud (con opciones enterprise) | Cloud | **100% local por defecto** |
| **Documentos** | PDF, DOCX, XLSX, PPTX, imágenes, código | Principalmente código | PDF, Office, imágenes, OCR ( roadmap ) |
| **Integraciones** | Google Drive, Slack, CRM, MS 365, browser | GitHub, MCP, IDEs | Apps nativas, email, calendario, cloud storage (roadmap) |
| **Agente** | Sí, con computer use | Sí, agentes de código | Sí, con file tools y web search |
| **MCP** | Connectors y plugins | MCP registry | Implementación básica, a expandir |
| **Vision** | Sí | Limitado | No (roadmap) |
| **Auditoría** | Enterprise logs, SIEM | Audit logs | Log local básico, a expandir |
| **Ventaja clave** | Tareas end-to-end | Flujo de desarrollo completo | **Privacidad + multi-LLM + workspaces especializados** |

Solaria compite por ser la opción para profesionales que no pueden enviar información de clientes, pacientes o finanzas a la nube, pero que necesitan un agente que realmente trabaje sobre sus archivos y documentos.

---

## Arquitectura multi-workspace

### Principio

Cada área profesional tiene **su propio workspace alternativo** en el `WorkspaceAside`. El usuario selecciona el modo en Configuración y el panel lateral se adapta completamente a esa profesión. El chat central y el agente se mantienen universales, pero se inyectan **skills y plantillas específicas** según el modo activo.

### Estructura de archivos

```
src/components/workspace/
├── WorkspaceAside.tsx          # Router / shell común
├── GeneralWorkspace.tsx        # Vista actual (proyectos + conversaciones)
├── LegalWorkspace.tsx          # Vista de abogados
├── AccountingWorkspace.tsx     # Vista de contadores
├── CommerceWorkspace.tsx       # Vista de comercios/retail
├── MedicalWorkspace.tsx        # Vista de médicos
├── ArchitectureWorkspace.tsx   # Vista de arquitectos
├── DesignWorkspace.tsx         # Vista de diseñadores
└── shared/
    ├── WorkspaceHeader.tsx
    ├── QuickActions.tsx
    ├── Section.tsx
    ├── EntityList.tsx
    ├── EntityModal.tsx
    └── DeadlineBadge.tsx
```

### Router de workspace

```tsx
// WorkspaceAside.tsx
function WorkspaceAside({ workspaceMode, ...commonProps }) {
  switch (workspaceMode) {
    case 'legal': return <LegalWorkspace {...commonProps} />
    case 'accounting': return <AccountingWorkspace {...commonProps} />
    case 'commerce': return <CommerceWorkspace {...commonProps} />
    case 'medical': return <MedicalWorkspace {...commonProps} />
    case 'architecture': return <ArchitectureWorkspace {...commonProps} />
    case 'design': return <DesignWorkspace {...commonProps} />
    default: return <GeneralWorkspace {...commonProps} />
  }
}
```

### Almacenamiento de datos

Cada modo profesional tiene su propio hook y almacenamiento aislado:

```ts
// Configuración
workspaceMode: 'general' | 'legal' | 'accounting' | 'commerce' | 'medical' | 'architecture' | 'design'

// Datos separados por profesión
solaria-legal-cases         // casos legales
solaria-legal-deadlines     // plazos y tareas
solaria-legal-documents     // documentos vinculados

solaria-accounting-clients    // clientes contables
solaria-accounting-invoices   // facturas
solaria-accounting-reports    // reportes

solaria-commerce-products     // productos
solaria-commerce-sales        // ventas
solaria-commerce-customers    // clientes

solaria-medical-patients      // pacientes (anonimizados)
solaria-medical-records       // registros
```

**Ventaja:** el usuario puede cambiar de modo y cada profesión mantiene sus datos aislados. Un abogado que también usa Solaria para contabilidad personal puede tener ambos modos sin que se mezclen.

---

## Módulos profesionales

### Solaria Legal (primera fase)

Vista alternativa completa centrada en casos y clientes.

```
[Logo]  ⚖️ Área Legal

⚡ ACCIONES RÁPIDAS
  ├─ Nuevo caso
  ├─ Nuevo documento
  ├─ Nueva tarea/plazo
  └─ Buscar en biblioteca

📁 CASOS ACTIVOS
  └─ [Caso Pérez vs Empresa X]
       ├─ 📄 Documentos
       ├─ ✅ Tareas / plazos
       ├─ 📝 Notas
       └─ ⚙️ Opciones

📚 BIBLIOTECA LEGAL
  ├─ Plantillas
  ├─ Jurisprudencia
  ├─ Doctrina
  └─ Legislación

⏰ PLAZOS PRÓXIMOS
  ├─ [Hoy] Presentar demanda
  └─ [Mañana] Responder requerimiento

🗄️ CASOS ARCHIVADOS
```

#### Modelo de datos legal

```ts
interface LegalCase {
  id: string
  clientName: string
  caseName: string
  caseNumber?: string
  matterType: 'civil' | 'laboral' | 'penal' | 'mercantil' | 'administrativo' | 'familiar' | 'otro'
  status: 'active' | 'archived' | 'closed'
  path: string
  notes?: string
  createdAt: number
  updatedAt: number
}

interface LegalDeadline {
  id: string
  caseId: string
  title: string
  date: string
  priority: 'low' | 'medium' | 'high'
  completed: boolean
}

interface LegalDocument {
  id: string
  caseId?: string
  name: string
  path: string
  type: 'contract' | 'brief' | 'motion' | 'evidence' | 'note' | 'ruling' | 'other'
  createdAt: number
  updatedAt: number
}
```

#### Componentes a crear

- `LegalWorkspace.tsx` — panel legal completo
- `CaseCard.tsx` — tarjeta de caso con estado, plazos, documentos
- `CaseModal.tsx` — crear/editar caso
- `DeadlineList.tsx` — lista de plazos/tareas
- `DeadlineModal.tsx` — crear/editar plazo
- `LegalQuickActions.tsx` — botones de acción rápida
- `LegalDocumentRow.tsx` — fila de documento con icono por tipo
- `LibrarySection.tsx` — biblioteca legal con plantillas
- `useLegalWorkspace.ts` — hook de estado y persistencia

### Solaria Contable (futuro)

| Entidad | Función |
|---------|---------|
| Clientes | Datos fiscales, contactos, ejercicios |
| Facturas | Ingresos, gastos, IVA, estado de pago |
| Ejercicios fiscales | Años contables, declaraciones |
| Reportes | Balance, pérdidas y ganancias, estado de resultados |
| Plazos | Vencimientos fiscales, presentaciones |

### Solaria Comercio / Retail (futuro)

| Entidad | Función |
|---------|---------|
| Clientes | Historial de compras, contactos |
| Productos | Inventario, stock, precios, categorías |
| Ventas | Tickets, facturas, reportes diarios |
| Proveedores | Órdenes de compra, pagos pendientes |
| Gastos | Registro operativo |
| Reportes | Ventas del mes, productos más vendidos |

### Solaria Médico (futuro)

| Entidad | Función |
|---------|---------|
| Pacientes | Datos anonimizados, historial |
| Consultas | Notas de evolución, diagnósticos |
| Bibliografía | Artículos, PubMed, guías clínicas |
| Plazos | Controles, citas, recordatorios |

### Otras áreas recomendadas

| # | Área | Mercado | Complejidad |
|---|---|---|---|
| 1 | Contable | Despachos contables | Media |
| 2 | Comercio / Retail | Tiendas, PYMES | Media |
| 3 | Médico | Clínicas, consultorios | Alta (cumplimiento) |
| 4 | Recursos Humanos | PYMES, consultoras | Media |
| 5 | Inmobiliaria | Agentes, constructoras | Media |
| 6 | Marketing / Agencias | Community managers | Media |
| 7 | Educación | Profesores, academias | Baja |
| 8 | Ingeniería / Construcción | Proyectos de obra | Media-Alta |
| 9 | Consultoría | Independientes | Baja |
| 10 | Investigación / R&D | Universidades, labs | Alta |

---

## Motor de documentos

### Capacidades a implementar

1. **PDF parser** — extraer texto, tablas, metadatos.
2. **DOCX / XLSX / PPTX parser** — leer documentos Office.
3. **OCR local** — para PDFs escaneados e imágenes (Tesseract).
4. **Generación de documentos** — plantillas exportables a DOCX/PDF.
5. **Visor de documentos** — extender `WikiViewerAside` para mostrar PDFs y Office.

### Herramientas sugeridas

- **Rust:** `lopdf`, `pdf-extract`, `calamine` (Excel), `docx-rs`.
- **Python sidecar:** `pymupdf`, `python-docx`, `openpyxl`, `python-pptx`, `pytesseract`.
- **OCR:** Tesseract OCR local.

---

## Sistema de licencias

### Modelo dual: fija + suscripción

Solaria soporta dos tipos de licencia para adaptarse a diferentes usuarios:

```json
{
  "version": 1,
  "product": "solaria-legal",
  "license_type": "fixed" | "subscription",
  "plan": "monthly" | "yearly" | "1year" | "2year" | "lifetime",
  "machine_id": "sha256-de-la-maquina",
  "modes": ["general", "legal"],
  "seats": 1,
  "issued_at": "2026-07-18",
  "expires": "2027-07-18",
  "renew_url": "https://solaria.app/renew/abc123",
  "signature": "rsa-sha256-..."
}
```

### Diferencias entre fija y suscripción

| Campo | Fija | Suscripción |
|-------|------|-------------|
| `license_type` | `"fixed"` | `"subscription"` |
| `plan` | `"1year"`, `"2year"`, `"lifetime"` | `"monthly"`, `"yearly"` |
| `expires` | Fecha fija | Fecha de siguiente renovación |
| Renovación | Manual al vencer | Nuevo archivo de licencia tras pago |

### Seguridad

Para evitar manipulación del `license.json`:

1. **Firma criptográfica** — el archivo se firma en el servidor con una clave privada; la app verifica con la clave pública.
2. **Vinculación al hardware** — el `machine_id` se genera a partir de MAC, serial de disco y placa base.
3. **Verificación en Rust** — nunca en JavaScript; la verificación ocurre en el binario de Tauri.
4. **Ofuscación del binario** — builds de release optimizados, sin símbolos de debug; opcionalmente ofuscadores como VMProtect o Themida.

### Niveles de protección

| Amenaza | Protección |
|---------|-----------|
| Usuario común edita JSON | Firma + verificación |
| Compartir licencia entre PCs | Hardware binding |
| Desarrollador intenta crack | Verificación en Rust + ofuscación |
| Hacker avanzado | Licencia cifrada + ofuscación avanzada |

### Flujo de activación

1. Usuario instala Solaria.
2. Solaria genera el `machine_id` de la PC.
3. Usuario compra en la web e ingresa el `machine_id`.
4. El servidor genera y firma el `license.json`.
5. Usuario descarga el archivo y lo coloca en `~/.solaria/license.json`.
6. Solaria (Rust) verifica firma + hardware + expiración.
7. Si la licencia expira, el modo profesional se bloquea, pero los datos se conservan.

---

## Packaging de productos

Cada producto desbloquea uno o varios modos de workspace.

| Producto | Modos desbloqueados | Target |
|----------|---------------------|--------|
| **Solaria Core** | General | Desarrolladores, usuarios técnicos |
| **Solaria Legal** | General + Legal | Abogados, bufetes |
| **Solaria Contable** | General + Accounting | Contadores, despachos fiscales |
| **Solaria Comercio** | General + Commerce | Tiendas, retail, PYMES |
| **Solaria Médico** | General + Medical | Médicos, clínicas |
| **Solaria Proyectos** | General + Architecture + Design | Arquitectos, diseñadores |
| **Solaria Enterprise** | Todos | Grandes firmas, multi-departamento |

### Combinaciones

| Combo | Modos | Ideal para |
|-------|-------|------------|
| **Solaria Estudio** | Legal + Contable | Despacho legal-fiscal |
| **Solaria Clínica** | Médico + Contable | Clínicas privadas |
| **Solaria Full** | Todos | Grandes empresas |

---

## Modelos de precios recomendados

### Referencia de mercado

| Producto | Modelo | Precio aproximado |
|----------|--------|-------------------|
| Claude Pro | Individual | $20/mes |
| Claude Team | Por asiento | $30/asiento/mes |
| Claude Enterprise | Custom | Negociado |
| GitHub Copilot Pro | Individual | $10/mes |
| GitHub Copilot Business | Por asiento | $19/asiento/mes |
| GitHub Copilot Enterprise | Por asiento | $39/asiento/mes |

### Propuesta para Solaria

| Producto | Precio recomendado | Notas |
|----------|-------------------|-------|
| **Solaria Core** | Gratis / $9/mes | Chat + agente general |
| **Solaria Legal Personal** | $19/mes o $190/año | 1 usuario, modos legal + general |
| **Solaria Legal Team** | $35/asiento/mes | Hasta 10 usuarios, compartir casos |
| **Solaria Contable** | $19/mes o $190/año | Similar a Legal |
| **Solaria Comercio** | $15/mes o $150/año | Precio más accesible para PYMES |
| **Solaria Enterprise** | Custom | Todos los modos, SSO, auditoría, soporte |

**Ventaja competitiva:** Solaria es **local-first**. Eso justifica precios similares a Claude Team con el argumento de que los documentos de los clientes nunca salen de la máquina del bufete.

---

## Roadmap de implementación

### Fase B — Julio: Rediseño del Workspace Legal

1. **Arquitectura del workspace router**
   - Mover `WorkspaceAside.tsx` a `src/components/workspace/`.
   - Crear `GeneralWorkspace.tsx` y `LegalWorkspace.tsx`.
   - Crear `WorkspaceAside.tsx` como router.

2. **Selector de modo profesional**
   - Agregar `workspaceMode` en `useSettings.ts`.
   - Añadir selector en `SettingsPanel.tsx`.

3. **Modelo de datos legal**
   - Crear `useLegalWorkspace.ts`.
   - Persistencia inicial en `localStorage`, con diseño preparado para migración a SQLite.

4. **UI legal**
   - `LegalQuickActions.tsx`
   - `CaseList.tsx` y `CaseCard.tsx`
   - `CaseModal.tsx`
   - `DeadlineList.tsx` y `DeadlineModal.tsx`
   - `LibrarySection.tsx`

5. **Integración con el resto de la app**
   - `App.tsx` pasa `workspaceMode` al `WorkspaceAside`.
   - Conversaciones pueden asociarse a un caso legal.

### Fase A — Agosto: Motor de documentos

1. **Parser de documentos**
   - PDF, DOCX, XLSX, PPTX.

2. **OCR local**
   - Tesseract para PDFs escaneados e imágenes.

3. **Visor de documentos**
   - Extender `WikiViewerAside` para PDFs y Office.

4. **Generación de documentos**
   - Plantillas legales exportables a DOCX/PDF.

5. **Persistencia robusta**
   - Migración de `localStorage` a SQLite.

### Posteriores

1. **Sistema de licencias** por máquina (fija + suscripción).
2. **Contable workspace**.
3. **Comercio workspace**.
4. **Médico workspace**.
5. **Marketplace de skills e integraciones**.

---

## Notas de implementación

### Almacenamiento

- **Fase B:** `localStorage` para casos, plazos y documentos legales.
- **Fase A:** migración a SQLite para soportar volúmenes mayores de documentos y cumplimiento.

### Integraciones

- **Apps nativas:** Excel, Word, PowerPoint, LibreOffice.
- **Email:** IMAP/SMTP.
- **Calendario:** Google Calendar / Outlook.
- **Cloud storage:** Google Drive, OneDrive, Dropbox vía MCP.

### Cumplimiento

- **Legal:** modo confidencial, advertencia de privilegio abogado-cliente, logs de acceso.
- **Médico:** anonimización de pacientes, modo HIPAA/GDPR, auditoría.
- **General:** exportación de logs, backup local, encriptación.

---

## Estado del documento

- **Versión:** 1.0
- **Fecha:** 2026-07-18
- **Área inicial:** Legal
- **Próxima fase:** Rediseño del WorkspaceAside con modo legal.
