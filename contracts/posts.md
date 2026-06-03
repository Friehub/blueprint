# Module Contract: `posts`

**Version:** 0.1.0

---

### `posts`
User-generated content publishing.

**Functions**
```
createPost(author_id, content, options?) → Post
getPost(post_id) → Post
updatePost(post_id, content) → Post
deletePost(post_id) → void
getFeed(user_id, options?) → PaginatedResult<FeedItem>
getPostsByUser(user_id, options?) → PaginatedResult<Post>
pinPost(post_id) → void
unpinPost(post_id) → void
moderatePost(post_id, decision, reason?) → Post
```

**Types**
```
Post { id, author_id, content, media?, status, pinned, created_at, metadata }
PostContent { text?, media?: Media[], links?: string[] }
FeedItem { post, engagement_score, reason? }
PostStatus = published | draft | archived | removed
PostVisibility = public | followers | private
```

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
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `posts.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log
