# Module Contract: `grading`

**Version:** 0.2.0

---

### `grading`
Rubrics, score calculation, feedback, and grade finalization for education workflows.
This module also grades quizzes and exams that are modeled as assignments.

**Functions**
```
createRubric(course_id, data) → Rubric
getRubric(rubric_id) → Rubric
listRubrics(course_id, options?) → PaginatedResult<Rubric>
gradeSubmission(submission_id, rubric_id, scores, feedback?) → Grade
updateGrade(grade_id, data) → Grade
publishGrade(grade_id) → Grade
finalizeGrades(course_id) → Gradebook
getGradebook(course_id) → Gradebook
```

**Types**
```
Rubric { id, course_id, title, criteria, total_points, published_at?, archived_at? }
Criterion { key, label, max_points, weight? }
Grade { id, submission_id, rubric_id, total_score, feedback?, status, graded_at, published_at? }
Gradebook { course_id, status, averages, distribution, finalized_at? }
GradeStatus = draft | graded | published | finalized | returned
```

**Invariants**
- `publishGrade` must reject if the grade status is already `published` and no audit trail exists — return `GRADE_CONFLICT` if grade_id already published.
- `gradeSubmission` must validate total_score against rubric total_points at the DB level — if total_score > rubric.total_points, return `INVALID_SCORE`.
- `finalizeGrades` must set `gradebook.status = finalized` atomically — once finalized, all `updateGrade` and `publishGrade` calls on that course_id return `GRADEBOOK_FINALIZED`.
- `getGradebook` must compute `averages` and `distribution` from the current finalized grades only, not from draft or archived grade records.
- Quiz/exam auto-scoring must write a grade record attributable to `submission_id` and `rubric_id` — anonymous scores without a rubric reference are a contract violation.
- `updateGrade` on a grade with status `finalized` must be rejected with `GRADE_CONFLICT`; updates to finalized grades require creating a grade revision via a separate `amendGrade` flow.

**Providers:** LMS gradebooks, custom education platforms, Canvas grading, Moodle grade center, Blackboard gradebook

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Grade publication and finalization must be strongly consistent.
- **Idempotency:** `gradeSubmission`, `publishGrade`, and `finalizeGrades` must be idempotent on grade or gradebook identity.
- **Storage Model:** Durable gradebook with rubric and grade history.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE grade_status AS ENUM ('draft', 'graded', 'published', 'finalized', 'returned');

CREATE TABLE rubrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL,
  title           TEXT NOT NULL,
  criteria        JSONB NOT NULL,
  total_points    INT NOT NULL CHECK (total_points > 0),
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rubrics_course ON rubrics(course_id);

CREATE TABLE grades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL UNIQUE,
  rubric_id       UUID NOT NULL REFERENCES rubrics(id),
  total_score     INT NOT NULL CHECK (total_score >= 0),
  feedback        TEXT,
  status          grade_status NOT NULL DEFAULT 'draft',
  graded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  version         INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_grades_submission ON grades(submission_id);
CREATE INDEX idx_grades_rubric ON grades(rubric_id);

CREATE TABLE gradebook_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  averages        JSONB NOT NULL,
  distribution    JSONB NOT NULL,
  finalized_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_gradebook_course_active ON gradebook_snapshots(course_id) WHERE status = 'active';
```
- **Dependencies:** `assignments`, `courses`, `users`, `notifications`, `audit_log`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
gradeSubmission    → grading.grade.submitted     { submission_id, rubric_id, total_score }
publishGrade       → grading.grade.published     { grade_id, course_id }
finalizeGrades     → grading.gradebook.finalized { course_id, averages }
updateGrade        → grading.grade.updated       { grade_id, version }
```

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Concurrent grade publication | Optimistic lock on version column; return GRADE_CONFLICT if version mismatch |
| Rubric not found during grading | Return RUBRIC_NOT_FOUND, do not create orphan grade record |

### Breaking Change Policy
- Adding a new optional field to Rubric/Grade types: non-breaking
- Removing a grade status enum value: breaking — requires major version bump and migration guide
- Changing total_score validation from advisory to strict: non-breaking if documented
- Adding a new invariant on rubric criteria structure: breaking — existing rubrics must be backfilled

**Errors:** `SUBMISSION_NOT_FOUND`, `RUBRIC_NOT_FOUND`, `GRADE_CONFLICT`, `GRADEBOOK_FINALIZED`, `INVALID_SCORE`, `GRADE_NOT_PUBLISHABLE`

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `grading.<function>`.
* **Telemetry Metrics:**
```
blueprint_grading_operations_total         { function, result }
blueprint_grading_operation_duration_ms    histogram { function }
blueprint_grading_errors_total             { code }
```
