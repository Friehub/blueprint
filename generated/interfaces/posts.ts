// posts.ts
// Auto-generated from contracts/posts.md
// Do not edit manually

export interface Post {
  id: string;
  authorId: string;
  content: unknown;
  status: unknown;
  pinned: unknown;
  createdAt: Timestamp;
  metadata: unknown;
}

export interface Postcontent {
  media?: Media[];
  links?: string[];
}

export interface Feeditem {
  post: unknown;
  engagementScore: unknown;
}

export type Poststatus = PostStatus = published | draft | archived | removed;

export type Postvisibility = PostVisibility = public | followers | private;

export interface PostsContract {
  createPost(authorId: unknown, content: unknown, options?: unknown): Promise<Post>;
  getPost(postId: unknown): Promise<Post>;
  updatePost(postId: unknown, content: unknown): Promise<Post>;
  deletePost(postId: unknown): Promise<void>;
  getFeed(userId: unknown, options?: unknown): Promise<PaginatedResult<FeedItem>>;
  getPostsByUser(userId: unknown, options?: unknown): Promise<PaginatedResult<Post>>;
  pinPost(postId: unknown): Promise<void>;
  unpinPost(postId: unknown): Promise<void>;
  moderatePost(postId: unknown, decision: unknown, reason?: unknown): Promise<Post>;
}
