// novu.test.ts
// Auto-generated conformance test for novu → notifications
// Do not edit manually

import { NovuAdapter } from '../adapters/notifications/novu';
import type { NotificationsContract } from '../interfaces/notifications';

describe('NovuAdapter implements NotificationsContract', () => {
  const adapter: NotificationsContract = new NovuAdapter({
    api_key: 'test',
    environment_id: 'test'
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
