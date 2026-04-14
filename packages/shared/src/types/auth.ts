import type { UserRole } from './agent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  last_login_at?: string;
}

export interface AuthToken {
  token: string;
  user: User;
  expires_at: string;
}
