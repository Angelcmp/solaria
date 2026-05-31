---
name: data-analysis
description: Analyze structured data (CSV, tables) — clean, transform, summarize, and present insights. Use when user asks to "analyze this data", "process CSV", "clean dataset", "make a table", "chart", "data insights", "analizar datos", "procesar CSV", or "limpiar datos".
---

## Data Analysis Pipeline

When the user provides structured data (CSV, JSON, or tabular text), follow this pipeline. Respond in the same language the user is using. Work with the data as text — do not execute code.

### Phase 1 — Understand the Data (1 step)
1. Inspect the data: headers, row count, data types (text, numbers, dates).
2. Identify missing values, inconsistencies, or formatting issues.
3. Briefly describe what you see: "This dataset has 120 rows and 8 columns..." (in the user's language).

### Phase 2 — Clean & Transform
1. Note any issues found:
   - Missing values
   - Inconsistent formatting (dates, currencies)
   - Outliers or suspicious entries
2. Suggest cleaning steps (you cannot modify files, but can guide the user).
3. Transform data mentally into summaries.

### Phase 3 — Analyze
1. Calculate key metrics (counts, totals, averages, min/max) — do this manually from the data.
2. Identify patterns, trends, or correlations.
3. Compare categories or time periods if applicable.
4. Present as markdown tables for clarity.

### Phase 4 — Deliver
1. Present analysis in chat in the user's language with:
   - **Data overview** (size, columns, quality)
   - **Key metrics** (formatted table)
   - **Insights** (3-5 bullet points)
   - **Recommendations** (if applicable)
2. Use markdown tables for numerical results.
3. Do NOT ask "want me to go deeper" — deliver complete findings.

### Key principles
- Be transparent about data limitations.
- Do not fabricate numbers — calculate from visible data.
- Present tables for all quantitative findings.
- No code execution — all analysis is descriptive and manual.
