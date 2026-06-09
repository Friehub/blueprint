# Module Contract: `changelog`

**Version:** 0.1.0

---

### `changelog`
API changelog with breaking change tracking, migration guides, semver enforcement, and subscriber notifications.

**Functions**
```
recordEntry(version, changes) → ChangelogEntry
getEntry(entry_id) → ChangelogEntry
listEntries(options?) → PaginatedResult<ChangelogEntry>
getBreakingChanges(version_range) → BreakingChange[]
addMigrationGuide(entry_id, guide) → void
notifySubscribers(entry_id) → NotificationResult
subscribe(user_id, modules?) → Subscription
unsubscribe(subscription_id) → void
```

**Types**
```
ChangelogEntry { id, version, type: major|minor|patch|prerelease, changes: Change[], migration_guide?, published_at }
Change { description, type: feature|fix|breaking|deprecation|security, module, affected_functions? }
BreakingChange { id, from_version, to_version, description, migration_guide_ref, impact: high|medium|low }
Subscription { id, user_id, modules, channel: email|webhook|slack, created_at }
NotificationResult { entry_id, subscribers_notified, total_subscribers, failed_deliveries[] }
```

**Invariants**
- A `major` version entry must contain at least one change of type `breaking`
- Breaking changes must include a migration guide reference before the entry can be published
- `listEntries` must return entries sorted by version descending (newest first)

**Providers:** custom, GitHub Releases, Keep a Changelog, changesets, standard-version

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Changelog entries must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for changelog and notification events.
* **Details:** Duplicate entries for the same version must be idempotent (update existing).

### Worker Scaling
* **Policy:** Entry publishing and notification delivery must be independently scalable.

### Multi-Region Behavior
* **Mode:** Changelog is global; notifications are delivered from the region closest to the subscriber.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
recordEntry       → changelog.entry.created     { version, type, breaking_count }
  notifySubscribers → changelog.notifications.sent { entry_id, subscriber_count }
```

### Temporal Constraints
```
Entry edit window:
    duration:       24 hours after publication
    on_expiry:      entry is locked; further edits require a new patch entry

  Notification retry:
    max_attempts:   3
    on_exhausted:   mark delivery as failed; log for manual follow-up
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `changelog.<function>`.
* **Telemetry Metrics:**
```
gensense_changelog_entries_total               { type }
  gensense_changelog_breaking_changes_total      { impact }
  gensense_changelog_subscribers_total            { channel }
  gensense_changelog_notifications_sent_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** notifications, developer_portal, email
