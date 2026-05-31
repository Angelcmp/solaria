---
name: market-analysis
description: Analyze competitors, market trends, and draft campaign strategies. Use when user asks to "analyze market", "competitor analysis", "research industry", "market trends", "campaign strategy", "analizar mercado", "análisis de competencia", or "investigar industria".
---

## Market Analysis Pipeline

When the user requests market or competitive analysis, follow this pipeline autonomously. Respond in the same language the user is using (English, Spanish, or any other). Do not ask clarifying questions unless the request is truly ambiguous.

### Phase 1 — Scope Definition (1 step)
1. Identify the industry, product, or company to analyze.
2. Determine 2-3 key angles: competitors, trends, target audience, or pricing.
3. Proceed directly with research — do not ask the user to confirm.

### Phase 2 — Gather Intelligence
1. **Start with 1 broad `web_search`** for the industry/company overview.
2. **Perform 1-2 focused searches**: competitors, market size, recent news.
3. **Fetch at least 2 sources** with `fetch_url` (reports, news, company pages).
4. **If a fetch fails**, pick another result immediately. Max 4 fetch attempts total.
5. Extract: key players, differentiators, pricing models, market positioning.

### Phase 3 — Synthesize
1. Structure findings into:
   - **Market overview** (size, growth, key players)
   - **Competitor landscape** (strengths/weaknesses per competitor)
   - **Opportunities & threats**
   - **Trends** (tech, regulatory, consumer behavior)
2. Cite every claim with sourced URLs.
3. If data is scarce, state limitations honestly. Use the user's language for all output.

### Phase 4 — Deliver
1. Present findings in chat with clean markdown in the user's language.
2. Use tables for competitor comparisons.
3. Include numbered sources at the bottom.
4. **Only use `write_file` if explicitly asked**. Otherwise respond in chat.

### Key principles
- Minimum 2 sources fetched. No exceptions.
- Always cite. Never fabricate data.
- No questions — deliver the analysis.
