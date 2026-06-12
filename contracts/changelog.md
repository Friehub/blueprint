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
- `recordEntry` for a version that already exists must return `429 Conflict` unless the existing entry is within the 24-hour edit window and the caller is the original author
- `subscribe` with no `modules` filter must subscribe the user to all module changelogs; subsequent changes to a new module automatically notify the subscriber
- A `prerelease` entry must not be the latest entry when listing entries without a prerelease filter -- prerelease entries are excluded from the default list

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

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE changelog_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version           TEXT NOT NULL,
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('major', 'minor', 'patch', 'prerelease')),
  changes           JSONB NOT NULL DEFAULT '[]',
  migration_guide   TEXT,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version)
);

CREATE INDEX idx_changelog_entries_version ON changelog_entries(version DESC);
CREATE INDEX idx_changelog_entries_published ON changelog_entries(published_at DESC);

CREATE TABLE changelog_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  modules           TEXT[],
  channel           TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'slack')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

CREATE INDEX idx_changelog_subscriptions_user ON changelog_subscriptions(user_id);

CREATE TABLE changelog_notification_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          UUID NOT NULL REFERENCES changelog_entries(id) ON DELETE CASCADE,
  subscriber_count  INTEGER NOT NULL,
  delivered_count   INTEGER NOT NULL DEFAULT 0,
  failed_deliveries UUID[] DEFAULT '{}',
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_changelog_notification_entry ON changelog_notification_log(entry_id);
```

### Storage Model
* **Model:** Durable changelog entry store with subscription registry.
* **Details:** Changelog entries are immutable after the 24-hour edit window. Subscriptions are persistent until unsubscribed.

### Breaking Change Policy
- Adding new entry types or change types is additive and backward-compatible.
- Removing or renaming an existing entry type requires a MAJOR version bump.
- Changing the edit window (24 hours) requires a MAJOR version bump.
- Adding new required fields to `recordEntry` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Duplicate version entry | Raced recordEntry calls with same version | Enforce UNIQUE on version; second caller receives CONFLICT |
| Breaking change without migration guide | Operator bypasses validation | Block recordEntry if change type is 'breaking' and migration_guide is null |
| Notification delivery failure | Subscriber channel unreachable | Retry 3 times; mark as failed in log; surface in NotificationResult |
| Edit window expired | Entry published > 24 hours ago | Reject edit; inform user to create new patch entry |
| Prerelease shown in default list | Missing filter in query | Exclude prerelease entries by default; require explicit filter to include |
