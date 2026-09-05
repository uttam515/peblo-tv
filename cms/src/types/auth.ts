export type Role = 'admin' | 'editor';

export interface User {
  id?: number;
  username: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  username: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}
