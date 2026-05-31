---
name: transcription-processing
description: Process raw text transcripts or speech-to-text output into clean, structured executive summaries. Use when user asks to "summarize this transcript", "process transcription", "extract key points from audio", "meeting transcript", "lecture notes", "resumir transcripción", "procesar transcripción", or "notas de audio".
---

## Transcription Processing Pipeline

When the user provides a raw transcript (speech-to-text output, dialogue, or lecture), follow this pipeline. Respond in the same language the user is using.

### Phase 1 — Parse & Clean (1 step)
1. Identify the format:
   - **Dialog transcript** (speaker labels, timestamps)
   - **Monologue / lecture** (continuous speech)
   - **Raw STT output** (no punctuation, run-on text)
2. Clean mentally: remove filler words ("um", "ah", "eh"), false starts, repetitions.

### Phase 2 — Extract Structure
1. Identify the main topics or segments.
2. For dialog: group by topic, not by speaker.
3. For monologue: identify introduction, key points, conclusion.
4. Note any: dates, numbers, decisions, names, or action items.

### Phase 3 — Build the Summary
1. Structure into:
   - **Title and estimated duration**
   - **Executive summary** (3-5 lines)
   - **Key topics** (bulleted, with timestamps if available)
   - **Important quotes** (if notable)
   - **Action items / follow-ups** (if any)
2. Use clean, professional language in the user's language.

### Phase 4 — Deliver
1. Present the summary in chat with markdown formatting in the user's language.
2. Include a confidence note in the user's language:
   - EN: "Based on unprocessed transcription — may contain errors."
   - ES: "Basado en transcripción sin procesar — puede contener errores."
3. **Use `write_file` only if explicitly requested.**

### Key principles
- Condense without losing key information.
- Do not invent details or quotes.
- Flag unclear sections in the user's language: `[inaudible]` (EN) / `[no claro]` (ES).
- Preserve all named entities (people, companies, products).
