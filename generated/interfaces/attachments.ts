// attachments.ts
// Auto-generated from contracts/attachments.md
// Do not edit manually

export interface Attachment {
  id: string;
  ownerId: string;
  fileRef: unknown;
  mimeType: string;
  sizeBytes: unknown;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Attachmentlink {
  id: string;
  attachmentId: string;
  entityType: string;
  entityId: string;
  createdAt: Timestamp;
}

export interface Attachmentpreview {
  attachmentId: string;
  status: unknown;
}

export type Attachmentstatus = AttachmentStatus = pending | linked | quarantined | deleted | expired;

export interface AttachmentsContract {
  createAttachment(ownerId: unknown, fileRef: unknown, metadata?: unknown): Promise<Attachment>;
  getAttachment(attachmentId: unknown): Promise<Attachment>;
  listAttachments(input: unknown, options?: unknown): Promise<PaginatedResult<Attachment>>;
  linkAttachment(attachmentId: unknown, entityRef: unknown): Promise<AttachmentLink>;
  unlinkAttachment(attachmentId: unknown, entityRef: unknown): Promise<void>;
  deleteAttachment(attachmentId: unknown): Promise<void>;
  createPreview(attachmentId: unknown, options?: unknown): Promise<AttachmentPreview>;
  getPreview(attachmentId: unknown): Promise<AttachmentPreview | undefined>;
}
