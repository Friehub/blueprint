// reviews.ts
// Auto-generated from contracts/reviews.md
// Do not edit manually

export interface Review {
  id: string;
  reviewerId: string;
  subjectType: string;
  subjectId: string;
  rating: unknown;
  content: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Aggregaterating {
  average: unknown;
  count: unknown;
  distribution: Record<1|2|3|4|5;
}

export type Reviewstatus = ReviewStatus = pending | published | rejected | flagged;

export type Reviewsubjecttype = ReviewSubjectType = product | seller | service;

export interface ReviewsContract {
  createReview(reviewerId: unknown, subjectType: unknown, subjectId: unknown, rating: unknown, content: unknown): Promise<Review>;
  getReview(reviewId: unknown): Promise<Review>;
  getReviews(subjectType: unknown, subjectId: unknown, options?: unknown): Promise<PaginatedResult<Review>>;
  getAggregateRating(subjectType: unknown, subjectId: unknown): Promise<AggregateRating>;
  updateReview(reviewId: unknown, data: unknown): Promise<Review>;
  deleteReview(reviewId: unknown): Promise<void>;
  moderateReview(reviewId: unknown, decision: unknown, reason?: unknown): Promise<Review>;
  flagReview(reviewId: unknown, reason: unknown): Promise<void>;
  getUserReviews(userId: unknown): Promise<PaginatedResult<Review>>;
}
