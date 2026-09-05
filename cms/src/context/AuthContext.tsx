import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Role } from '../types/auth';
import {
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  setOnUnauthorizedCallback,
} from '../api/client';
import { getMe } from '../api/auth';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  login: (token: string, user: { username: string; role: Role; id?: number }) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
    setStoredUser(null);
  }, []);

  const login = useCallback((newToken: string, newUser: { username: string; role: Role; id?: number }) => {
    setToken(newToken);
    setUser(newUser);
    setStoredToken(newToken);
    setStoredUser(newUser);
  }, []);

  useEffect(() => {
    setOnUnauthorizedCallback(logout);
  }, [logout]);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (storedToken && storedUser) {
        setUser(storedUser);
      }
      if (storedToken) {
        try {
          const userData = await getMe();
          setUser(userData);
          setStoredUser(userData);
        } catch (err: any) {
          if (err?.status === 401) {
            logout();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [logout]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
