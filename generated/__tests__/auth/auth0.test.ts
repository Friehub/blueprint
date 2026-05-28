// auth0.test.ts
// Auto-generated conformance test for auth0 → auth
// Do not edit manually

import { Auth0Adapter } from '../adapters/auth/auth0';
import type { AuthContract } from '../interfaces/auth';

describe('Auth0Adapter implements AuthContract', () => {
  const adapter: AuthContract = new Auth0Adapter({
    domain: 'test',
    client_id: 'test',
    client_secret: 'test',
    audience: 'test'
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
