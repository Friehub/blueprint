// reactions.ts
// Auto-generated from contracts/reactions.md
// Do not edit manually

export interface Reaction {
  userId: string;
  subjectType: string;
  subjectId: string;
  type: unknown;
  createdAt: Timestamp;
}

export interface Reactionsummary {
  total: unknown;
  byType: Record<ReactionType;
}

export type Reactiontype = ReactionType = like | love | laugh | angry | sad | fire | clap (configurable);

export interface ReactionsContract {
  addReaction(userId: unknown, subjectType: unknown, subjectId: unknown, type: unknown): Promise<Reaction>;
  removeReaction(userId: unknown, subjectType: unknown, subjectId: unknown, type: unknown): Promise<void>;
  getReactions(subjectType: unknown, subjectId: unknown): Promise<ReactionSummary>;
  getUserReaction(userId: unknown, subjectType: unknown, subjectId: unknown): Promise<Reaction | undefined>;
  getTopReacted(subjectType: unknown, options?: unknown): Promise<ReactionLeaderboard>;
}
