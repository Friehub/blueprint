# Saga: `llm_pipeline_execution`

**Version:** 0.1.0

**Modules:** llm_gateway → rag_pipeline → embeddings → prompt_registry → vector_store

---

## Steps

1. **validate_request(prompt_id, tenant_id)** -- Check prompt exists in registry, tenant has quota, and model is available.
   **Compensation:** none (read-only; quota check is idempotent)

2. **retrieve_context(tenant_id, query, vector_store_id)** → `ContextChunk[]`
   **Compensation:** `rag_pipeline.recycleContext(context_reference)` -- frees in-memory context buffers

3. **enrich_prompt(prompt_id, context_chunks, parameters)** → `CompiledPrompt`
   **Compensation:** `prompt_registry.invalidateCompilation(compilation_id)` -- discards enriched prompt cache entry

4. **call_llm(compiled_prompt, model_id)** → `LlmResponse`
   **Compensation:** `llm_gateway.discardResponse(response_id)` -- marks response for non-caching

5. **store_result(tenant_id, response_id, metadata)** → `ResultReference`
   **Compensation:** `vector_store.deleteEntry(result_reference)` -- removes stored result

6. **[async] emit_usage_event(tenant_id, model_id, tokens_used)** -- Record billing and usage metrics
   **Compensation:** `llm_gateway.reverseUsageEvent(event_id)` -- reverses token count (only if unconsumed)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Tenant quota exhausted or model unavailable | Return `quota_exceeded` or `model_unavailable` error |
| 3 | Context exceeds model context window | Truncate with sliding window; recompile prompt |
| 4 | LLM provider timeout or returns error | Retry with fallback model; return fallback response |
| 6 | Usage event emission fails | Cache locally; batch-upload on next successful call |

---

## Invariants

- Total prompt tokens must never exceed the model's context window limit
- All LLM responses must be attributable to a specific tenant and prompt version
- Usage events must be exactly-once delivered for billing accuracy
