import type {
  SavedRoute,
  UserPreferences,
  UserProfile
} from '../models/user.ts';

export interface UserRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  listSavedRoutes(userId: string): Promise<SavedRoute[]>;
  saveRoute(route: Omit<SavedRoute, 'id' | 'createdAt'>): Promise<SavedRoute>;
  deleteSavedRoute(userId: string, routeId: string): Promise<void>;
  getPreferences(userId: string): Promise<UserPreferences>;
  savePreferences(userId: string, preferences: UserPreferences): Promise<void>;
}
