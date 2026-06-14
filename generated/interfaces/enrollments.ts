// enrollments.ts
// Auto-generated from contracts/enrollments.md
// Do not edit manually

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: unknown;
  progressPercent: unknown;
  startedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Certificate {
  id: string;
  enrollmentId: string;
  issuedAt: Timestamp;
  status: unknown;
}

export type Enrollmentstatus = EnrollmentStatus = active | completed | withdrawn | suspended;

export interface EnrollmentsContract {
  enrollStudent(courseId: unknown, studentId: unknown, cohortId?: unknown): Promise<Enrollment>;
  getEnrollment(enrollmentId: unknown): Promise<Enrollment>;
  getEnrollmentByCourseAndStudent(courseId: unknown, studentId: unknown): Promise<Enrollment | undefined>;
  listEnrollments(input: unknown, options?: unknown): Promise<PaginatedResult<Enrollment>>;
  updateProgress(enrollmentId: unknown, progress: unknown): Promise<Enrollment>;
  completeLesson(enrollmentId: unknown, lessonId: unknown): Promise<Enrollment>;
  completeCourse(enrollmentId: unknown): Promise<Enrollment>;
  withdrawEnrollment(enrollmentId: unknown, reason?: unknown): Promise<Enrollment>;
  issueCertificate(enrollmentId: unknown): Promise<Certificate>;
}
