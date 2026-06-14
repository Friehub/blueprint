// assignments.ts
// Auto-generated from contracts/assignments.md
// Do not edit manually

export interface Assignment {
  id: string;
  courseId: string;
  title: unknown;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  submittedAt: Timestamp;
  status: unknown;
}

export type Assignmentstatus = AssignmentStatus = draft | published | closed | archived;

export type Submissionstatus = SubmissionStatus = draft | submitted | graded | returned | late | rejected;

export interface AssignmentsContract {
  createAssignment(courseId: unknown, data: unknown): Promise<Assignment>;
  getAssignment(assignmentId: unknown): Promise<Assignment>;
  listAssignments(courseId: unknown, options?: unknown): Promise<PaginatedResult<Assignment>>;
  updateAssignment(assignmentId: unknown, data: unknown): Promise<Assignment>;
  publishAssignment(assignmentId: unknown): Promise<Assignment>;
  closeAssignment(assignmentId: unknown): Promise<Assignment>;
  submitAssignment(assignmentId: unknown, studentId: unknown, submission: unknown): Promise<Submission>;
  getSubmission(submissionId: unknown): Promise<Submission>;
  listSubmissions(input: unknown, options?: unknown): Promise<PaginatedResult<Submission>>;
}
