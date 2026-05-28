// messaging.ts
// Auto-generated from contracts/messaging.md
// Do not edit manually

export interface Thread {
  id: string;
  participants: unknown;
  unreadCount: number;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: unknown;
  edited: unknown;
  deleted: unknown;
  createdAt: Timestamp;
}

export interface Messagecontent {
  type: text | image | file | system;
  body: unknown;
}

export interface MessagingContract {
  createThread(participants: unknown, metadata?: unknown): Promise<Thread>;
  getThread(threadId: unknown): Promise<Thread>;
  getThreads(userId: unknown, options?: unknown): Promise<PaginatedResult<Thread>>;
  sendMessage(threadId: unknown, senderId: unknown, content: unknown): Promise<Message>;
  getMessages(threadId: unknown, options?: unknown): Promise<PaginatedResult<Message>>;
  editMessage(messageId: unknown, content: unknown): Promise<Message>;
  deleteMessage(messageId: unknown): Promise<void>;
  markRead(threadId: unknown, userId: unknown): Promise<void>;
  getUnreadCount(userId: unknown): Promise<number>;
  addParticipant(threadId: unknown, userId: unknown): Promise<void>;
  removeParticipant(threadId: unknown, userId: unknown): Promise<void>;
}
