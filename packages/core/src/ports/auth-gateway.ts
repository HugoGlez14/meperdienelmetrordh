import type { UserProfile } from '../models/user.ts';

export type AuthSession = {
  accessToken: string;
  user: UserProfile;
};

export interface AuthGateway {
  currentSession(): Promise<AuthSession | null>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}
