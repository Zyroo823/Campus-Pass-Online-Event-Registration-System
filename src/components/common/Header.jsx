/**
 * Header Landmark Component
 * Plain JavaScript
 * NFR-007, NFR-009: Semantic HTML5, visible focus, ARIA landmarks
 * FR-002, FR-003, FR-013, FR-014
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Ticket, Bell, LogOut, ShieldCheck, ClipboardList } from 'lucide-react';

export const Header = () => {
  const { user, logout, unreadCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const schoolName = process.env.SCHOOL_NAME || 'University of Cebu - LM Campus';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header
      role="banner"
      className="bg-paper border-b-2 border-ink sticky top-0 z-40"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            data-testid="nav-brand"
            className="flex items-center gap-2.5 text-ink hover:text-vermilion transition-colors font-display font-bold text-xl sm:text-2xl tracking-tight"
          >
            <div className="w-8 h-8 bg-ink text-paper flex items-center justify-center font-mono font-bold text-base shadow-hard-sm">
              CP
            </div>
            <span>CampusPass</span>
          </Link>
          <span className="hidden md:inline-block text-xs font-mono border-l-2 border-ink pl-3 py-1 text-ink-muted">
            {schoolName}
          </span>
        </div>

        {/* Navigation Landmark */}
        <nav
          role="navigation"
          aria-label="Main Navigation"
          className="flex items-center gap-1.5 sm:gap-2 flex-wrap"
        >
          <Link
            to="/"
            data-testid="nav-events"
            className={`px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink transition-colors flex items-center gap-1.5 shadow-hard-sm ${
              isActive('/')
                ? 'bg-ink text-paper'
                : 'bg-paper text-ink hover:bg-ink hover:text-paper'
            }`}
          >
            Events
          </Link>

          {user && (
            <>
              {/* Participant view */}
              <Link
                to="/dashboard"
                data-testid="nav-dashboard"
                className={`px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink transition-colors flex items-center gap-1.5 shadow-hard-sm ${
                  isActive('/dashboard')
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink hover:bg-ink hover:text-paper'
                }`}
              >
                <Ticket className="w-4 h-4 shrink-0" />
                <span>My Tickets</span>
              </Link>

              {/* Organizer view */}
              {(user.role === 'organizer' || user.role === 'admin') && (
                <Link
                  to="/organizer"
                  data-testid="nav-organizer"
                  className={`px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink transition-colors flex items-center gap-1.5 shadow-hard-sm ${
                    isActive('/organizer')
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  <ClipboardList className="w-4 h-4 shrink-0" />
                  <span>Organizer</span>
                </Link>
              )}

              {/* Admin view */}
              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  data-testid="nav-admin"
                  className={`px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink transition-colors flex items-center gap-1.5 shadow-hard-sm ${
                    isActive('/admin')
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Admin</span>
                </Link>
              )}

              {/* Notifications */}
              <Link
                to="/notifications"
                data-testid="nav-notifications"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                className={`relative px-2.5 py-1.5 border-2 border-ink transition-colors flex items-center justify-center shadow-hard-sm ${
                  isActive('/notifications')
                    ? 'bg-ink text-paper'
                    : 'bg-paper text-ink hover:bg-ink hover:text-paper'
                }`}
              >
                <Bell className="w-4 h-4 shrink-0" />
                {unreadCount > 0 && (
                  <span
                    data-testid="notifications-badge"
                    className="absolute -top-1.5 -right-1.5 bg-vermilion text-paper text-[10px] font-mono font-bold w-4 h-4 flex items-center justify-center border border-ink"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {/* User Auth controls */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l-2 border-ink">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-xs font-bold text-ink">{user.full_name?.split(' ')[0] || user.username}</span>
                  <span className="text-[11px] font-mono text-ink-muted uppercase">{user.role}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="px-2.5 py-1.5 text-xs font-mono font-bold border-2 border-ink bg-paper text-ink hover:bg-vermilion hover:text-paper transition-colors flex items-center gap-1 cursor-pointer shadow-hard-sm"
                  title="Sign out of CampusPass"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  data-testid="nav-login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink bg-paper text-ink hover:bg-ink hover:text-paper transition-colors shadow-hard-sm"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  data-testid="nav-register"
                  className="px-3 py-1.5 text-xs sm:text-sm font-mono font-bold border-2 border-ink bg-vermilion text-paper hover:bg-vermilion-hover transition-colors shadow-hard-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
