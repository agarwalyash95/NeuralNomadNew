# AI & Conversation Architecture
## Providers
- Primary AI is assumed to be an LLM (e.g., Gemini or OpenAI) called from `ConversationService` and `PlanGenerationJob`.
- Prompts are generated and assembled dynamically in `apps/planner/services/`.

## Risks
- Hallucination: The AI might generate `activity` blocks with fake IDs or locations that do not map to `ActivityMaster`.
- Output Repair: Non-JSON or malformed JSON from the LLM requires strict fallback or retry logic.
