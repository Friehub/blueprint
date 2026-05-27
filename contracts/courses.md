# Module Contract: `courses`

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
- Lesson order must be unique within a course.
- Published courses must not accept structural edits unless they are explicitly republished.
- Archived courses must not accept new lessons.

**Providers:** Moodle, Canvas, Blackboard, custom LMS, GitBook-like course systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Course publication and lesson ordering must be strongly consistent.
- **Idempotency:** `createCourse`, `publishCourse`, and `addLesson` must be idempotent on a stable course fingerprint where applicable.
- **Temporal Constraints:** Published content changes should produce a new revision or republish event, not silent mutation.
- **Storage Model:** Durable course catalog with lesson/content references; rich content may be stored externally.
- **Dependencies:** `users`, `storage`, `audit_log`, `notifications`.
- **Errors:** `COURSE_NOT_FOUND`, `COURSE_NOT_EDITABLE`, `COURSE_ALREADY_PUBLISHED`, `LESSON_NOT_FOUND`, `LESSON_ORDER_CONFLICT`, `INVALID_COURSE_STATE`.
