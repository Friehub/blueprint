# Module Contract: `assignments`

**Version:** 0.1.0

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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Assignment publication and submission writes must be durably recorded before exposure.
- **Idempotency:** `publishAssignment` and `submitAssignment` must be idempotent on assignment and submission fingerprints.
- **Storage Model:** Durable assignment and submission store with submission history.
- **Dependencies:** `courses`, `users`, `storage`, `notifications`, `audit_log`.
- **Errors:** `ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_CLOSED`, `SUBMISSION_NOT_FOUND`, `SUBMISSION_DUPLICATE`, `ASSIGNMENT_NOT_EDITABLE`, `DUE_DATE_EXPIRED`.
