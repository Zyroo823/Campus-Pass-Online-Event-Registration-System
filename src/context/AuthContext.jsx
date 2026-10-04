/**
 * Authentication Context
 * Plain JavaScript
 * FR-001, FR-002, FR-003, NFR-002
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, registerUnauthorizedListener, setAuthToken } from '../api.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const userRef = useRef(null);
  userRef.current = user;

  const isHandling401Ref = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications');
      const unread = (res.notifications || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      // Ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // Single source of truth: verify against server session
      const res = await api.get('/api/auth/me');
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

  useEffect(() => {
    registerUnauthorizedListener(() => {
      // When session expires while UI thinks user is logged in
      if (userRef.current !== null && !isHandling401Ref.current) {
        isHandling401Ref.current = true;
        setUser(null);
        setUnreadCount(0);
        showToast('Your session has ended. Please log in again.', 'error');
        navigate('/login');
        setTimeout(() => {
          isHandling401Ref.current = false;
        }, 1500);
      }
    });
  }, [navigate, showToast]);

  const login = async (credentials) => {
    const res = await api.post('/api/auth/login', credentials);
    if (res.token) {
      setAuthToken(res.token);
    }
    setUser(res.user);
    await refreshUnreadCount();
    return res.user;
  };

  const register = async (data) => {
    const res = await api.post('/api/auth/register', data);
    if (res.token) {
      setAuthToken(res.token);
    }
    setUser(res.user);
    await refreshUnreadCount();
    return res.user;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setAuthToken(null);
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
