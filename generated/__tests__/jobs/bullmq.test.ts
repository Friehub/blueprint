// bullmq.test.ts
// Auto-generated conformance test for bullmq → jobs
// Do not edit manually

import { BullmqAdapter } from '../adapters/jobs/bullmq';
import type { JobsContract } from '../interfaces/jobs';

describe('BullmqAdapter implements JobsContract', () => {
  const adapter: JobsContract = new BullmqAdapter({
    redis_url: 'test'
  });

  it('has registerJob method', () => {
    expect(typeof adapter.registerJob).toBe('function');
  });

  it('has scheduleJob method', () => {
    expect(typeof adapter.scheduleJob).toBe('function');
  });

  it('has triggerJob method', () => {
    expect(typeof adapter.triggerJob).toBe('function');
  });

  it('has disableJob method', () => {
    expect(typeof adapter.disableJob).toBe('function');
  });

  it('has enableJob method', () => {
    expect(typeof adapter.enableJob).toBe('function');
  });

  it('has getJob method', () => {
    expect(typeof adapter.getJob).toBe('function');
  });

  it('has listJobs method', () => {
    expect(typeof adapter.listJobs).toBe('function');
  });

  it('has getExecution method', () => {
    expect(typeof adapter.getExecution).toBe('function');
  });

  it('has listExecutions method', () => {
    expect(typeof adapter.listExecutions).toBe('function');
  });

  it('has cancelExecution method', () => {
    expect(typeof adapter.cancelExecution).toBe('function');
  });

});
