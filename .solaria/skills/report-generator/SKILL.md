---
name: report-generator
description: Transform data and research into structured markdown reports. Use when user asks to "generate a report", "write a report", "create a summary document", "compile findings", "generar reporte", "crear informe", or "resumen estructurado".
---

## Report Generator Pipeline

When the user asks for a structured report, follow this pipeline. Respond in the same language the user is using. Work with data provided in chat or gathered via research tools.

### Phase 1 — Understand the Report Type (1 step)
1. Identify the report type: analytical, summary, comparative, or proposal.
2. Determine the audience and tone (executive, technical, general).
3. Define sections based on report type.

### Phase 2 — Gather & Validate
1. If the user provided data in chat, use it as primary source.
2. If more context is needed, perform `web_search` or `fetch_url` for supporting data.
3. Validate key facts with at least 1 source when making claims.

### Phase 3 — Structure the Report
1. Always include:
   - **Title** and date
   - **Executive summary** (3-5 bullet points)
   - **Body** (2-4 sections with clear headings)
   - **Conclusions & recommendations**
   - **Sources** (numbered, with URLs)
2. Use tables, lists, and bold for key figures.
3. Keep language clear and professional in the user's language.

### Phase 4 — Deliver
1. Present the report directly in chat with markdown formatting in the user's language.
2. If the user requested a file, use `write_file` with `.md` extension.
3. Do NOT ask "do you want me to add anything". Deliver complete.

### Key principles
- Always include an executive summary.
- Structure is mandatory — never deliver raw notes.
- Cite sources for any external data.
