// tags.ts
// Auto-generated from contracts/tags.md
// Do not edit manually

export type TagId = string;

export type AttachmentId = string;

export type Tag = {
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

export type TagAttachment = {
attachmentId: AttachmentId;
tagId: TagId;
entityRef: EntityRef;
attachedBy: UserId;
attachedAt: Timestamp;
};

export type EntityRef = {
entityType: string;              // Domain module name, e.g. "orders", "users", "tickets"
entityId: string;
};

export type CreateTagInput = {
name: string;
displayName?: string;
namespace?: string;
color?: string;
description?: string;
protectIfUsed?: boolean;
};

export type AttachTagInput = {
tagId?: TagId;
tagName?: string;                // Either tagId or tagName must be provided
entityRef: EntityRef;
attachedBy: UserId;
autoCreate?: boolean;            // Create the tag if it does not exist
};

export type DetachTagInput = {
tagId: TagId;
entityRef: EntityRef;
};

export type GetTaggedEntitiesInput = {
tagId: TagId;
entityType?: string;
pagination: PaginationInput;
};

export type TagSearchInput = {
must?: TagId[];                  // Entity must have ALL of these tags (AND)
should?: TagId[];                // Entity must have AT LEAST ONE of these tags (OR)
mustNot?: TagId[];               // Entity must have NONE of these tags (NOT)
entityType?: string;
pagination: PaginationInput;
};

export type ListTagsInput = {
namespace?: string;
deprecated?: boolean;
pagination: PaginationInput;
};

export type MergeTagInput = {
sourceTagId: TagId;
targetTagId: TagId;
requestedBy: UserId;
};

export interface TagsContract {
  createTag(input: CreateTagInput): Promise<Tag>;
  getTag(tagId: TagId): Promise<Tag>;
  getTagByName(name: string, namespace?: string): Promise<Tag>;
  listTags(input: ListTagsInput): Promise<PaginatedList<Tag>>;
  attachTag(input: AttachTagInput): Promise<TagAttachment>;
  detachTag(input: DetachTagInput): Promise<void>;
  getEntityTags(entityRef: EntityRef): Promise<Tag[]>;
  getTaggedEntities(input: GetTaggedEntitiesInput): Promise<PaginatedList<EntityRef>>;
  searchByTags(input: TagSearchInput): Promise<PaginatedList<EntityRef>>;
  mergeTag(input: MergeTagInput): Promise<Tag>;
  deleteTag(tagId: TagId): Promise<void>;
  renameTag(tagId: TagId, newName: string): Promise<Tag>;
}
