import type { AuthGateway, AuthSession } from '../ports/auth-gateway.ts';

export class SessionController {
  private readonly auth: AuthGateway;

  constructor(auth: AuthGateway) {
    this.auth = auth;
  }

  getSession(): Promise<AuthSession | null> {
    return this.auth.currentSession();
  }

  signInWithGoogle(): Promise<void> {
    return this.auth.signInWithGoogle();
  }

  signOut(): Promise<void> {
    return this.auth.signOut();
  }
}
