# Module Contract: `push_notifications`

**Version:** 0.1.0

---

### `push_notifications`
Device push notification delivery via FCM, APNs, and web push protocols. This is a sub-module of `notifications` — it handles push-specific device registration and delivery. The `notifications` module orchestrates channel selection and dispatch routing.

**Functions**
```
registerDevice(user_id, device_token, platform, metadata?) → DeviceRegistration
unregisterDevice(device_id) → void
getUserDevices(user_id) → DeviceRegistration[]
sendPush(user_id, notification, options?) → PushResult
sendBulkPush(user_ids[], notification, options?) → BulkPushResult
sendTopicPush(topic, notification, options?) → BulkPushResult
getPushStatus(message_id) → PushDeliveryStatus
updateDeviceToken(device_id, new_token) → void
```

**Types**
```
DeviceRegistration { id, user_id, device_token, platform, app_version?, last_seen_at, created_at }
PushNotification { title, body, data?, badge?, sound?, category?, mutable_content: bool }
PushResult { message_id, device_count, successes, failures }
BulkPushResult { message_id, total_devices, successes, failures: PushError[] }
PushDeliveryStatus { message_id, status: pending|delivered|failed|expired, delivered_at?, error? }
PushError { device_id, reason: invalid_token|rate_limited|payload_too_large|provider_error }
PushOptions { priority: normal|high, ttl_seconds, collapse_key, thread_id }
Platform = ios | android | web | huawei
```

**Invariants**
- `registerDevice` must validate the `device_token` by sending a silent push before storing it -- unvalidated tokens must not be accepted
- `sendPush` must not throw when targeting a user with no registered devices -- it must return a zero-device result
- A device that returns `invalid_token` more than 3 consecutive times must be automatically unregistered
- `sendBulkPush` must batch devices by platform and respect each platform's payload size limits (4KB for FCM, 4KB for APNs)
- Push notifications targeting a user in their quiet hours must be queued and delivered after the quiet hours window expires

**Providers:** Firebase Cloud Messaging (FCM), Apple Push Notification Service (APNs), Web Push API, Huawei Mobile Services

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Device registration state must be eventually consistent; push delivery is best-effort.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for push delivery.
* **Details:** Push delivery is fire-and-forget. Duplicate delivery is not guaranteed.

### Worker Scaling
* **Policy:** Push sending is I/O-bound; scale horizontally by platform partition.

### Multi-Region Behavior
* **Mode:** Device registrations must be routed to the region closest to the user.
* **Details:** Cross-region push must use a relay to the user's home region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When the push provider returns rate-limited, the sender must backoff with exponential delay and retry up to the TTL limit.

### Event Emission
```
registerDevice    -> push_notifications.device.registered   { user_id, platform }
  unregisterDevice  -> push_notifications.device.unregistered { device_id, reason }
  sendPush          -> push_notifications.message.sent       { message_id, device_count }
                    -> push_notifications.delivery.failed    { message_id, device_id, reason }
```

### Temporal Constraints
```
Device token validation:
    max_age:        24 hours since last successful push
    on_expiry:      mark device as stale; re-validate on next send

  Push TTL:
    default:        4 hours
    on_expiry:      message expired; report as expired status

  Invalid token auto-unregister:
    threshold:      3 consecutive failures
    on_expiry:      auto-unregister; emit device.unregistered event
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `push_notifications.<function>`.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Belongs To:** notifications (orchestrator — routes push delivery through this module)
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log
