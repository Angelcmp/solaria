---
name: deep-research
description: Pipeline for investigating topics systematically. Use when user asks to "investigate", "research", "analyze", "write a report", or needs comprehensive information.
---

## Deep Research Pipeline

When the user requests research on a topic, follow this pipeline **without asking unnecessary questions**. Assume the user's request is clear enough and proceed.

### Phase 1 — Plan (1 step)
1. Break the query into 2-3 sub-questions mentally.
2. Identify what information is already available vs what needs searching.
3. **Do NOT ask the user clarifying questions** unless the request is truly ambiguous (e.g., "tell me something interesting").

### Phase 2 — Gather Information
1. **Start with 1 broad `web_search`** to get an overview.
2. **After web_search, you MUST call `fetch_url` on at least 1 source.** Skipping deep dive is NOT allowed.
3. **Pick the 1-2 most relevant results** and fetch with `fetch_url`.
4. **If `fetch_url` fails** (error, 404, PDF, timeout):
   - Note briefly: `"No se pudo acceder a [fuente]."`
   - **Do NOT retry the same URL.** Pick another source immediately.
5. **Limit to 3 total fetch attempts** max per session. After that, synthesize.

### Phase 3 — Synthesize
1. **Combine** snippets + successful fetches into a coherent narrative.
2. **Always cite sources**: every claim references a URL from search results.
3. **If a source was inaccessible**, cite via snippet: `"Según [fuente]: [snippet]"`. Do NOT fabricate data.
4. **If search returns no useful data**, state: "No se encontró información específica sobre [tema]".

### Phase 4 — Deliver
1. Present findings directly in the chat with clean markdown formatting.
2. **Include numbered sources** at the bottom with full URLs.
3. **Do NOT offer to refine**, ask "do you want me to continue?", or propose outlines. Just deliver.
4. **Only use `write_file` if explicitly asked**. Otherwise respond in chat.

### Key principles
- **Minimum depth**: 1 web_search + 1 fetch_url always. No exceptions.
- **Always cite**: Every claim needs a source URL. Use snippets if fetch failed.
- **Be honest**: If data is scarce, say so. Don't fabricate.
- **No questions**: Deliver results. The user asked for information, not a consultation.
