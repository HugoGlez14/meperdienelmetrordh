export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type SavedRoute = {
  id: string;
  userId: string;
  name: string;
  transport: 'metro' | 'metrobus';
  fromStation: string;
  toStation: string;
  preference: 'fast' | 'transfers';
  createdAt: string;
};

export type UserPreferences = {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  defaultRouteMode: 'fast' | 'transfers';
};
