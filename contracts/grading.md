# Module Contract: `grading`

**Version:** 0.1.0

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
- Published grades must not change without a new grade revision or audit trail.
- Grade totals must match rubric math and declared weighting.
- Finalized gradebooks must be immutable.
- Quiz/exam grading may be auto-scored, but the resulting grade must still be attributable to the rubric and submission identity.

**Providers:** LMS gradebooks, custom education platforms, Canvas grading, Moodle grade center, Blackboard gradebook

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Grade publication and finalization must be strongly consistent.
- **Idempotency:** `gradeSubmission`, `publishGrade`, and `finalizeGrades` must be idempotent on grade or gradebook identity.
- **Storage Model:** Durable gradebook with rubric and grade history.
- **Dependencies:** `assignments`, `courses`, `users`, `notifications`, `audit_log`.
- **Errors:** `SUBMISSION_NOT_FOUND`, `RUBRIC_NOT_FOUND`, `GRADE_CONFLICT`, `GRADEBOOK_FINALIZED`, `INVALID_SCORE`, `GRADE_NOT_PUBLISHABLE`.
