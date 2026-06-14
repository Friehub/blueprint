// courses.ts
// Auto-generated from contracts/courses.md
// Do not edit manually

export interface Course {
  id: string;
  title: unknown;
  ownerId: string;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: unknown;
  order: unknown;
  published: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Coursestatus = CourseStatus = draft | published | archived | deprecated;

export interface CoursesContract {
  createCourse(title: unknown, ownerId: unknown, description?: unknown, metadata?: unknown): Promise<Course>;
  getCourse(courseId: unknown): Promise<Course>;
  listCourses(input: unknown, options?: unknown): Promise<PaginatedResult<Course>>;
  updateCourse(courseId: unknown, data: unknown): Promise<Course>;
  publishCourse(courseId: unknown): Promise<Course>;
  archiveCourse(courseId: unknown): Promise<Course>;
  addLesson(courseId: unknown, lesson: unknown): Promise<Lesson>;
  updateLesson(courseId: unknown, lessonId: unknown, data: unknown): Promise<Lesson>;
  reorderLessons(courseId: unknown, order: unknown): Promise<Course>;
  listLessons(courseId: unknown, options?: unknown): Promise<PaginatedResult<Lesson>>;
}
