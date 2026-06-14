// onesignal.test.ts
// Auto-generated conformance test for onesignal → notifications
// Do not edit manually

import { OnesignalAdapter } from '../adapters/notifications/onesignal';
import type { NotificationsContract } from '../interfaces/notifications';

describe('OnesignalAdapter implements NotificationsContract', () => {
  const adapter: NotificationsContract = new OnesignalAdapter({
    app_id: 'test',
    api_key: 'test'
  });

  it('has sendEmail method', () => {
    expect(typeof adapter.sendEmail).toBe('function');
  });

  it('has sendSMS method', () => {
    expect(typeof adapter.sendSMS).toBe('function');
  });

  it('has sendPush method', () => {
    expect(typeof adapter.sendPush).toBe('function');
  });

  it('has sendInApp method', () => {
    expect(typeof adapter.sendInApp).toBe('function');
  });

  it('has getNotifications method', () => {
    expect(typeof adapter.getNotifications).toBe('function');
  });

  it('has markRead method', () => {
    expect(typeof adapter.markRead).toBe('function');
  });

  it('has markAllRead method', () => {
    expect(typeof adapter.markAllRead).toBe('function');
  });

  it('has getUnreadCount method', () => {
    expect(typeof adapter.getUnreadCount).toBe('function');
  });

  it('has updatePreferences method', () => {
    expect(typeof adapter.updatePreferences).toBe('function');
  });

  it('has getPreferences method', () => {
    expect(typeof adapter.getPreferences).toBe('function');
  });

});
