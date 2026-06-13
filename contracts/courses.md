# Module Contract: `courses`

**Version:** 0.2.1

---

### `courses`
Curriculum structure, lesson publishing, and course content lifecycle.

**Functions**
```
createCourse(title, owner_id, description?, metadata?) → Course
getCourse(course_id) → Course
listCourses(input, options?) → PaginatedResult<Course>
updateCourse(course_id, data) → Course
publishCourse(course_id) → Course
archiveCourse(course_id) → Course
addLesson(course_id, lesson) → Lesson
updateLesson(course_id, lesson_id, data) → Lesson
reorderLessons(course_id, order) → Course
listLessons(course_id, options?) → PaginatedResult<Lesson>
```

**Types**
```
Course { id, title, description?, owner_id, status, metadata?, created_at, updated_at, published_at? }
Lesson { id, course_id, title, content_ref?, duration_minutes?, order, published, created_at, updated_at }
CourseStatus = draft | published | archived | deprecated
```

**Invariants**
- Lesson order must be unique within a course; `addLesson` and `reorderLessons` must reject duplicate order values with `LESSON_ORDER_CONFLICT`
- `publishCourse` on an already-published course must return the existing published state, not create a duplicate publication
- `archiveCourse` must reject if the course has active enrollments -- those must be completed or transferred first
- Published courses must not accept structural edits (add/remove/reorder lessons) unless explicitly republished via `publishCourse`
- Archived courses must not accept new lessons or updates via `addLesson` or `updateLesson`
- A course with status `deprecated` must still be readable via `getCourse` but must not appear in `listCourses` by default

**Providers:** Moodle, Canvas, Blackboard, custom LMS, GitBook-like course systems

---

---

## System-Level Integrations & Constraints

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.

### Consistency Model
* **Model:** `strong`
* **Details:** Course publication and lesson ordering must be strongly consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for course lifecycle events.
* **Details:** Duplicate course creation with the same title and owner must be idempotent (return existing course).

### Worker Scaling
* **Policy:** Course CRUD and lesson management must be independently scalable.

### Multi-Region Behavior
* **Mode:** Course catalogs are globally readable; writes are typically single-region with replication.
* **Details:** Published content changes must propagate to read replicas before serving stale data.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Bulk lesson imports or reorder operations on large courses (100+ lessons) must be processed in batches with progress reporting.

### Error Taxonomy
### Module-Specific Errors
```
createCourse:
    course_already_exists:     A course with the same title and owner already exists | use existing course

  getCourse:
    course_not_found:          No course with that ID | verify course_id

  publishCourse:
    course_already_published:  Course is already published | return existing published state
    invalid_state:             Course must be in draft status to be published | update draft first

  archiveCourse:
    active_enrollments:        Course has active enrollments | transfer or complete enrollments first
    already_archived:          Course is already archived | no action needed

  addLesson:
    lesson_order_conflict:     Another lesson already has this order value | choose a unique order
    course_not_editable:       Course is archived or deprecated | no structural changes allowed

  updateLesson:
    lesson_not_found:          No lesson with that ID in the given course | verify lesson_id

  reorderLessons:
    invalid_order:             Order array must contain all lesson IDs for the course exactly once | include all lessons
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createCourse      → course.created              { course_id, title, owner_id }
  publishCourse     → course.published            { course_id, published_at }
  archiveCourse     → course.archived             { course_id, reason }
  addLesson         → course.lesson.added         { course_id, lesson_id, title }
  updateLesson      → course.lesson.updated       { course_id, lesson_id }
  reorderLessons    → course.lessons.reordered    { course_id, lesson_count }
```

### Temporal Constraints
```
Course publish schedule:
    effective:      immediate on publishCourse call
    on_expiry:      N/A -- publication is permanent until archived

  Lesson content retention:
    duration:       indefinite (until course is deleted)
    on_expiry:      N/A -- content is preserved for enrolled students
```

### Storage Model
* **Model:** Strongly consistent course catalog with structured lesson references.
* **Details:** Course metadata, lesson definitions, and ordering are persisted. Rich content (videos, documents) is stored externally and referenced via `content_ref`.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived', 'deprecated');

CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  owner_id        UUID NOT NULL,
  status          course_status NOT NULL DEFAULT 'draft',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE INDEX idx_courses_owner ON courses(owner_id);
CREATE INDEX idx_courses_status ON courses(status) WHERE status IN ('draft', 'published');
CREATE UNIQUE INDEX idx_courses_title_owner ON courses(title, owner_id) WHERE status != 'archived';

CREATE TABLE lessons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  content_ref       TEXT,
  duration_minutes  INT,
  lesson_order      INT NOT NULL,
  published         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_order)
);

CREATE INDEX idx_lessons_course_order ON lessons(course_id, lesson_order);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `courses.<function>`.
* **Telemetry Metrics:**
```
blueprint_courses_total                        { status }
  blueprint_courses_lessons_total                { course_id }
  blueprint_courses_publications_total
  blueprint_courses_operation_duration_ms         histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, storage
* **Emits To:** events
* **Recommends:** audit_log, notifications, enrollments
