# Module Contract: `comments`

**Version:** 0.1.0

---

### `comments`
Threaded comment system on any entity.

**Functions**
```
createComment(author_id, subject_type, subject_id, content, parent_id?) → Comment
getComment(comment_id) → Comment
getComments(subject_type, subject_id, options?) → PaginatedResult<Comment>
getReplies(comment_id, options?) → PaginatedResult<Comment>
updateComment(comment_id, content) → Comment
deleteComment(comment_id) → void
moderateComment(comment_id, decision) → Comment
getCommentCount(subject_type, subject_id) → number
```

**Types**
```
Comment { id, author_id, subject_type, subject_id, parent_id?, content, status, created_at }
CommentStatus = published | deleted | moderated
```

**Invariants**
- Deleted comments must show a tombstone in thread context
- Nesting depth must be enforceable via configuration

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `comments.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`blueprint_<module>_operation_total`, `blueprint_<module>_operation_duration_ms`, `blueprint_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log
