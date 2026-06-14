// auth.ts
// Auto-generated from contracts/auth.md
// Do not edit manually

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
  userId: string;
}

export interface Tokenclaims {
  userId: string;
  email: unknown;
  roles: unknown;
  expiresAt: Timestamp;
  issuedAt: Timestamp;
}

export type Authprovider = AuthProvider = email | google | github | apple | microsoft | phone;

export interface AuthContract {
  signUp(email: unknown, password: unknown, metadata?: unknown): Promise<Session>;
  signIn(email: unknown, password: unknown): Promise<Session>;
  signInWithProvider(provider: unknown, token: unknown): Promise<Session>;
  signOut(sessionToken: unknown): Promise<void>;
  refreshToken(refreshToken: unknown): Promise<Session>;
  verifyToken(token: unknown): Promise<TokenClaims>;
  requestPasswordReset(email: unknown): Promise<void>;
  confirmPasswordReset(token: unknown, newPassword: unknown): Promise<void>;
  verifyEmail(token: unknown): Promise<void>;
  resendVerification(email: unknown): Promise<void>;
}
