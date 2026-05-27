# Module: tags

**Version:** 0.1.0
**Part:** III — Data and State

## Purpose

Defines the interface for a cross-domain tagging and labeling system. Tags are arbitrary, user-defined string labels that can be attached to any domain entity by reference. The tags module does not own the entities it labels — it owns only the label-to-entity associations and the tag taxonomy. Tags enable cross-cutting classification, filtering, and grouping of entities across domain boundaries without coupling the entity's domain module to the classification logic.

---

## Functions

### `createTag(input: CreateTagInput) → Tag`
Declares a named tag in the system's taxonomy. Tags may be created implicitly by `attachTag` if auto-creation is enabled; explicit creation allows setting metadata and constraints.

### `getTag(tagId: TagId) → Tag`
Returns tag definition and metadata by ID.

### `getTagByName(name: string, namespace?: string) → Tag`
Resolves a tag by its normalised name and optional namespace. Case-insensitive.

### `listTags(input: ListTagsInput) → PaginatedList<Tag>`
Lists all declared tags, optionally filtered by namespace, colour, or usage count.

### `attachTag(input: AttachTagInput) → TagAttachment`
Associates a tag with an entity. If the tag does not exist and auto-creation is permitted, the tag is created. Idempotent — duplicate attachments return the existing attachment.

### `detachTag(input: DetachTagInput) → void`
Removes the association between a tag and an entity.

### `getEntityTags(entityRef: EntityRef) → Tag[]`
Returns all tags currently attached to a given entity.

### `getTaggedEntities(input: GetTaggedEntitiesInput) → PaginatedList<EntityRef>`
Returns all entity references that carry a specific tag, optionally filtered by entity type.

### `searchByTags(input: TagSearchInput) → PaginatedList<EntityRef>`
Returns entities that match a boolean combination of tags (AND, OR, NOT). Enables faceted filtering across entity types.

### `mergeTag(input: MergeTagInput) → Tag`
Merges a source tag into a target tag. All attachments of the source tag are rewritten to the target. The source tag is deprecated.

### `deleteTag(tagId: TagId) → void`
Deletes a tag and removes all its attachments. Irreversible. Should be blocked if `protectIfUsed = true` and usage count > 0.

### `renameTag(tagId: TagId, newName: string) → Tag`
Updates the display name of a tag while preserving the tagId and all existing attachments.

---

## Types

```typescript
type TagId = string;
type AttachmentId = string;

type Tag = {
  tagId: TagId;
  name: string;                    // Normalised, URL-safe slug (e.g. "high-priority")
  displayName: string;             // Human-readable label (e.g. "High Priority")
  namespace?: string;              // Optional grouping scope (e.g. "billing", "support")
  color?: string;                  // Hex color for UI rendering
  description?: string;
  usageCount: number;              // Number of active attachments
  protectIfUsed: boolean;          // If true, deleteTag fails when usageCount > 0
  deprecated: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type TagAttachment = {
  attachmentId: AttachmentId;
  tagId: TagId;
  entityRef: EntityRef;
  attachedBy: UserId;
  attachedAt: Timestamp;
};

type EntityRef = {
  entityType: string;              // Domain module name, e.g. "orders", "users", "tickets"
  entityId: string;
};

type CreateTagInput = {
  name: string;
  displayName?: string;
  namespace?: string;
  color?: string;
  description?: string;
  protectIfUsed?: boolean;
};

type AttachTagInput = {
  tagId?: TagId;
  tagName?: string;                // Either tagId or tagName must be provided
  entityRef: EntityRef;
  attachedBy: UserId;
  autoCreate?: boolean;            // Create the tag if it does not exist
};

type DetachTagInput = {
  tagId: TagId;
  entityRef: EntityRef;
};

type GetTaggedEntitiesInput = {
  tagId: TagId;
  entityType?: string;
  pagination: PaginationInput;
};

type TagSearchInput = {
  must?: TagId[];                  // Entity must have ALL of these tags (AND)
  should?: TagId[];                // Entity must have AT LEAST ONE of these tags (OR)
  mustNot?: TagId[];               // Entity must have NONE of these tags (NOT)
  entityType?: string;
  pagination: PaginationInput;
};

type ListTagsInput = {
  namespace?: string;
  deprecated?: boolean;
  pagination: PaginationInput;
};

type MergeTagInput = {
  sourceTagId: TagId;
  targetTagId: TagId;
  requestedBy: UserId;
};
```

---

## Invariants

1. Tag names are normalised to lowercase and URL-safe on write; `"High Priority"` and `"high-priority"` resolve to the same tag within a namespace.
2. Within a namespace, tag names are unique; across namespaces, the same name may exist independently.
3. `attachTag` is idempotent on `(tagId, entityRef)`; a second call returns the existing attachment without error.
4. `deleteTag` on a tag with `protectIfUsed = true` and `usageCount > 0` must return `TAG_IN_USE`.
5. `mergeTag` is atomic: all attachment rewrites succeed or none do; partial merges are invalid.
6. `usageCount` is a derived count, not an independently writeable field; it reflects the current number of active attachments.
7. `searchByTags` must require at least one condition in `must`, `should`, or `mustNot`; an empty query returns `INVALID_TAG_QUERY`.
8. Detaching a tag from an entity that does not have that tag attached is a no-op and does not return an error.

---

## Events Emitted

- `tag.created`
- `tag.renamed`
- `tag.attached` — includes `tagId`, `entityRef`, `attachedBy`
- `tag.detached` — includes `tagId`, `entityRef`
- `tag.merged` — includes `sourceTagId`, `targetTagId`, `attachmentsMigrated`
- `tag.deprecated`
- `tag.deleted`

---

## System-Level Integrations

- **Idempotency:** `attachTag` on an existing `(tagId, entityRef)` pair returns the existing attachment without side effects.
- **Consistency:** `mergeTag` must use a saga or transaction to atomically rewrite attachments; event emission must follow completion, not precede it.
- **Observability:** `searchByTags` query structure (tag IDs and operators) must be logged as a structured span attribute to enable query pattern analysis.
- **Dependencies:** `search` (tags feed into search index facets), `audit_log` (attachment/detachment history for compliance-tagged entities), `permissions` (restrict which users may attach or delete tags in protected namespaces).
- **Errors:** `TAG_NOT_FOUND`, `TAG_NAME_CONFLICT`, `TAG_IN_USE`, `ENTITY_REF_INVALID`, `INVALID_TAG_QUERY`, `MERGE_SOURCE_EQUALS_TARGET`.
- **Providers (adapter examples):** Custom PostgreSQL/Redis implementation, Elasticsearch terms aggregation (for search integration), linear labels API (pattern reference).
