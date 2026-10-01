/**
 * Authentication Context
 * FR-001, FR-002, FR-003, NFR-002
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  unreadCount: number;
  login: (credentials: { username: string; password: string }) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: any[] }>('/api/notifications');
      const unread = (res.notifications || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
      await refreshUnreadCount();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: { username: string; password: string }): Promise<User> => {
    const res = await api.post<{ user: User; message: string }>('/api/auth/login', credentials);
    setUser(res.user);
    await refreshUnreadCount();
    return res.user;
  };

  const register = async (data: any): Promise<User> => {
    const res = await api.post<{ user: User; message: string }>('/api/auth/register', data);
    setUser(res.user);
    await refreshUnreadCount();
    return res.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setUnreadCount(0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadCount,
        login,
        register,
        logout,
        refreshUser,
        refreshUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
