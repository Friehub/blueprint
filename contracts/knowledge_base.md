# Module: knowledge_base

**Version:** 0.1.0
**Part:** VI -- Platform Operations

## Purpose

Defines the interface for managing a structured knowledge base -- a hierarchical collection of help articles, FAQs, internal documentation, and policy documents. A knowledge base serves multiple audiences: end-users seeking self-service answers, support agents looking up procedures, and internal teams referencing policies. This module owns article authorship, categorisation, versioning, search integration, and feedback collection. It does not own rich text rendering or the search index itself -- it publishes articles to the `search` module.

---

## State Machine

### Article State
```
DRAFT → IN_REVIEW → PUBLISHED → DEPRECATED
      ↑___________↑
DRAFT → PUBLISHED  (if approval not required)
PUBLISHED → DRAFT  (creating a new draft revision)
DEPRECATED → ARCHIVED
```

Transitions:
- `DRAFT → IN_REVIEW`: `submitForReview` called; routing to `approvals` module
- `IN_REVIEW → PUBLISHED`: approval workflow concludes with approval
- `IN_REVIEW → DRAFT`: approval rejected; author revises
- `DRAFT → PUBLISHED`: `publishArticle` called directly (no approval required)
- `PUBLISHED → DEPRECATED`: newer version published, or explicitly deprecated
- `DEPRECATED → ARCHIVED`: `archiveArticle` called

---

## Functions

### `createCategory(input: CreateCategoryInput) → Category`
Creates a hierarchical category node. Categories form a tree; a category with no parent is a root category.

### `getCategory(categoryId: CategoryId) → Category`
Returns the category and its immediate children.

### `listCategories(input: ListCategoriesInput) → Category[]`
Returns the full category tree or a subtree rooted at a given category.

### `createArticle(input: CreateArticleInput) → Article`
Creates a new article in `DRAFT` state.

### `updateArticle(input: UpdateArticleInput) → Article`
Updates a draft article's content. Not available for published articles -- updating a published article creates a new draft revision.

### `createRevision(articleId: ArticleId) → Article`
Creates a new `DRAFT` revision of a currently published article. The published version remains live until the revision is published.

### `submitForReview(articleId: ArticleId) → Article`
Transitions a draft to `IN_REVIEW`, creating an `approvals` workflow instance.

### `publishArticle(articleId: ArticleId) → Article`
Publishes a draft article directly (bypassing review) or concludes a review workflow.

### `deprecateArticle(articleId: ArticleId, reason?: string) → Article`
Marks a published article as deprecated. Optionally links to a replacement article.

### `archiveArticle(articleId: ArticleId) → void`
Removes a deprecated article from all indexes.

### `getArticle(articleId: ArticleId) → Article`
Returns the full article including body and metadata.

### `getArticleBySlug(slug: string, locale?: string) → Article`
Resolves a URL-friendly slug to the current published article. The primary access pattern for public knowledge base pages.

### `listArticles(input: ListArticlesInput) → PaginatedList<Article>`
Returns articles filtered by category, status, author, or tag.

### `recordView(input: RecordViewInput) → void`
Logs an article view event. Used to populate view counts and surface popular articles.

### `submitFeedback(input: ArticleFeedbackInput) → void`
Records a reader's helpfulness vote (`HELPFUL` | `NOT_HELPFUL`) and optional comment.

### `getArticleStats(articleId: ArticleId) → ArticleStats`
Returns view count, feedback summary, and search click-through rate for an article.

---

## Types

```typescript
type ArticleId = string;
type CategoryId = string;

type ArticleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";

type ContentFormat = "MARKDOWN" | "HTML" | "RICH_TEXT";

type CreateCategoryInput = {
  name: string;
  slug: string;
  description?: string;
  parentCategoryId?: CategoryId;
  icon?: string;
  order?: number;
};

type Category = {
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

type CreateArticleInput = {
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

type UpdateArticleInput = {
  articleId: ArticleId;
  title?: string;
  body?: string;
  excerpt?: string;
  tags?: string[];
  relatedArticleIds?: ArticleId[];
  metaDescription?: string;
};

type Article = {
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

type RecordViewInput = {
  articleId: ArticleId;
  viewerId?: UserId;
  sessionId?: string;
  referrer?: string;
};

type ArticleFeedbackInput = {
  articleId: ArticleId;
  vote: "HELPFUL" | "NOT_HELPFUL";
  comment?: string;
  submittedBy?: UserId;
};

type ArticleStats = {
  articleId: ArticleId;
  views: number;
  uniqueViews: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  helpfulnessRate: number;
  searchClickthroughs: number;
};

type ListArticlesInput = {
  categoryId?: CategoryId;
  status?: ArticleStatus;
  authorId?: UserId;
  locale?: string;
  tags?: string[];
  pagination: PaginationInput;
};

type ListCategoriesInput = {
  parentCategoryId?: CategoryId;
  locale?: string;
};
```

---

## Invariants

1. Slugs are unique within a `(locale)` scope; two articles in the same locale cannot share a slug.
2. `updateArticle` is only valid for articles in `DRAFT` state; calling it on a `PUBLISHED` article returns `ARTICLE_NOT_EDITABLE` -- callers must use `createRevision` first.
3. At most one draft revision may exist for a published article at any time.
4. `publishArticle` must index the article in the `search` module synchronously or via an outbox event before returning.
5. `archiveArticle` must remove the article from the `search` index and return a 404-equivalent from `getArticleBySlug`.
6. `recordView` is fire-and-forget; failures must not propagate to the caller.
7. Category slugs must be unique at each level of the hierarchy, not globally; two sibling categories may not share a slug, but a child may share its slug with a category in a different branch.

---

## Events Emitted

- `article.created`
- `article.submitted_for_review`
- `article.published` -- triggers search indexing
- `article.deprecated`
- `article.archived` -- triggers search de-indexing
- `article.viewed`
- `article.feedback_submitted`

---

## System-Level Integrations

- **Idempotency:** `recordView` and `submitFeedback` are best-effort; duplicate submissions within a session window are de-duplicated at the analytics layer.
- **Consistency:** Article publication and search index update must be atomic via an outbox pattern; a published article that is not searchable is a contract violation.
- **Runtime delivery:** Publication and indexing events are delivered `at_least_once`.
- **Worker scaling:** Publication sync, indexing, and analytics export must be independently scalable.
- **Multi-region:** The deployment must declare whether KB publication is single-region or active/passive; duplicate indexing across regions must be deduplicated.
- **Observability:** View events carry `articleId`, `locale`, `referrer`, and `sessionId` as span attributes for funnel analysis.
- **Backpressure:** If indexing or analytics capacity is saturated, publication follow-through must defer or reject predictably rather than losing search sync.
- **Storage model:** Article revisions and publish state must be durably stored; search index freshness is delegated to the search module.
- **Dependencies:** `search` (article indexing and retrieval), `approvals` (review workflow), `users` (author identity), `tags` (article tagging system), `localization` (locale validation), `analytics` (view metrics aggregation).
- **Errors:** `ARTICLE_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `ARTICLE_NOT_EDITABLE`, `SLUG_CONFLICT`, `ARTICLE_NOT_PUBLISHABLE`, `DRAFT_ALREADY_EXISTS`.
- **Providers (adapter examples):** Custom implementation, Notion API (authoring layer), Intercom Articles, Zendesk Guide, Confluence (internal KB).
