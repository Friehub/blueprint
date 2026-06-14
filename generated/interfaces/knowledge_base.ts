// knowledge_base.ts
// Auto-generated from contracts/knowledge_base.md
// Do not edit manually

export type ArticleId = string;

export type CategoryId = string;

export type ArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";

export type ContentFormat = "MARKDOWN" | "HTML" | "RICH_TEXT";

export type CreateCategoryInput = {
name: string;
slug: string;
description?: string;
parentCategoryId?: CategoryId;
icon?: string;
order?: number;
};

export type Category = {
categoryId: CategoryId;
name: string;
slug: string;
description?: string;
parentCategoryId?: CategoryId;
icon?: string;
order: number;
articleCount: number;
children: Category[];
};

export type CreateArticleInput = {
title: string;
slug: string;
categoryId: CategoryId;
locale: string;
format: ContentFormat;
body: string;
excerpt?: string;
tags?: string[];
authorId: UserId;
relatedArticleIds?: ArticleId[];
requiresApproval?: boolean;
metaDescription?: string;
};

export type UpdateArticleInput = {
articleId: ArticleId;
title?: string;
body?: string;
excerpt?: string;
tags?: string[];
relatedArticleIds?: ArticleId[];
metaDescription?: string;
};

export type Article = {
articleId: ArticleId;
title: string;
slug: string;
categoryId: CategoryId;
locale: string;
format: ContentFormat;
body: string;
excerpt?: string;
tags: string[];
authorId: UserId;
reviewedBy?: UserId;
relatedArticles: ArticleId[];
status: ArticleStatus;
revision: number;
deprecatedByArticleId?: ArticleId;
metaDescription?: string;
publishedAt?: Timestamp;
createdAt: Timestamp;
updatedAt: Timestamp;
};

export type RecordViewInput = {
articleId: ArticleId;
viewerId?: UserId;
sessionId?: string;
referrer?: string;
};

export type ArticleFeedbackInput = {
articleId: ArticleId;
vote: "HELPFUL" | "NOT_HELPFUL";
comment?: string;
submittedBy?: UserId;
};

export type ArticleStats = {
articleId: ArticleId;
views: number;
uniqueViews: number;
helpfulVotes: number;
notHelpfulVotes: number;
helpfulnessRate: number;
searchClickthroughs: number;
};

export type ListArticlesInput = {
categoryId?: CategoryId;
status?: ArticleStatus;
authorId?: UserId;
locale?: string;
tags?: string[];
pagination: PaginationInput;
};

export type ListCategoriesInput = {
parentCategoryId?: CategoryId;
locale?: string;
};

export interface KnowledgeBaseContract {
  createCategory(input: CreateCategoryInput): Promise<Category>;
  getCategory(categoryId: CategoryId): Promise<Category>;
  listCategories(input: ListCategoriesInput): Promise<Category[]>;
  createArticle(input: CreateArticleInput): Promise<Article>;
  updateArticle(input: UpdateArticleInput): Promise<Article>;
  createRevision(articleId: ArticleId): Promise<Article>;
  submitForReview(articleId: ArticleId): Promise<Article>;
  publishArticle(articleId: ArticleId): Promise<Article>;
  deprecateArticle(articleId: ArticleId, reason?: string): Promise<Article>;
  archiveArticle(articleId: ArticleId): Promise<void>;
  getArticle(articleId: ArticleId): Promise<Article>;
  getArticleBySlug(slug: string, locale?: string): Promise<Article>;
  listArticles(input: ListArticlesInput): Promise<PaginatedList<Article>>;
  recordView(input: RecordViewInput): Promise<void>;
  submitFeedback(input: ArticleFeedbackInput): Promise<void>;
  getArticleStats(articleId: ArticleId): Promise<ArticleStats>;
}
