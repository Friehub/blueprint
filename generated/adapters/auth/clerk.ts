// clerk.ts
// Auto-generated adapter for clerk → auth
// Do not edit manually

import type { AuthContract } from '../interfaces/auth';

export class ClerkAdapter implements AuthContract {
  constructor(private config: {
  publishable_key: string;
  secret_key: string;
  frontend_api: string;
  }) {}

  signUp(email: unknown, password: unknown, metadata?: unknown): Promise<Session> {
    // TODO: Implement with signUp
    throw new Error('Not implemented');
  }
  signIn(email: unknown, password: unknown): Promise<Session> {
    // TODO: Implement with signIn
    throw new Error('Not implemented');
  }
  signInWithProvider(provider: unknown, token: unknown): Promise<Session> {
    // TODO: Implement with signInWithProvider
    throw new Error('Not implemented');
  }
  signOut(sessionToken: unknown): Promise<void> {
    // TODO: Implement with signOut
    throw new Error('Not implemented');
  }
  refreshToken(refreshToken: unknown): Promise<Session> {
    // TODO: Implement with refreshToken
    throw new Error('Not implemented');
  }
  verifyToken(token: unknown): Promise<TokenClaims> {
    // TODO: Implement with verifyToken
    throw new Error('Not implemented');
  }
  requestPasswordReset(email: unknown): Promise<void> {
    // TODO: Implement with requestPasswordReset
    throw new Error('Not implemented');
  }
  confirmPasswordReset(token: unknown, newPassword: unknown): Promise<void> {
    // TODO: Implement with confirmPasswordReset
    throw new Error('Not implemented');
  }
  verifyEmail(token: unknown): Promise<void> {
    // TODO: Implement with verifyEmail
    throw new Error('Not implemented');
  }
  resendVerification(email: unknown): Promise<void> {
    // TODO: Implement with resendVerification
    throw new Error('Not implemented');
  }
}
