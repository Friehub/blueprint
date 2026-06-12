# Report 02 — Contract Quality Audit

## Existing Contract Depth & Correctness Review

---

## Methodology

Every contract was reviewed against these criteria:

1. **Completeness** — Does it have Functions, Types, Invariants, and System-Level sections?
2. **Invariant strength** — Are invariants specific and enforceable, or vague and advisory?
3. **Error taxonomy** — Are all failure modes covered per function?
4. **Event emission** — Are events defined where the module should emit them?
5. **Database schema** — Does the module include its DDL where applicable?
6. **Distributed patterns** — Does the contract describe saga, outbox, or idempotency patterns where needed?
7. **Observability** — Are metrics and tracing spans defined?

---

## Grade Distribution

| Grade | Count | Meaning |
|---|---|---|
| A (Production-complete) | 14 | payments, auth, billing, orders, subscriptions, sessions, webhooks, notifications, queues, jobs, rate_limiting, audit_log, feature_flags, llm_gateway |
| B (Strong but incomplete) | 38 | Has invariants and types but missing some sections (typically DB schema or distributed patterns) |
| C (Functional but shallow) | 67 | Has functions and types. Invariants are weak or advisory. Missing system-level sections. |
| D (Skeleton only) | 43 | Functions and types only. No invariants, no system-level. Not useful for generation. |

---

## A-Grade Contracts (Examples of Correct Format)

### `payments` — Best Contract in the Catalog
- Covers all idempotency requirements with specific 7-day key retention
- Error taxonomy is exhaustive — every function has its failure codes
- Event emission covers all state transitions
- PostgreSQL DDL is complete and correct (with optimistic locking version column)
- Distributed patterns: outbox, idempotency table, optimistic locking — all correct
- Saga step definitions are realistic
- Observability metrics follow the `gensense_*` naming convention

### `auth` — Second Best
- CSRF invariants are specific and non-negotiable
- MFA session state machine is correctly modelled (partial session → active session)
- Refresh token rotation family tracking is a rare correctness detail most tools miss
- Error opaque code requirement is production-correct

---

## Systemic Weaknesses Found Across the Catalog

### Weakness 1 — Weak Invariants in C/D Grade Contracts

Many contracts have invariants that are advisory rather than enforceable. Examples:

**`calendar.md` (grade D):**
```
- Events must not overlap for the same attendee (no enforcement mechanism defined)
```
vs what it should be:
```
- createEvent must check for attendee conflicts before persisting.
  If conflict detected: return conflict_detected with conflicting_event_ids[]
- Conflict window: [start_at, end_at) is half-open — sharing an exact end/start time is not a conflict
- Recurring events must expand conflicts lazily per occurrence, not against the full series
```

**`inventory.md` (grade C):**
```
- Stock levels must not go negative
```
vs correct:
```
- decrementStock must use a database-level CHECK constraint to enforce non-negativity.
  Application-level check is insufficient under concurrent transactions.
  Use: UPDATE inventory SET qty = qty - $n WHERE id = $id AND qty >= $n RETURNING qty
  If 0 rows: return insufficient_stock error
- Reservation pattern: reserveStock(item_id, qty, reservation_id) → must hold reserved qty
  for configurable duration (default 15 minutes) before auto-release
```

### Weakness 2 — Missing Database Schemas (67 contracts affected)

The `payments`, `auth`, `billing`, `orders` contracts have excellent PostgreSQL DDL. But 67 other contracts that clearly need persistent storage have no schema at all. This is the biggest usability gap — a developer reading `inventory.md` gets zero help with the table design.

**Contracts that need schemas urgently:**
- `inventory` — stock levels, reservations, movements ledger
- `users` — profile, preferences, roles junction, soft-delete
- `sessions` — only partially defined, missing Redis hash structure
- `messaging` — conversations, participants, messages, read receipts
- `notifications` — notification records, delivery status, channel preferences
- `ledger` — double-entry ledger entries, account balances
- `loyalty` — points ledger, tiers, redemptions
- `referrals` — referral links, conversions, reward triggers
- `events` — event store table with partitioning
- `forms` — form definitions, submissions, field values (JSONB pattern)

### Weakness 3 — Event Emission Missing in Many Modules

Only ~30 contracts define their event emission section. Every module that mutates state should emit events. The contracts that are missing event definitions include:

- `inventory` — should emit `stock.depleted`, `stock.replenished`, `reservation.expired`
- `users` — should emit `user.created`, `user.deactivated`, `profile.updated`
- `messaging` — should emit `message.sent`, `conversation.started`, `message.deleted`
- `permissions` — should emit `permission.granted`, `permission.revoked`
- `feature_flags` — should emit `flag.enabled`, `flag.disabled`, `variant.assigned`

### Weakness 4 — Distributed Patterns Absent in Financial Modules

`ledger`, `transfers`, `reconciliation`, `settlement`, `payouts` are financial modules that need saga + outbox + idempotency patterns at least as rigorously as `payments`. Currently:

- `transfers.md` has no saga definition for the multi-step transfer flow
- `settlement.md` has no idempotency requirements despite being a financial operation
- `reconciliation.md` has no description of the reconciliation algorithm (balance-forward vs ledger-diff)
- `payouts.md` has no retry policy for failed payout attempts

### Weakness 5 — Observability Gaps

Only 14 contracts define their telemetry metrics. The `gensense_*` naming convention exists but isn't enforced across the catalog.

Every module that handles user-facing operations should define:
- Request counter: `gensense_<module>_<function>_total { result: success|error }`
- Latency histogram: `gensense_<module>_<function>_duration_ms`
- Error counter by code: `gensense_<module>_errors_total { code }`

### Weakness 6 — Multi-Tenancy Not Modeled in Core Contracts

Blueprint has a `tenants.md` module but almost no other contract defines how tenant isolation applies to their operations. In a real SaaS:

- Every `payments` operation is tenant-scoped
- Every `users` query is tenant-filtered
- Every `notifications` dispatch is tenant-isolated

The `global_standards.md` should include a **Tenancy Standard** section equivalent to how Idempotency and Pagination are standardized. Without it, every generated adapter is missing `tenant_id` filtering.

---

## Specific Contract Corrections

### `messaging.md` — Current Issues
- `sendMessage(conversation_id, content) → Message` — too simple. Missing:
  - `sender_id` (who is sending?)
  - `reply_to_id?` (thread support)
  - `attachments?` (should reference `attachments` module)
  - `client_id?` (optimistic UI deduplication)
- No invariant on message ordering (should use vector clocks or sequence numbers)
- No invariant on conversation participant validation (can a non-participant send?)

### `search.md` — Current Issues
- Only covers basic keyword search. Missing:
  - `multiSearch(queries) → SearchResult[][]` (batch search for performance)
  - `getSuggestions(partial_query) → Suggestion[]` (autocomplete)
  - Facet/filter invariants
  - Index freshness SLA (how stale can the index be?)

### `permissions.md` — Current Issues
- Models RBAC but has no ABAC (attribute-based) support
- `checkPermission(user_id, resource, action)` — missing `context?` parameter for ABAC
- No wildcard/glob permission matching definition
- No permission inheritance from roles to users defined
- Missing `batchCheckPermission(user_id, checks[]) → bool[]` — this is critical for UI rendering

### `webhooks.md` — Current Issues
- Retry policy exists but missing:
  - Exponential backoff formula (2^attempt seconds, max 32s, max 72 hours)
  - Dead-letter queue contract for permanently failed deliveries
  - Webhook signature verification standard (HMAC-SHA256 of body + timestamp)
  - Payload size limit invariant

### `sessions.md` — Current Issues
- `createSession` has no device fingerprinting invariant
- `listActiveSessions(user_id)` is not defined but is needed for "active sessions" UX
- `revokeAllSessions(user_id)` is not defined but needed for security compromise response
- No invariant on maximum concurrent sessions per user

### `config.md` — Current Issues
- No schema validation invariant (config values should be validated against `config_schema`)
- No hot-reload contract (how does a service pick up config changes without restart?)
- No secret reference contract (config values that are actually secret references)

---

## Contracts That Should Be Split

### `billing.md` is too large
Currently covers: subscription billing, usage billing, invoicing, tax, proration. These are separate concerns that have separate adapters. Recommend splitting:
- `billing.md` → core billing orchestrator (keep as is)
- `billing_metered.md` → usage-based billing only (new Pro contract)
- `billing_proration.md` → mid-cycle plan changes (Pro)

### `auth.md` should spawn `mfa.md`
Multi-Factor Authentication logic in `auth.md` is correct but crowded. Extract:
- `mfa.md` — TOTP setup, SMS/email OTP, hardware key (FIDO2), backup codes
- This separation allows different adapters (Authy, TOTP, SMS) per MFA method

---

## Contracts That Are Duplicated / Overlapping

| Pair | Overlap | Recommended Action |
|---|---|---|
| `incident_management.md` + `incident_response.md` | Both model incidents, escalation, PagerDuty | Merge into one. `incident_management` is the contract, `incident_response` is the operational procedure. |
| `notifications.md` + `push_notifications.md` | Both handle delivery to users | `notifications` should be the orchestrator, `push_notifications` a sub-module (like `sms`, `emails`) |
| `chargebacks.md` + `disputes.md` | Both handle payment disputes | Chargebacks are provider-initiated, disputes are user-initiated. Clarify the distinction in invariants. |
| `sla_tracking.md` + `compliance_reporting.md` | Overlap in SLA evidence collection | SLA tracking measures. Compliance reporting certifies. Keep separate but add explicit dependency. |

---

## Recommended Format Additions to All Contracts

Every contract should gain these two sections where applicable:

### Section: `### Failure Modes`
```
### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |
```

### Section: `### Breaking Change Policy`
```
### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
```
