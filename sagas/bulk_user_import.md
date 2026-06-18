# Saga: `bulk_user_import`

**Version:** 0.1.0

**Modules:** data_import → users → tenants → notifications → jobs

---

## Steps

1. **validate_import_file(import_job_id, file_reference)** -- Verify CSV/JSON format, column headers, and encoding.
   **Compensation:** none (read-only; validation is idempotent)

2. **parse_and_validate_rows(import_job_id, file_reference)** → `ValidatedRow[]`
   **Compensation:** `data_import.clearParsedRows(import_job_id)` -- discards parsed row cache

3. **check_tenant_capacity(tenant_id, validated_rows_count)** -- Verify tenant has enough seats for new users
   **Compensation:** none (read-only; capacity check is idempotent)

4. **create_users_batch(tenant_id, validated_rows)** → `UserId[]`
   **Compensation:** `users.bulkDelete(user_ids)` -- removes all created users

5. **assign_tenant_memberships(user_ids, tenant_id, default_role)** -- Bulk-assign users to the target tenant
   **Compensation:** `tenants.bulkUnassignMemberships(user_ids, tenant_id)` -- revokes all tenant memberships

6. **[async] notify_import_complete(import_job_id, success_count, failure_count)** -- Send import summary to requester
   **Compensation:** none (informational; retry on failure)

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | CSV parse error on row N | Return partial error; import valid rows, skip malformed |
| 3 | Tenant seat capacity exceeded | Halt import; return `capacity_exceeded` error |
| 4 | User creation fails for subset (duplicate emails) | Roll back entire batch; flag duplicates in report |
| 5 | Concurrent assignment race condition | Retry with locking; batch size limited to 1000 |

---

## Invariants

- Import must be atomic per batch -- either all rows in a batch succeed or none do
- Duplicate email addresses within the same tenant must be rejected
- Total imported users must not exceed tenant's available seat count
