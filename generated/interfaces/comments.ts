// comments.ts
// Auto-generated from contracts/comments.md
// Do not edit manually

export interface Comment {
  id: string;
  authorId: string;
  subjectType: string;
  subjectId: string;
  content: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Commentstatus = CommentStatus = published | deleted | moderated;

export interface CommentsContract {
  createComment(authorId: unknown, subjectType: unknown, subjectId: unknown, content: unknown, parentId?: unknown): Promise<Comment>;
  getComment(commentId: unknown): Promise<Comment>;
  getComments(subjectType: unknown, subjectId: unknown, options?: unknown): Promise<PaginatedResult<Comment>>;
  getReplies(commentId: unknown, options?: unknown): Promise<PaginatedResult<Comment>>;
  updateComment(commentId: unknown, content: unknown): Promise<Comment>;
  deleteComment(commentId: unknown): Promise<void>;
  moderateComment(commentId: unknown, decision: unknown): Promise<Comment>;
  getCommentCount(subjectType: unknown, subjectId: unknown): Promise<number>;
}
