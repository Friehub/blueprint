// rabbitmq.test.ts
// Auto-generated conformance test for rabbitmq → queues
// Do not edit manually

import { RabbitmqAdapter } from '../adapters/queues/rabbitmq';
import type { QueuesContract } from '../interfaces/queues';

describe('RabbitmqAdapter implements QueuesContract', () => {
  const adapter: QueuesContract = new RabbitmqAdapter({
    url: 'test'
  });

  it('has enqueue method', () => {
    expect(typeof adapter.enqueue).toBe('function');
  });

  it('has enqueueBulk method', () => {
    expect(typeof adapter.enqueueBulk).toBe('function');
  });

  it('has scheduleJob method', () => {
    expect(typeof adapter.scheduleJob).toBe('function');
  });

  it('has cancelJob method', () => {
    expect(typeof adapter.cancelJob).toBe('function');
  });

  it('has getJob method', () => {
    expect(typeof adapter.getJob).toBe('function');
  });

  it('has getJobStatus method', () => {
    expect(typeof adapter.getJobStatus).toBe('function');
  });

  it('has retryJob method', () => {
    expect(typeof adapter.retryJob).toBe('function');
  });

  it('has getQueueStats method', () => {
    expect(typeof adapter.getQueueStats).toBe('function');
  });

  it('has purgeQueue method', () => {
    expect(typeof adapter.purgeQueue).toBe('function');
  });

});
