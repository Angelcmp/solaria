---
name: skills-discover
description: Search, browse, and install skills from the skills.sh registry directly from chat. Use when user asks to "find a skill", "search skills", "browse skills.sh", "install skill", "look for a skill", "buscar skills", "encontrar skill", "instalar skill", or "skills disponibles".
---

## Skills Discovery Pipeline

When the user wants to discover, browse, or install skills from the skills.sh registry, follow this pipeline. Respond in the same language the user is using.

### Phase 1 — Understand the Request
1. Determine what the user wants:
   - **Search**: "find a skill for X" / "buscar skill para X"
   - **Browse**: "what skills are available?" / "qué skills hay?"
   - **Install**: "install skill X" / "instala la skill X"
2. If the user just wants to browse, show trending/popular categories.

### Phase 2 — Search & Browse (skills.sh)
1. To browse available skills, use `fetch_url` on `https://skills.sh` to see the leaderboard.
2. To search for specific skills, use `web_search` with query like: `site:skills.sh <topic>`.
3. Present results as a table with: **Skill name**, **Description**, **Installs**.
4. Allow the user to pick one for details.

### Phase 3 — Get Skill Details
1. When the user picks a skill, fetch its details:
   - Search `web_search` for `"<owner>/<repo>" "<skill-name>" skills.sh` to find the source repo.
   - Or fetch `https://skills.sh` and infer the owner/repo from the search context.
2. Present: description, author, installs, and what it does.

### Phase 4 — Install the Skill
When the user wants to install, follow these steps:

1. **Determine the source URL**: Skills on skills.sh come from GitHub repos. The raw SKILL.md is typically at:
   ```
   https://raw.githubusercontent.com/<owner>/<repo>/main/<skill-name>/SKILL.md
   ```
   You may need to try `main` or `master` branch.

2. **Try to fetch the raw SKILL.md** using `fetch_url` to confirm it exists.

3. **Install location** — ask the user:
   - **Global** (`~/.agents/skills/<name>/SKILL.md`): available to all projects
   - **Project** (`.solaria/skills/<name>/SKILL.md`): only for current project

4. **Write the file** using `write_file`:
   - Create the directory and write the SKILL.md content.
   - Confirm: "Skill `<name>` installed in `<location>`. It will appear after reload."

5. **If the raw fetch fails** (404, wrong branch, etc.), guide the user:
   - EN: "Could not fetch directly. Install manually: `npx skills add <owner>/<repo>@<skill> -g`"
   - ES: "No se pudo obtener directamente. Instala manualmente: `npx skills add <owner>/<repo>@<skill> -g`"

### Phase 5 — Post-Install
1. Confirm the skill is now available in the project's `.solaria/skills/` or global `~/.agents/skills/`.
2. Suggest enabling it from the Skills panel if it's a global skill.

### Key principles
- Always confirm with the user before writing any file.
- If the raw GitHub URL fails, offer the npx command as fallback.
- Never overwrite an existing skill without asking.
- Show search results in a clean table format.
- Respect the user's language for all messages.
