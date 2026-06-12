# Saga: `user_offboarding`

**Version:** 0.1.0

**Modules:** users → billing → subscriptions → storage → audit_log → notifications → data_retention → right_to_erasure

---

## Steps

1. **initiate_offboarding(user_id, reason)** -- Create offboarding record, lock user account
   **Compensation:** `users.reactivateUser(user_id)` -- restore account if offboarding cancelled

2. **cancel_active_subscriptions(user_id)** → `Subscription[]`
   **Compensation:** `billing.reactivateSubscription(id)` -- only available within grace window

3. **export_user_data(user_id, destinations[])** → `ExportResult`
   **Compensation:** delete exported data if offboarding fails (best-effort)

4. **revoke_api_keys(user_id)** → `void`
   **Compensation:** none -- keys are regenerated if user reactivates

5. **schedule_data_deletion(user_id, retention_delay)** → `ScheduledDeletion`
   **Compensation:** `data_retention.cancelPurge(schedule_id)` -- cancel if user reactivates

6. **[async]** After retention window: **execute_data_deletion(user_id)** → `ErasureResult`
   **Compensation:** none -- deletion is irreversible

7. **[async] certify_deletion(user_id)** → `Certification`
   **Compensation:** none -- certification is append-only audit record

8. **[async] notify_user(user_id, completion_summary)** → Notification
   **Compensation:** async, non-blocking

---

## Failure Modes

| Step | Failure | Compensation |
|---|---|---|
| 2 | Billing service down | Retry; user account locked, no new charges possible |
| 3 | Export destination unreachable | Queue export, continue saga; notify operator |
| 6 | Deletion partial | Log failed services, require manual intervention |
| 7 | Certification fails | Erasure completed but unverified; flag for audit |

---

## Invariants

- User account must be locked before any data mutation occurs
- Active subscriptions must be cancelled before data is deleted
- Data deletion must respect the configured retention delay (GDPR: no immediate deletion)
- Certification must confirm deletion from every service that held user data
