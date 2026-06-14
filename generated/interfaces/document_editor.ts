// document_editor.ts
// Auto-generated from contracts/document_editor.md
// Do not edit manually

export interface Document {
  id: string;
  title: unknown;
  workspaceId: string;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Revision {
  id: string;
  documentId: string;
  content: unknown;
  authorId: string;
  version: unknown;
  createdAt: Timestamp;
}

export interface Editlock {
  documentId: string;
  userId: string;
  acquiredAt: Timestamp;
  expiresAt: Timestamp;
}

export type Documentstatus = DocumentStatus = active | archived;

export interface DocumentEditorContract {
  createDocument(title: unknown, workspaceId: unknown): Promise<Document>;
  saveRevision(documentId: unknown, content: unknown, authorId: unknown): Promise<Revision>;
  getRevisionHistory(documentId: unknown, options?: unknown): Promise<PaginatedResult<Revision>>;
  restoreRevision(revisionId: unknown): Promise<Document>;
  acquireEditLock(documentId: unknown, userId: unknown): Promise<EditLock>;
}
