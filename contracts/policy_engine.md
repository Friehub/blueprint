# Module Contract: `policy_engine`

**Version:** 0.2.0

---

### `policy_engine`
Policy-as-code evaluation with rule-based authorization and explainable decisions.

**Functions**
```
evaluate(policy_name, context) → PolicyDecision
evaluateBatch(policies, context) → PolicyDecision[]
registerPolicy(name, rules, options?) → Policy
updatePolicy(policy_id, rules, change_reason) → Policy
getPolicy(policy_id) → Policy
listPolicies() → Policy[]
deletePolicy(policy_id) → void
testPolicy(policy_id, test_context) → TestResult
```

**Types**
```
PolicyDecision { allowed: bool, matched_rules: RuleMatch[], deny_reasons?: DenyReason[], explanation }
RuleMatch { rule_id, effect: allow|deny, weight, condition_satisfied }
DenyReason { rule_id, policy, context_snapshot, justification }
Policy { id, name, rules: PolicyRule[], version, status: active|inactive|draft, created_at }
PolicyRule { id, effect: allow|deny, conditions, priority, description }
TestResult { policy_id, test_cases: TestCaseResult[], pass_rate }
TestCaseResult { input, expected, actual, passed, explanation }
PolicyOptions { evaluation_mode: allow_overrides|deny_overrides|first_match, logging, cache_ttl? }
```

**Invariants**
- `evaluate` must return a decision for every request -- it must never return an ambiguous result
- A deny rule matching the request context must always override an allow rule when `evaluation_mode` is `deny_overrides`
- Policy evaluation must be deterministic -- the same inputs must always produce the same decision

**Providers:** OPA (Rego), Casbin, Cedar, Oso, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Policy definitions must be immediately consistent to prevent evaluation race conditions

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for policy evaluation events.
* **Details:** Duplicate evaluation requests with the same context must return the same cached result within the cache window.

### Worker Scaling
* **Policy:** Policy evaluation must scale with request volume; evaluation should not become a bottleneck.

### Multi-Region Behavior
* **Mode:** Policy definitions are global; evaluation is local.
* **Details:** Policy changes must propagate to all evaluation nodes before the old policy version is deactivated.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Evaluation must complete within request budget; if evaluation time exceeds a configurable threshold, return a timeout error rather than blocking.

### Algorithm
* **Recommended:** Rule-tree evaluation with short-circuit optimisation for deny-overrides mode. Policies are compiled into an AST at registration time; evaluation traverses the AST and short-circuits on the first matching deny rule in `deny_overrides` mode.
* **Details:** Policy rules are ordered by priority within a policy. Rules with higher priority are evaluated first. The evaluation mode (`allow_overrides`, `deny_overrides`, `first_match`) determines how conflicting rules are resolved. `deny_overrides` is the recommended default for security-sensitive policies.
* **Atomicity:** Policy definition changes (create, update, delete) must be atomic. In-flight evaluations must not see a partially updated policy. Implementations must use versioned policies with atomic activation.

### Error Taxonomy
### Module-Specific Errors
```
evaluate:
    policy_not_found:        No policy registered with this name | verify policy name
    evaluation_error:        Policy rule evaluation encountered an error | check rule syntax and data sources
    evaluation_timeout:      Policy evaluation exceeded time budget | simplify policy rules

  registerPolicy:
    invalid_policy:          Policy definition failed validation | check rule schema and syntax
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
evaluate         → policy.evaluated             { policy_name, allowed, matched_rules_count }
  registerPolicy   → policy.created               { policy_id, name }
  updatePolicy     → policy.updated               { policy_id, new_version }
  deletePolicy     → policy.deleted               { policy_id }
```

### Temporal Constraints
```
Policy evaluation cache:
    default:        5 seconds
    on_expiry:      re-evaluate on next request

  Policy version retention:
    duration:       90 days
    on_expiry:      eligible for archival
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `policy_engine.<function>`.
* **Telemetry Metrics:**
```
blueprint_policy_engine_evaluations_total        { policy_name, allowed }
  blueprint_policy_engine_evaluation_duration_ms   histogram { policy_name }
  blueprint_policy_engine_rules_evaluated_total     { policy_name }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** permissions
* **Emits To:** events
* **Recommends:** audit_log, cache
