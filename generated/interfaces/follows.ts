// follows.ts
// Auto-generated from contracts/follows.md
// Do not edit manually

export interface Followrelation {
  followerId: string;
  followeeId: string;
  createdAt: Timestamp;
}

export interface Followcounts {
  followers: unknown;
  following: unknown;
}

export interface FollowsContract {
  follow(followerId: unknown, followeeId: unknown): Promise<FollowRelation>;
  unfollow(followerId: unknown, followeeId: unknown): Promise<void>;
  isFollowing(followerId: unknown, followeeId: unknown): Promise<boolean>;
  getFollowers(userId: unknown, options?: unknown): Promise<PaginatedResult<User>>;
  getFollowing(userId: unknown, options?: unknown): Promise<PaginatedResult<User>>;
  getFollowCounts(userId: unknown): Promise<FollowCounts>;
  getMutualFollowers(userIdA: unknown, userIdB: unknown): Promise<User[]>;
}
