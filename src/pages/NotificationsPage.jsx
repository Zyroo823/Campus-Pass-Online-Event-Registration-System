/**
 * Notifications Center Page
 * FR-013: In-app notification center for approvals, rejections, event edits, and cancellations
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Bell, CheckCheck, Clock, Calendar, CheckCircle2 } from 'lucide-react';

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const { refreshUnreadCount } = useAuth();
  const { showToast } = useToast();

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.notifications || []);
    } catch (err) {
      showToast(err.message || 'Failed to load notifications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      await refreshUnreadCount();
    } catch (err) {
      showToast(err.message || 'Could not update notification status.', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read).length;
    if (unread === 0) return;

    try {
      await api.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      await refreshUnreadCount();
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not mark notifications as read.', 'error');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <main role="main" className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <section className="border-b-2 border-ink pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
            Campus Alerts
          </span>
          <h1 data-testid="notifications-title" className="font-display font-black text-3xl sm:text-4xl text-ink mt-1">
            Activity &amp; Notices
          </h1>
        </div>

        <button
          type="button"
          data-testid="mark-all-read-button"
          disabled={unreadCount === 0}
          aria-disabled={unreadCount === 0 ? "true" : "false"}
          onClick={handleMarkAllAsRead}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink font-mono text-xs font-bold shadow-hard-sm shrink-0 transition-colors ${
            unreadCount === 0
              ? 'bg-paper-dark text-ink-muted border-ink/40 opacity-60 cursor-not-allowed'
              : 'bg-paper text-ink hover:bg-paper-dark cursor-pointer'
          }`}
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark All as Read</span>
        </button>
      </section>

      {/* Notifications List */}
      <section aria-label="Notifications list">
        {loading ? (
          <div className="p-8 border-2 border-ink bg-paper text-center font-mono text-xs text-ink-muted animate-pulse">
            Loading notification feed...
          </div>
        ) : notifications.length === 0 ? (
          <div
            data-testid="empty-notifications"
            className="p-8 border-2 border-ink bg-paper text-center space-y-2 shadow-hard-sm"
          >
            <Bell className="w-8 h-8 text-ink-muted mx-auto" />
            <p className="font-display font-bold text-lg text-ink">No notifications yet.</p>
            <p className="font-body text-xs text-ink-muted">
              You will receive alerts here whenever your registrations are decided, or when events you registered for change.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => {
              const isUnread = !n.is_read;

              return (
                <article
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  className={`p-4 border-2 border-ink shadow-hard-sm flex items-start justify-between gap-4 transition-colors ${
                    isUnread ? 'bg-paper-light border-l-4 border-l-vermilion' : 'bg-paper'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {n.type === 'EVENT_UPDATE' ? (
                        <Calendar className="w-5 h-5 text-mustard" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-olive" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className={`font-body text-sm ${isUnread ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                        {isUnread && (
                          <span className="text-vermilion font-bold uppercase text-xs">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      data-testid={`mark-read-btn-${n.id}`}
                      onClick={() => handleMarkAsRead(n.id)}
                      className="px-2.5 py-1 text-xs font-mono font-bold border border-ink bg-paper hover:bg-paper-dark text-ink shrink-0 cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
