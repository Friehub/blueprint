// attendance.ts
// Auto-generated from contracts/attendance.md
// Do not edit manually

export interface Attendancerecord {
  id: string;
  courseId: string;
  studentId: string;
  sessionId: string;
  status: unknown;
  markedAt: Timestamp;
}

export interface Attendancesession {
  id: string;
  courseId: string;
  startAt: Timestamp;
  status: unknown;
}

export interface Attendancesummary {
  courseId: string;
  period: unknown;
  present: unknown;
  absent: unknown;
  late: unknown;
  excused: unknown;
  total: unknown;
}

export type Attendancestatus = AttendanceStatus = present | absent | late | excused | unmarked;

export interface AttendanceContract {
  markAttendance(courseId: unknown, studentId: unknown, sessionId: unknown, status: unknown, metadata?: unknown): Promise<AttendanceRecord>;
  getAttendanceRecord(recordId: unknown): Promise<AttendanceRecord>;
  listAttendance(courseId: unknown, options?: unknown): Promise<PaginatedResult<AttendanceRecord>>;
  markSessionStart(sessionId: unknown): Promise<AttendanceSession>;
  markSessionEnd(sessionId: unknown): Promise<AttendanceSession>;
  getAttendanceSummary(courseId: unknown, period: unknown): Promise<AttendanceSummary>;
}
