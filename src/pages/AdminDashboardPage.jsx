/**
 * Admin Dashboard: User Management
 * FR-016: Admins list, search, change role of, and deactivate users
 * UI: Dense user table with inline role select and filters
 */

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const AdminDashboardPage = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Confirm dialog state for deactivation
  const [userToDeactivate, setUserToDeactivate] = useState(null);

  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/users', {
        page,
        limit: 12,
        keyword: keyword.trim() || undefined,
        role: roleFilter || undefined,
        is_active: statusFilter || undefined,
      });
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.message || 'Failed to retrieve user accounts.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, roleFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Inline role update (FR-016)
  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === currentUser?.id && newRole !== 'admin') {
      showToast('You cannot demote your own administrator account.', 'error');
      return;
    }

    try {
      await api.patch(`/api/users/${targetUser.id}`, { role: newRole });
      showToast(`Role for ${targetUser.username} updated to ${newRole}.`, 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Could not update user role.', 'error');
    }
  };

  // Toggle active/deactive status (FR-016)
  const handleToggleActive = (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      showToast('You cannot deactivate your own administrator account.', 'error');
      return;
    }

    if (targetUser.is_active === 1 || targetUser.is_active === undefined) {
      setUserToDeactivate(targetUser);
    } else {
      handleConfirmToggleActive(targetUser, 1);
    }
  };

  const handleConfirmToggleActive = async (targetUser, newStatus) => {
    try {
      await api.patch(`/api/users/${targetUser.id}`, { is_active: newStatus });
      showToast(
        `User ${targetUser.username} ${newStatus === 1 ? 'reactivated' : 'deactivated'}.`,
        'success'
      );
      setUserToDeactivate(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to update account status.', 'error');
    }
  };

  return (
    <main role="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Title Landmark */}
      <section className="border-b-2 border-ink pb-4 mb-6">
        <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
          Administrative Operations
        </span>
        <h1 data-testid="admin-title" className="font-display font-black text-3xl sm:text-4xl text-ink mt-1">
          User Access &amp; Role Governance
        </h1>
      </section>

      {/* Filter and Search Bar */}
      <section aria-label="User search controls" className="bg-paper border-2 border-ink shadow-hard p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <label htmlFor="admin-search" className="block text-xs font-mono font-bold uppercase mb-1">
              Search Accounts
            </label>
            <div className="relative">
              <input
                id="admin-search"
                type="text"
                data-testid="admin-search-input"
                value={keyword}
                onChange={e => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by username, full name, email, or school ID..."
                className="w-full pl-9 pr-3 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
              />
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label htmlFor="admin-role-filter" className="block text-xs font-mono font-bold uppercase mb-1">
              Filter by Role
            </label>
            <select
              id="admin-role-filter"
              data-testid="admin-role-filter"
              value={roleFilter}
              onChange={e => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="participant">Participant</option>
              <option value="organizer">Organizer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="admin-status-filter" className="block text-xs font-mono font-bold uppercase mb-1">
              Filter by Account Status
            </label>
            <select
              id="admin-status-filter"
              data-testid="admin-status-filter"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border-2 border-ink bg-paper-light text-xs font-mono text-ink cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="1">Active Only</option>
              <option value="0">Deactivated Only</option>
            </select>
          </div>
        </div>
      </section>

      {/* Dense User Table (FR-016) */}
      <section aria-label="Users list">
        <div className="border-2 border-ink bg-paper overflow-x-auto shadow-hard">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-paper-dark border-b-2 border-ink text-ink font-bold uppercase tracking-wider">
                <th className="p-3 border-r border-ink/30">ID</th>
                <th className="p-3 border-r border-ink/30">Username</th>
                <th className="p-3 border-r border-ink/30">Full Name</th>
                <th className="p-3 border-r border-ink/30">School ID</th>
                <th className="p-3 border-r border-ink/30">Email</th>
                <th className="p-3 border-r border-ink/30">Current Role</th>
                <th className="p-3 border-r border-ink/30">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-ink-muted animate-pulse">
                    Loading registered campus directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-ink-muted">
                    No user accounts match the current query criteria.
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const isActive = u.is_active === 1 || u.is_active === undefined;
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr
                      key={u.id}
                      data-testid={`user-row-${u.id}`}
                      className="border-b border-ink/20 hover:bg-paper-light transition-colors"
                    >
                      <td className="p-3 font-bold border-r border-ink/20">{u.id}</td>
                      <td className="p-3 font-semibold border-r border-ink/20 text-ink">
                        {u.username}
                        {isSelf && (
                          <span className="ml-1 text-xs text-ink-muted uppercase">(You)</span>
                        )}
                      </td>
                      <td className="p-3 font-body border-r border-ink/20">{u.full_name}</td>
                      <td className="p-3 border-r border-ink/20">{u.school_id}</td>
                      <td className="p-3 text-ink-muted border-r border-ink/20">{u.email}</td>

                      {/* Inline Role Selector (FR-016) */}
                      <td className="p-3 border-r border-ink/20">
                        <select
                          data-testid={`role-select-${u.id}`}
                          value={u.role}
                          disabled={isSelf}
                          onChange={e => handleRoleChange(u, e.target.value)}
                          className="px-2 py-1 border border-ink bg-paper text-xs font-mono font-bold text-ink disabled:opacity-60 cursor-pointer"
                        >
                          <option value="participant">participant</option>
                          <option value="organizer">organizer</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3 border-r border-ink/20">
                        <span
                          data-testid={`user-status-${u.id}`}
                          className={`px-2 py-0.5 border text-xs font-bold uppercase ${
                            isActive
                              ? 'bg-olive-faint text-olive border-olive'
                              : 'bg-vermilion-faint text-vermilion border-vermilion'
                          }`}
                        >
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Deactivate / Reactivate Toggle */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          data-testid={`toggle-status-btn-${u.id}`}
                          disabled={isSelf}
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1 border text-xs font-bold cursor-pointer transition-colors shadow-hard-sm ${
                            isSelf
                              ? 'opacity-40 border-ink cursor-not-allowed'
                              : isActive
                              ? 'border-ink bg-paper text-vermilion hover:bg-vermilion hover:text-paper'
                              : 'border-ink bg-olive text-paper hover:bg-olive-hover'
                          }`}
                        >
                          {isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {!loading && pagination.totalPages > 1 && (
          <nav
            role="navigation"
            aria-label="Users pagination"
            className="mt-6 pt-4 border-t-2 border-ink flex items-center justify-between font-mono text-xs"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 border-2 border-ink bg-paper text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-paper-dark transition-colors shadow-hard-sm flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="font-bold text-ink">
              Page {page} of {pagination.totalPages} ({pagination.total} total)
            </span>

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 border-2 border-ink bg-paper text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:bg-paper-dark transition-colors shadow-hard-sm flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        )}
      </section>

      {/* Confirmation Dialog for User Deactivation (FR-016) */}
      <ConfirmDialog
        isOpen={Boolean(userToDeactivate)}
        title="Deactivate Account"
        itemName={userToDeactivate ? `${userToDeactivate.full_name} (${userToDeactivate.username})` : ''}
        actionType="deactivate"
        confirmLabel="Deactivate User"
        message="Deactivating this user will revoke their session tokens and immediately block them from logging in, creating events, or claiming passes."
        onConfirm={() => userToDeactivate && handleConfirmToggleActive(userToDeactivate, 0)}
        onClose={() => setUserToDeactivate(null)}
      />
    </main>
  );
};
