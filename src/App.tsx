/**
 * CampusPass Main App Entry
 * NFR-002, NFR-005, NFR-006, NFR-007, NFR-009
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { registerSystemDownListener } from './lib/api.ts';

import { Header } from './components/common/Header.tsx';
import { Footer } from './components/common/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { EventDetailPage } from './pages/EventDetailPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { ParticipantDashboardPage } from './pages/ParticipantDashboardPage.tsx';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { SystemDownPage } from './pages/SystemDownPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-8 font-mono text-xs text-ink-muted">
        Validating session credentials...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Role-Gated Route Component
const RoleRoute: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-8 font-mono text-xs text-ink-muted">
        Verifying permissions...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const [isSystemDown, setIsSystemDown] = useState(false);

  useEffect(() => {
    registerSystemDownListener(down => setIsSystemDown(down));
  }, []);

  if (isSystemDown) {
    return <SystemDownPage onRetry={() => setIsSystemDown(false)} />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="flex flex-col min-h-screen bg-paper text-ink selection:bg-vermilion selection:text-paper">
            <Header />

            <div className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/events/:id" element={<EventDetailPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Participant Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <ParticipantDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Organizer Routes */}
                <Route
                  path="/organizer"
                  element={
                    <RoleRoute allowedRoles={['organizer', 'admin']}>
                      <OrganizerDashboardPage />
                    </RoleRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminDashboardPage />
                    </RoleRoute>
                  }
                />

                {/* Notifications */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>

            <Footer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
