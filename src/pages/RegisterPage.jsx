/**
 * Register Page
 * Plain JavaScript
 * FR-001: Visitor creates a participant account
 * Validation: Matches exact server rules
 * Rate Limiting: 5 per hour per IP; live countdown
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ClientApiError } from '../api.js';
import { RateLimitCountdown } from '../components/common/RateLimitCountdown.jsx';
import { AlertCircle } from 'lucide-react';

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    school_id: '',
    password: '',
    confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [isApiError, setIsApiError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(null);

  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMessage) {
      setErrorMessage(null);
      setIsApiError(false);
    }
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateClient = () => {
    const errs = {};

    const u = formData.username.trim();
    if (u.length < 4 || u.length > 20) {
      errs.username = 'Username must be between 4 and 20 characters long.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      errs.username = 'Username may only contain letters, numbers, and underscores.';
    }

    const fn = formData.full_name.trim();
    if (fn.length < 2 || fn.length > 80) {
      errs.full_name = 'Full name must be between 2 and 80 characters long.';
    } else if (!/^[a-zA-Z\s.'-]+$/.test(fn)) {
      errs.full_name = "Full name may only contain letters, spaces, periods, apostrophes, and hyphens.";
    }

    const sid = formData.school_id.trim();
    if (sid.length < 5 || sid.length > 15) {
      errs.school_id = 'School ID must be between 5 and 15 characters long.';
    } else if (!/^[a-zA-Z0-9-]+$/.test(sid)) {
      errs.school_id = 'School ID may only contain letters, numbers, and hyphens.';
    }

    const em = formData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      errs.email = 'Please provide a valid email address.';
    }

    const pw = formData.password;
    if (pw.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pw)) {
      errs.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
    } else if (pw === u) {
      errs.password = 'Password cannot be the same as your username.';
    }

    if (formData.confirm_password !== pw) {
      errs.confirm_password = 'Password confirmation does not match password.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsApiError(false);

    if (!validateClient()) {
      setErrorMessage('Please correct the validation errors in the form below.');
      return;
    }

    setLoading(true);

    try {
      await register({
        username: formData.username.trim(),
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        school_id: formData.school_id.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
      });

      showToast('Registration complete. Welcome to CampusPass.', 'success');
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.status === 429) {
          const seconds = err.retryAfterSeconds || 60;
          setRateLimitSeconds(seconds);
          setErrorMessage(null);
        } else if (err.status === 422) {
          setErrorMessage(err.message || 'The submitted form contains invalid or missing data.');
          if (err.fields) {
            setFieldErrors(err.fields);
          }
        } else if (err.status === 409) {
          setErrorMessage(err.message || 'One or more credentials are already registered.');
          if (err.fields) {
            setFieldErrors(err.fields);
          }
        } else if (
          err.isServerUnreachable ||
          err.status >= 500 ||
          err.status === 404 ||
          err.status === 0 ||
          err.code === 'NETWORK_ERROR'
        ) {
          setIsApiError(true);
          setErrorMessage("The server can't be reached. Please try again later.");
        } else {
          setErrorMessage(err.message);
          if (err.fields) {
            setFieldErrors(err.fields);
          }
        }
      } else {
        setIsApiError(true);
        setErrorMessage("The server can't be reached. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main role="main" className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-paper border-2 border-ink shadow-hard-lg p-6 sm:p-8">
        <div className="border-b-2 border-ink pb-4 mb-6">
          <span className="text-xs font-mono font-bold tracking-widest text-ink-muted uppercase">
            Student Enrollment
          </span>
          <h1 className="font-display font-black text-2xl text-ink mt-1">
            Create Participant Account
          </h1>
          <p className="font-body text-xs text-ink-muted mt-1">
            Register to claim admission passes and join official campus programs.
          </p>
        </div>

        {rateLimitSeconds && (
          <div className="mb-4">
            <RateLimitCountdown
              initialSeconds={rateLimitSeconds}
              message="Too many registration attempts."
              onExpire={() => setRateLimitSeconds(null)}
            />
          </div>
        )}

        {isApiError ? (
          <div
            role="alert"
            data-testid="api-error-notice"
            className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs flex items-start gap-2 mb-5"
          >
            <AlertCircle className="w-4 h-4 text-vermilion shrink-0 mt-0.5" />
            <div data-testid="register-error-summary">
              <p className="font-bold text-ink">Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            data-testid="register-error-summary"
            className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs flex items-start gap-2 mb-5"
          >
            <AlertCircle className="w-4 h-4 text-vermilion shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-ink">Validation Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="register-fullname"
              className="block text-xs font-mono font-bold text-ink uppercase mb-1"
            >
              Full Legal Name <span className="text-vermilion">*</span>
            </label>
            <input
              id="register-fullname"
              name="full_name"
              type="text"
              data-testid="register-fullname"
              autoComplete="name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="e.g. Juan Dela Cruz"
              aria-invalid={Boolean(fieldErrors.full_name)}
              aria-describedby={fieldErrors.full_name ? 'error-fullname' : undefined}
              className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-body text-ink placeholder:text-ink-muted focus:bg-paper"
            />
            {fieldErrors.full_name && (
              <p
                id="error-fullname"
                data-testid="field-error-full_name"
                className="mt-1 text-xs font-mono text-vermilion"
              >
                {fieldErrors.full_name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="register-schoolid"
                className="block text-xs font-mono font-bold text-ink uppercase mb-1"
              >
                School ID <span className="text-vermilion">*</span>
              </label>
              <input
                id="register-schoolid"
                name="school_id"
                type="text"
                data-testid="register-schoolid"
                value={formData.school_id}
                onChange={handleChange}
                placeholder="e.g. 24-10294-M"
                aria-invalid={Boolean(fieldErrors.school_id)}
                aria-describedby={fieldErrors.school_id ? 'error-schoolid' : undefined}
                className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
              />
              {fieldErrors.school_id && (
                <p
                  id="error-schoolid"
                  data-testid="field-error-school_id"
                  className="mt-1 text-xs font-mono text-vermilion"
                >
                  {fieldErrors.school_id}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-username"
                className="block text-xs font-mono font-bold text-ink uppercase mb-1"
              >
                Username <span className="text-vermilion">*</span>
              </label>
              <input
                id="register-username"
                name="username"
                type="text"
                data-testid="register-username"
                autoComplete="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. juandelacruz_uc (4-20 chars)"
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'error-username' : undefined}
                className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
              />
              {fieldErrors.username && (
                <p
                  id="error-username"
                  data-testid="field-error-username"
                  className="mt-1 text-xs font-mono text-vermilion"
                >
                  {fieldErrors.username}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-mono font-bold text-ink uppercase mb-1"
            >
              Institutional Email <span className="text-vermilion">*</span>
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              data-testid="register-email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. jdelacruz@uc.edu.ph"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'error-email' : undefined}
              className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-body text-ink placeholder:text-ink-muted focus:bg-paper"
            />
            {fieldErrors.email && (
              <p
                id="error-email"
                data-testid="field-error-email"
                className="mt-1 text-xs font-mono text-vermilion"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="register-password"
                className="block text-xs font-mono font-bold text-ink uppercase mb-1"
              >
                Password <span className="text-vermilion">*</span>
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                data-testid="register-password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'error-password' : undefined}
                className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
              />
              {fieldErrors.password && (
                <p
                  id="error-password"
                  data-testid="field-error-password"
                  className="mt-1 text-xs font-mono text-vermilion"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-confirm-password"
                className="block text-xs font-mono font-bold text-ink uppercase mb-1"
              >
                Confirm Password <span className="text-vermilion">*</span>
              </label>
              <input
                id="register-confirm-password"
                name="confirm_password"
                type="password"
                data-testid="register-confirm-password"
                autoComplete="new-password"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Re-enter your password to confirm"
                aria-invalid={Boolean(fieldErrors.confirm_password)}
                aria-describedby={fieldErrors.confirm_password ? 'error-confirm' : undefined}
                className="w-full px-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-ink-muted focus:bg-paper"
              />
              {fieldErrors.confirm_password && (
                <p
                  id="error-confirm"
                  data-testid="field-error-confirm_password"
                  className="mt-1 text-xs font-mono text-vermilion"
                >
                  {fieldErrors.confirm_password}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              data-testid="register-submit"
              disabled={loading || Boolean(rateLimitSeconds)}
              className="w-full py-2.5 px-4 text-xs font-mono font-bold uppercase tracking-wider border-2 border-ink bg-vermilion text-paper hover:bg-vermilion-hover transition-colors shadow-hard disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-ink/20 text-center font-mono text-xs text-ink-muted">
          <span>Already registered? </span>
          <Link
            to="/login"
            data-testid="link-to-login"
            className="text-vermilion font-bold hover:underline"
          >
            Sign in here
          </Link>
        </div>
      </div>
    </main>
  );
};
