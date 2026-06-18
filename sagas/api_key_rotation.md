# Saga: `api_key_rotation`

**Version:** 0.1.0

**Modules:** api_keys → secrets → audit_log → notifications

---

## Steps

1. **validate_rotation_request(api_key_id, user_id)** -- Check key exists and caller has rotate permission. Rate-limit check.
   **Compensation:** none (read-only, rate-limit counter expires naturally)

2. **generate_new_key(api_key_id)** → `NewApiKey`
   **Compensation:** `api_keys.revokeKey(new_key_id)` -- revokes the newly generated key if unused

3. **update_application_secret(service_id, new_key_hash)** -- Replace old secret hash in secrets store
   **Compensation:** `secrets.restoreSecret(service_id, previous_key_hash)` -- reverts to old hash

4. **[async] propagate_key_change(service_id, new_key)** -- Broadcast new key to downstream consumers
   **Compensation:** `api_keys.rollbackPropagation(service_id)` -- reverts to old key for consumers

5. **revoke_old_key(api_key_id, old_key_id)** -- Mark old key as revoked after propagation confirms
   **Compensation:** none (old key must be revoked; re-activation requires manual override)

6. **[async] notify_key_rotated(service_id, rotated_by)** -- Send rotation confirmation to security channel
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 1 | Key not found or insufficient permissions | Return `invalid_request` error; no state change |
| 2 | Secret store unreachable | Retry with backoff; revoke generated key after N failures |
| 4 | Propagation timeout for downstream consumers | Halt rotation; keep both keys active; alert operator |
| 5 | Revocation DB write failure | Retry idempotently; old key remains valid temporarily |

---

## Invariants

- At most one active rotation per API key at any time
- The old key must remain valid until propagation to all consumers is confirmed
- All key rotation events must be recorded in the audit log
