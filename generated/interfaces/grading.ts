// grading.ts
// Auto-generated from contracts/grading.md
// Do not edit manually

export interface Rubric {
  id: string;
  courseId: string;
  title: unknown;
  criteria: unknown;
  totalPoints: unknown;
}

export interface Criterion {
  key: unknown;
  label: unknown;
  maxPoints: unknown;
}

export interface Grade {
  id: string;
  submissionId: string;
  rubricId: string;
  totalScore: unknown;
  status: unknown;
  gradedAt: Timestamp;
}

export interface Gradebook {
  courseId: string;
  status: unknown;
  averages: unknown;
  distribution: unknown;
}

export type Gradestatus = GradeStatus = draft | graded | published | finalized | returned;

export interface GradingContract {
  createRubric(courseId: unknown, data: unknown): Promise<Rubric>;
  getRubric(rubricId: unknown): Promise<Rubric>;
  listRubrics(courseId: unknown, options?: unknown): Promise<PaginatedResult<Rubric>>;
  gradeSubmission(submissionId: unknown, rubricId: unknown, scores: unknown, feedback?: unknown): Promise<Grade>;
  updateGrade(gradeId: unknown, data: unknown): Promise<Grade>;
  publishGrade(gradeId: unknown): Promise<Grade>;
  finalizeGrades(courseId: unknown): Promise<Gradebook>;
  getGradebook(courseId: unknown): Promise<Gradebook>;
}
