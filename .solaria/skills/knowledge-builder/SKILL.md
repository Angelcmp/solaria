---
name: knowledge-builder
description: Build and maintain a personal knowledge base — process content into structured wiki files, cross-link concepts, and answer questions from accumulated knowledge. Use when user asks to "save this to my wiki", "build knowledge base", "index this", "create a note from this", "what do I know about X", "organize my research", "guardar en wiki", "base de conocimiento", or "crear nota".
---

## Knowledge Builder Pipeline

You are building the user's personal knowledge base from files in the project folder. Every file you read, every concept you extract, and every summary you write becomes part of an interconnected wiki that grows over time. Respond in the same language the user is using.

### Phase 1 — Understand the Request

Determine what the user wants:

1. **Import**: "take this article and save it to my knowledge base" / "guardar este artículo en la wiki"
2. **Summarize**: "summarize this research into a note" / "crear un resumen de esta investigación"
3. **Connect**: "find anything related to [topic] in my notes" / "busca información sobre [tema] en mis notas"
4. **Query**: "what do I know about [topic]?" / "¿qué sé sobre [tema]?"
5. **Build index**: "create an index for all my notes" / "crear un índice de mis notas"

### Phase 2 — Gather & Read

1. If the user provides a URL → use `fetch_url` to get the content
2. If the user pastes text → use it directly
3. If the user asks about existing knowledge → use `glob` to find relevant `.md` files in the project
4. Use `read_file` to read existing notes for context and cross-linking

### Phase 3 — Process & Structure

For each piece of knowledge to save, create a markdown file in the project folder with this structure:

```markdown
# [Title]
> Source: [URL or reference]
> Tags: #tag1 #tag2
> Created: YYYY-MM-DD

## Summary
[2-3 sentence summary in the user's language]

## Key Concepts
- **Concept 1**: Explanation
- **Concept 2**: Explanation

## Details
[Main content, organized in sections]

## Related
- [[other-note]] — relationship description
- [[another-note]] — relationship description
```

### Phase 4 — Cross-Link

After writing a new note:
1. Use `grep` to search for mentions of the new file's key concepts across existing `.md` files
2. If related files exist, add `[[new-file]]` links to those existing files using `write_file`
3. In the new file's "Related" section, link back to those files

### Phase 5 — Deliver

1. Confirm what was saved: "Note created: `[filename].md` with [N] concepts and linked to [N] related files"
2. If answering a query, cite which files contain the relevant information
3. Suggest related concepts the user might want to explore

### Key principles
- File names: lowercase, hyphens, descriptive (e.g. `ai-market-2026.md`)
- Always include source attribution when importing from URLs
- Never overwrite existing files without asking
- Use `[[wikilinks]]` for cross-references between notes
- Add tags to every note for discoverability
- The knowledge base lives in the project folder — respect the working directory
