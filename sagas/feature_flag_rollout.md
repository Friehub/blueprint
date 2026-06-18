# Saga: `feature_flag_rollout`

**Version:** 0.1.0

**Modules:** feature_flags → ab_testing → analytics

---

## Steps

1. **validate_flag(flag_key, environment)** -- Check flag exists, is in development status, and rollout is permitted.
   **Compensation:** none (read-only; validation is idempotent)

2. **set_internal_canary(flag_key, target_segment)** -- Enable flag for internal/staff users
   **Compensation:** `feature_flags.rollbackFlag(flag_key, "off")` -- disables the flag entirely

3. **create_ab_experiment(flag_key, variants)** → `ExperimentId`
   **Compensation:** `ab_testing.stopExperiment(experiment_id)` -- halts the A/B test

4. **gradual_rollout(flag_key, percentage, experiment_id)** -- Increase traffic percentage in steps
   **Compensation:** `feature_flags.setRolloutPercentage(flag_key, 0)` -- reduces rollout to 0%

5. **monitor_metrics(experiment_id, threshold)** → `MetricVerdict`
   **Compensation:** `ab_testing.invalidateVerdict(experiment_id)` -- marks verdict as stale if rollback needed

6. **promote_flag(flag_key, experiment_id)** -- Set flag to 100% for all users, mark experiment as concluded
   **Compensation:** `feature_flags.rollbackFlag(flag_key, "off")` -- emergency disable if regression detected post-promotion

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Flag not found or locked for release | Return `invalid_flag` error; no state change |
| 4 | Percentage calculation overflow or invalid | Halt rollout at current safe percentage |
| 5 | Metric degradation detected (p-value below threshold) | Auto-rollback to 0%; alert product team |
| 6 | Promotion conflicts with concurrent flag toggle | Retry with pessimistic lock; escalate on conflict |

---

## Invariants

- The sum of rollout percentages across all variants must always equal 100%
- A flag must pass internal canary before reaching external users
- Every rollout percentage change must be recorded with a timestamp and actor identity
