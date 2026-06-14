// notifications.ts
// Auto-generated from contracts/notifications.md
// Do not edit manually

export interface Notification {
  id: string;
  userId: string;
  title: unknown;
  body: unknown;
  read: unknown;
  createdAt: Timestamp;
}

export interface Deliveryresult {
  messageId: string;
  status: unknown;
  providerReference: unknown;
}

export type Notificationchannel = NotificationChannel = email | sms | push | in_app;

export interface Notificationpreferences {
  channels: Record<NotificationChannel;
}

export type Deliverystatus = DeliveryStatus = queued | sent | delivered | failed | bounced;

export interface NotificationsContract {
  sendEmail(to: unknown, templateId: unknown, variables: unknown, options?: unknown): Promise<DeliveryResult>;
  sendSMS(to: unknown, body: unknown, options?: unknown): Promise<DeliveryResult>;
  sendPush(userId: unknown, title: unknown, body: unknown, data?: unknown): Promise<DeliveryResult>;
  sendInApp(userId: unknown, notification: unknown): Promise<Notification>;
  getNotifications(userId: unknown, options?: unknown): Promise<PaginatedResult<Notification>>;
  markRead(notificationId: unknown): Promise<void>;
  markAllRead(userId: unknown): Promise<void>;
  getUnreadCount(userId: unknown): Promise<number>;
  updatePreferences(userId: unknown, preferences: unknown): Promise<NotificationPreferences>;
  getPreferences(userId: unknown): Promise<NotificationPreferences>;
}
