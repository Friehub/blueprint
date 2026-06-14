// supertokens.test.ts
// Auto-generated conformance test for supertokens → auth
// Do not edit manually

import { SupertokensAdapter } from '../adapters/auth/supertokens';
import type { AuthContract } from '../interfaces/auth';

describe('SupertokensAdapter implements AuthContract', () => {
  const adapter: AuthContract = new SupertokensAdapter({
    api_domain: 'test',
    api_key: 'test',
    connection_uri: 'test'
  });

  it('has signUp method', () => {
    expect(typeof adapter.signUp).toBe('function');
  });

  it('has signIn method', () => {
    expect(typeof adapter.signIn).toBe('function');
  });

  it('has signInWithProvider method', () => {
    expect(typeof adapter.signInWithProvider).toBe('function');
  });

  it('has signOut method', () => {
    expect(typeof adapter.signOut).toBe('function');
  });

  it('has refreshToken method', () => {
    expect(typeof adapter.refreshToken).toBe('function');
  });

  it('has verifyToken method', () => {
    expect(typeof adapter.verifyToken).toBe('function');
  });

  it('has requestPasswordReset method', () => {
    expect(typeof adapter.requestPasswordReset).toBe('function');
  });

  it('has confirmPasswordReset method', () => {
    expect(typeof adapter.confirmPasswordReset).toBe('function');
  });

  it('has verifyEmail method', () => {
    expect(typeof adapter.verifyEmail).toBe('function');
  });

  it('has resendVerification method', () => {
    expect(typeof adapter.resendVerification).toBe('function');
  });

});
