---
name: meeting-notes
description: Transform raw meeting notes or transcripts into structured summaries with action items. Use when user asks to "summarize meeting", "organize notes", "extract action items", "meeting minutes", "process transcript", "resumir reunión", "organizar notas", or "minuta".
---

## Meeting Notes Pipeline

When the user provides raw notes or a transcript, follow this pipeline to produce a clean, structured summary. Respond in the same language the user is using.

### Phase 1 — Parse the Input
1. Identify if input is:
   - **Raw notes** (bullet points, fragmented)
   - **Full transcript** (dialog, speaker labels)
   - **Audio/video mention** (user mentions a meeting but provides no text — ask for the notes)
2. Mentally extract: topics discussed, decisions made, open questions.

### Phase 2 — Structure the Notes
1. Organize into sections:
   - **Meeting info** (date, topic, participants — infer or leave placeholder)
   - **Summary** (3-5 lines of what happened)
   - **Key discussion points** (bulleted, grouped by topic)
   - **Decisions made**
   - **Action items** (owner + deadline if mentioned)
   - **Next steps / follow-up**
2. Use clean markdown with bold for decisions and action items.

### Phase 3 — Action Item Extraction
1. Every action item must be a clear sentence: `[Persona/Person]: [acción/action] ([fecha/date])`.
2. If no owner is specified, mark as `Pending: [action]` or `Pendiente: [acción]` depending on the user's language.
3. Group by priority if identifiable.

### Phase 4 — Deliver
1. Present the structured notes in chat in the user's language.
2. **Use `write_file` only if explicitly requested**.
3. Do NOT ask "is this correct?" — deliver and let the user react.

### Key principles
- Every decision and action item must be explicit.
- Preserve all key information — do not hallucinate details.
- If participant names or dates are missing, leave `[Pending]` / `[Pendiente]` markers in the user's language.
