# Module Contract: `assignments`

**Version:** 0.2.1

---

### `assignments`
Homework, coursework, submissions, and assignment lifecycle for education platforms.

**Functions**
```
createAssignment(course_id, data) → Assignment
getAssignment(assignment_id) → Assignment
listAssignments(course_id, options?) → PaginatedResult<Assignment>
updateAssignment(assignment_id, data) → Assignment
publishAssignment(assignment_id) → Assignment
closeAssignment(assignment_id) → Assignment
submitAssignment(assignment_id, student_id, submission) → Submission
getSubmission(submission_id) → Submission
listSubmissions(input, options?) → PaginatedResult<Submission>
```

**Types**
```
Assignment { id, course_id, title, description?, due_at?, status, max_score?, created_at, updated_at }
Submission { id, assignment_id, student_id, content_ref?, submitted_at, status, score?, feedback? }
AssignmentStatus = draft | published | closed | archived
SubmissionStatus = draft | submitted | graded | returned | late | rejected
```

**Invariants**
- Closed assignments must not accept new submissions.
- Submission records must be immutable except for grading and feedback fields.
- Late submission handling must be explicit.

**Providers:** custom LMS, Canvas assignments, Moodle assignments, Blackboard, Google Classroom-like systems

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Assignment metadata and submission records must be immediately consistent to prevent grading race conditions

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for assignment lifecycle and submission events.
* **Details:** Duplicate submission events must not create duplicate grade entries.

### Worker Scaling
* **Policy:** Assignment publication and submission ingestion must be independently scalable.

### Multi-Region Behavior
* **Mode:** Assignments are scoped to a course's primary region; cross-region submission requires explicit replication.
* **Details:** Submission timestamps must use the region-local clock but be normalised to UTC for consistency.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `publishAssignment(assignment_id, idempotency_key?)`
  - `submitAssignment(assignment_id, student_id, submission, idempotency_key?)`
  - `closeAssignment(assignment_id, idempotency_key?)`

### Backpressure
* If submission ingestion is saturated, the module must reject new submissions with `429 Too Many Requests` rather than accepting and silently dropping.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_CLOSED`, `SUBMISSION_NOT_FOUND`, `SUBMISSION_DUPLICATE`, `ASSIGNMENT_NOT_EDITABLE`, `DUE_DATE_EXPIRED`, `SUBMISSION_TOO_LARGE`, `SUBMISSION_TYPE_UNSUPPORTED`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createAssignment    → assignments.assignment.created     { assignment_id, course_id }
publishAssignment   → assignments.assignment.published   { assignment_id, course_id }
closeAssignment     → assignments.assignment.closed      { assignment_id, course_id }
submitAssignment    → assignments.submission.created     { submission_id, assignment_id, student_id }
```

### Temporal Constraints
```
Assignment:
    due_at:             set by instructor on creation
    grace_period:       configurable (default 0 minutes)
    on_expiry:          late submissions flagged in SubmissionStatus

    late_submission:
        window:         configurable (default 24 hours past due_at)
        penalty:        configurable per assignment
        on_expiry:      submissions rejected with DUE_DATE_EXPIRED

    close deadline:
        default:        30 days after due_at
        on_expiry:      auto-close; no further submissions accepted
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  due_at      TIMESTAMPTZ,
  grace_period_minutes INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  max_score   NUMERIC(10,2),
  late_policy TEXT NOT NULL DEFAULT 'reject'
                CHECK (late_policy IN ('reject', 'accept_with_penalty', 'accept')),
  late_penalty_percent NUMERIC(5,2) DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_course ON assignments(course_id, status);
CREATE INDEX idx_assignments_due ON assignments(due_at) WHERE status = 'published';

CREATE TABLE submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL,
  content_ref   TEXT,
  content_type  TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('draft', 'submitted', 'graded', 'returned', 'late', 'rejected')),
  score         NUMERIC(10,2),
  feedback      TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at     TIMESTAMPTZ,
  graded_by     UUID,
  is_late       BOOLEAN NOT NULL DEFAULT false,
  metadata      JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX idx_submissions_unique ON submissions(assignment_id, student_id) WHERE status = 'submitted';
CREATE INDEX idx_submissions_student ON submissions(student_id, submitted_at DESC);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id, submitted_at DESC);

CREATE TABLE submission_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  from_status   TEXT,
  to_status     TEXT,
  changed_by    UUID,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submission_audit_sub ON submission_audit(submission_id, created_at DESC);
```

### Storage Model
* **Model:** Durable assignment and submission store with submission history.
* **Details:** Assignment metadata uses strong consistency; submissions use append-like semantics with immutable content after submission. Audit trail for status changes is mandatory.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `assignments.<function>`.
* **Telemetry Metrics:**
```
blueprint_assignments_operation_total            counter { function, result }
blueprint_assignments_operation_duration_ms      histogram { function }
blueprint_assignments_errors_total               counter { function, error_code }
blueprint_assignments_submissions_total           counter { assignment_id, status }
blueprint_assignments_late_submissions_total      counter { assignment_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** courses, users, storage
* **Emits To:** events
* **Recommends:** notifications, audit_log, grading

### Breaking Change Policy
- Adding a new submission status value is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the `late_policy` default requires a MAJOR version bump.
- Adding new required fields to `CreateAssignmentInput` requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Submission lost | Storage write failure | Retry with idempotency key; dead-letter after 3 attempts |
| Late policy misapplied | Clock skew between region and due_at | Use UTC-normalised timestamps; log discrepancy > 5s |
| Duplicate grade | Duplicate submission event with different keys | Deduplicate by (assignment_id, student_id) unique constraint |
| Assignment not found after publish | Propagation delay in replicated setup | Use strong consistency for status reads post-publish |
