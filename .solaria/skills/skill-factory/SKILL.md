---
name: skill-factory
description: Create and manage project skills from chat. Use when user asks to "create a skill", "save this as a skill", "make a skill", "guardar como skill", "crea una skill", or "genera una skill".
---

## Skill Factory Pipeline

When the user asks to create or save a skill, follow this pipeline. Respond in the same language the user is using (English, Spanish, or any other). You have the working directory available in your system prompt — use it to construct absolute paths.

### Phase 1 — Understand the Request
1. Determine if the user wants to:
   - **Create from scratch**: user says "create a skill that does X" / "crea una skill que haga X"
   - **Save current process**: user says "save this as a skill" / "guarda esto como una skill"
2. If creating from scratch, clarify briefly what the skill should do (1 question max).
3. If saving the current process, review what was done in the conversation and extract the pattern.

### Phase 2 — Design the Skill
1. Choose a **slug name** (lowercase, hyphens): e.g. `sentiment-analysis`
2. Write a **description** (1 sentence, present tense, in the user's language)
3. Design the **pipeline** (2-4 phases):
   - Phase 1 — always a planning/scope step
   - Middle phases — the core workflow (search, fetch, analyze, etc.)
   - Final phase — delivery format
4. Include **key principles** at the end (3-5 rules)

### Phase 3 — Generate SKILL.md
Use this exact frontmatter format:

```
---
name: <slug>
description: <1-sentence description>
---
```

The frontmatter description should be in English regardless of user's language, so the Skills panel always shows descriptions consistently.

Body phases, headings, and instructions should be in the user's language (English or Spanish).

### Phase 4 — Write the File
1. Construct the absolute path: `<working_dir>/.solaria/skills/<slug>/SKILL.md`
2. Use `write_file` to save it.
3. Confirm with the user in their language:
   - EN: "Skill created at `.solaria/skills/<slug>/`. It will appear in your Skills panel."
   - ES: "Skill creada en `.solaria/skills/<slug>/`. Aparecerá en tu panel Skills."

### Examples

**EN — User says "create a skill that analyzes review sentiment":**
```
slug: sentiment-analysis
description: Analyze customer reviews for sentiment, key themes, and actionable insights.

Phases: Parse reviews → Identify sentiment scores → Extract themes → Deliver summary
```

**ES — User dice "crea una skill que analice reseñas":**
```
slug: review-analyzer
description: Analyze product reviews to extract ratings, common complaints, and positive highlights.

Fases: Parsear reseñas → Identificar puntuaciones → Extraer temas → Entregar resumen
```

### Key principles
- Always generate valid frontmatter. Use quotes around description if it contains special characters.
- Include minimum 2 phases, maximum 5 phases.
- Every phase must have actionable bullet points.
- Always ask before overwriting an existing skill.
- The SKILL.md must be placed inside a subdirectory named after the skill slug.
- The frontmatter `description` field should be in English always; the body content matches the user's language.
