# Module Contract: `enrollments`

**Version:** 0.1.0

---

### `enrollments`
Student enrollment lifecycle, progress tracking, and completion records.

**Functions**
```
enrollStudent(course_id, student_id, cohort_id?) → Enrollment
getEnrollment(enrollment_id) → Enrollment
getEnrollmentByCourseAndStudent(course_id, student_id) → Enrollment?
listEnrollments(input, options?) → PaginatedResult<Enrollment>
updateProgress(enrollment_id, progress) → Enrollment
completeLesson(enrollment_id, lesson_id) → Enrollment
completeCourse(enrollment_id) → Enrollment
withdrawEnrollment(enrollment_id, reason?) → Enrollment
issueCertificate(enrollment_id) → Certificate
```

**Types**
```
Enrollment { id, course_id, student_id, cohort_id?, status, progress_percent, started_at, completed_at?, withdrawn_at?, created_at, updated_at }
Certificate { id, enrollment_id, issued_at, url?, status }
EnrollmentStatus = active | completed | withdrawn | suspended
```

**Invariants**
- A student can have at most one active enrollment per course unless the course explicitly allows re-enrollment.
- Progress must be monotonic and cannot decrease.
- Completed enrollments cannot be marked active again without a new enrollment record.

**Providers:** custom LMS, Moodle, Canvas, Blackboard, corporate training platforms

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Enrollment state and progress updates must be strongly consistent.
- **Idempotency:** `enrollStudent`, `updateProgress`, and `completeCourse` must be idempotent when retried with the same enrollment context.
- **Temporal Constraints:** Certificates may have expiry or revocation policies if the issuer defines them.
- **Storage Model:** Durable enrollment ledger with completion and certificate history.
- **Dependencies:** `courses`, `users`, `storage`, `audit_log`, `notifications`.
- **Errors:** `COURSE_NOT_FOUND`, `ENROLLMENT_NOT_FOUND`, `ENROLLMENT_CONFLICT`, `PROGRESS_OUT_OF_RANGE`, `COURSE_NOT_ENROLLABLE`, `CERTIFICATE_NOT_ISSUED`.
