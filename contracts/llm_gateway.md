# Module Contract: `llm_gateway`

**Version:** 0.2.1

---

### `llm_gateway`
Unified routing to LLM providers with context management, streaming, token accounting, and fallback.

**Functions**
```
chat(messages, options?) → ChatResponse
chatStream(messages, options?) → AsyncIterator<ChatChunk>
getModels() → Model[]
getModelInfo(model) → ModelInfo
countTokens(text) → TokenCount
estimateCost(model, input_tokens, output_tokens) → CostEstimate
abortRequest(request_id) → void
```

**Types**
```
ChatResponse { id, model, choices: Choice[], usage: TokenUsage, latency_ms }
ChatChunk { id, model, delta: PartialChoice, usage?: TokenUsage, done: bool }
Choice { index, message: ResponseMessage, finish_reason: stop|length|content_filter|tool_calls }
ResponseMessage { role, content?, tool_calls? }
TokenUsage { input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost }
Model { id, name, provider, capabilities: Capability[], context_window, input_cost_per_1k, output_cost_per_1k }
ModelInfo { id, provider, context_window, max_output_tokens, supported_params, pricing, latency_p50, latency_p99 }
TokenCount { input_tokens, character_count, encoding }
CostEstimate { model, input_tokens, output_tokens, estimated_cost, currency }
ChatOptions { model?, temperature?, max_tokens?, top_p?, stop?, stream?, tools?, response_format?, fallback_models?, request_timeout? }
Capability = chat | streaming | tools | vision | json_mode | function_calling
```

**Invariants**
- `chat` must return a complete response; partial or interrupted responses must surface an error
- `chatStream` must emit a final chunk with `done: true` and accumulated usage when complete
- The gateway must enforce `context_window` limits -- if total tokens exceed the model's limit, it must reject or truncate rather than silently fail
- All user-supplied inputs passed to `chat` or `chatStream` must be screened by `content_safety.checkContent` with the `prompt_injection` policy enabled before being used as part of a prompt. Requests containing prompt injection must be rejected.

**Providers:** OpenAI, Anthropic, Google Vertex AI, AWS Bedrock, NVIDIA NIM, Ollama, together.ai, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** LLM responses are non-deterministic; caching may serve identical responses for identical inputs within the cache window

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for API calls to providers.
* **Details:** Duplicate requests with the same idempotency key must return the same cached response if completed.

### Worker Scaling
* **Policy:** Chat requests, streaming, and token counting must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether LLM calls are routed regionally or through a central gateway.
* **Details:** Cost tracking must be aggregated globally even if routing is regional.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If all models are rate-limited or unavailable, the gateway must return a `model_unavailable` error with estimated retry time rather than queuing indefinitely.

### Error Taxonomy
### Module-Specific Errors
```
chat / chatStream:
    model_unavailable:        Requested model is down or rate-limited | retry with fallback model
    context_window_exceeded:  Total tokens exceed model's context window | reduce input or use smaller model
    content_filtered:         Response was blocked by provider content filter | adjust prompt or use different model
    request_aborted:          Request was cancelled via abortRequest | discard chunk stream
    token_limit_exceeded:     Output exceeded max_tokens | increase max_tokens or trim output

  getModelInfo:
    model_not_found:          Model not available on this gateway instance | call getModels for available list

  countTokens:
    text_too_long:            Input text exceeds the tokenizer's maximum input length | truncate before counting
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
chat / chatStream → llm.request.started  { model, input_tokens, request_id }
                 → llm.request.completed { model, input_tokens, output_tokens, latency_ms, cost, finish_reason }
                 OR llm.request.failed   { model, request_id, error, latency_ms }
```

### Temporal Constraints
```
Request timeout:
    default:        60 seconds  (non-streaming)
    stream:         configurable per stream, default 120 seconds
    on_expiry:      abort request and return timeout error

  Fallback delay:
    duration:       2 seconds  (delay before trying fallback model)
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `llm_gateway.<function>`.
* **Telemetry Metrics:**
```
blueprint_llm_gateway_requests_total           { model, provider, status }
  blueprint_llm_gateway_latency_ms               histogram { model }
  blueprint_llm_gateway_tokens_total              { model, direction: input|output }
  blueprint_llm_gateway_cost_total                { model, provider, currency }
  blueprint_llm_gateway_fallback_count           { primary_model, fallback_model }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| All models unavailable | Return model_unavailable with estimated retry time and available fallback list |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |
| Content filter triggered | Return content_filtered error; log filter category for audit |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new model capability: non-breaking if consumers use capability detection; breaking otherwise
- Changing token counting algorithm: breaking — may affect cost estimates and usage tracking

### Module Dependencies
* **Depends On:** content_safety
* **Emits To:** events
* **Recommends:** caching (for response caching), telemetry, rate_limiting
