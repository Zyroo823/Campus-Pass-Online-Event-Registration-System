/**
 * CampusPass Main App Entry
 * Plain JavaScript
 * NFR-002, NFR-005, NFR-006, NFR-007, NFR-009
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { registerSystemDownListener } from './api.js';

import { Header } from './components/common/Header.jsx';
import { Footer } from './components/common/Footer.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ParticipantDashboardPage } from './pages/ParticipantDashboardPage.jsx';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage.jsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { SystemDownPage } from './pages/SystemDownPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
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

  return children;
};

// Role-Gated Route Component
const RoleRoute = ({ allowedRoles, children }) => {
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

  return children;
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
      <ToastProvider>
        <AuthProvider>
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
                <Route
                  path="/tickets"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/dashboard" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Organizer & Admin Routes */}
                <Route
                  path="/organizer"
                  element={
                    <RoleRoute allowedRoles={['organizer', 'admin']}>
                      <OrganizerDashboardPage />
                    </RoleRoute>
                  }
                />

                {/* Admin Management Routes */}
                <Route
                  path="/admin"
                  element={
                    <RoleRoute allowedRoles={['admin']}>
                      <AdminDashboardPage />
                    </RoleRoute>
                  }
                />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>

            <Footer />
          </div>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
