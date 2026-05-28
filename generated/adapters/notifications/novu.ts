// novu.ts
// Auto-generated adapter for novu → notifications
// Do not edit manually

import type { NotificationsContract } from '../interfaces/notifications';

export class NovuAdapter implements NotificationsContract {
  constructor(private config: {
  api_key: string;
  environment_id: string;
  }) {}

  sendEmail(to: unknown, templateId: unknown, variables: unknown, options?: unknown): Promise<DeliveryResult> {
    // TODO: Implement with sendEmail
    throw new Error('Not implemented');
  }
  sendSMS(to: unknown, body: unknown, options?: unknown): Promise<DeliveryResult> {
    // TODO: Implement with sendSMS
    throw new Error('Not implemented');
  }
  sendPush(userId: unknown, title: unknown, body: unknown, data?: unknown): Promise<DeliveryResult> {
    // TODO: Implement with sendPush
    throw new Error('Not implemented');
  }
  getNotifications(userId: unknown, options?: unknown): Promise<PaginatedResult<Notification>> {
    // TODO: Implement with getNotifications
    throw new Error('Not implemented');
  }
  markRead(notificationId: unknown): Promise<void> {
    // TODO: Implement with markRead
    throw new Error('Not implemented');
  }
  markAllRead(userId: unknown): Promise<void> {
    // TODO: Implement with markAllRead
    throw new Error('Not implemented');
  }
  getUnreadCount(userId: unknown): Promise<number> {
    // TODO: Implement with getUnreadCount
    throw new Error('Not implemented');
  }
  updatePreferences(userId: unknown, preferences: unknown): Promise<NotificationPreferences> {
    // TODO: Implement with updatePreferences
    throw new Error('Not implemented');
  }
  getPreferences(userId: unknown): Promise<NotificationPreferences> {
    // TODO: Implement with getPreferences
    throw new Error('Not implemented');
  }
}
