# Module Contract: `graphql`

**Version:** 0.1.0

---

### `graphql`
GraphQL schema definition, resolver contracts, and subscription management with N+1 prevention.

**Functions**
```
defineSchema(type_defs) → GraphQLSchema
defineResolver(type_name, field_name, resolver) → ResolverDefinition
createDataLoader(batch_fn, options?) → DataLoader
executeQuery(query, variables?, context?) → ExecutionResult
executeMutation(query, variables?, context?) → ExecutionResult
createSubscription(subscription_def, handler) → Subscription
publishSubscription(topic, payload) → void
```

**Types**
```
GraphQLSchema { types: TypeDefinition[], queries: FieldDef[], mutations: FieldDef[], subscriptions: FieldDef[] }
TypeDefinition { name, fields: FieldDef[], interfaces?, description }
FieldDef { name, type, args?: ArgDef[], resolver?: ResolverRef, description }
ArgDef { name, type, required, default? }
ResolverDefinition { type_name, field_name, batch: bool, dataloader?: bool }
DataLoader { load(key), loadMany(keys), clear(key), prime(key, value) }
ExecutionResult { data?, errors?: GraphQLError[], extensions? }
Subscription { topic, filter?, handler, buffer_size? }
GraphQLError { message, path, locations?, extensions }
```

**Invariants**
- `executeQuery` must resolve fields in order of declaration within a single type — field ordering must be deterministic
- A resolver that uses `DataLoader` must batch all keys from a single parent selection before resolving — N+1 queries are a contract violation
- `createSubscription` must support backpressure — if the subscriber is slower than the publisher, the buffer must fill before dropping events rather than unbounded memory growth
- Schema changes that remove a field must be preceded by a deprecation period of at least one major version

**Providers:** Apollo Server, Yoga GraphQL, GraphQL.js, codegen, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Schema definitions must be immediately consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for query/mutation responses; `at_least_once` for subscription events.
* **Details:** Subscription consumers must be idempotent. Duplicate events are possible on reconnection.

### Worker Scaling
* **Policy:** Query execution, resolver resolution, and subscription publishing must be independently scalable.

### Multi-Region Behavior
* **Mode:** Schema is global; data fetching is per-region.
* **Details:** Subscriptions must be routed to the region closest to the subscriber.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When subscription publishing is saturated, the module must apply backpressure to the publisher rather than dropping events or unbounded buffering.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
publishSubscription → graphql.subscription.published { topic, subscriber_count }
  executeQuery       → graphql.query.executed      { operation_name, complexity_score }
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `graphql.<function>`.
* **Telemetry Metrics:**
```
gensense_graphql_queries_total           { operation_name, result }
  gensense_graphql_field_resolve_duration_ms  histogram { type_name, field_name }
  gensense_graphql_subscription_events_total   { topic }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external GraphQL library or provider)
* **Emits To:** events
* **Recommends:** caching (for DataLoader memoization), rate_limiting (for query complexity limits), telemetry
