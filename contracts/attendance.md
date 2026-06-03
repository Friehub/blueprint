# Module Contract: `attendance`

**Version:** 0.1.0

---

### `attendance`
Attendance capture, presence marking, absence tracking, and attendance reporting for education systems.

**Functions**
```
markAttendance(course_id, student_id, session_id, status, metadata?) → AttendanceRecord
getAttendanceRecord(record_id) → AttendanceRecord
listAttendance(course_id, options?) → PaginatedResult<AttendanceRecord>
markSessionStart(session_id) → AttendanceSession
markSessionEnd(session_id) → AttendanceSession
getAttendanceSummary(course_id, period) → AttendanceSummary
```

**Types**
```
AttendanceRecord { id, course_id, student_id, session_id, status, marked_at, metadata? }
AttendanceSession { id, course_id, start_at, end_at?, status }
AttendanceSummary { course_id, period, present, absent, late, excused, total }
AttendanceStatus = present | absent | late | excused | unmarked
```

**Invariants**
- A student can only have one attendance record per session.
- Session closure should prevent further mutable attendance changes unless explicitly reopened.
- Summaries must be derived from durable records.

**Providers:** LMS attendance modules, classroom management systems, webinar attendance trackers, corporate training systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Attendance marking must be strongly consistent for a session.
- **Idempotency:** `markAttendance` and session lifecycle calls must be idempotent on session/student identity.
- **Storage Model:** Durable attendance log with summaries derived from records.
- **Dependencies:** `courses`, `enrollments`, `users`, `audit_log`, `notifications`.
- **Errors:** `SESSION_NOT_FOUND`, `ATTENDANCE_ALREADY_MARKED`, `SESSION_CLOSED`, `STUDENT_NOT_ENROLLED`, `INVALID_ATTENDANCE_STATUS`.
