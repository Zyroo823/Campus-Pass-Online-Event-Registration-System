/**
 * Login Page
 * Plain JavaScript
 * FR-002: Registered users log in
 * NFR-002: Generic login failure message ("Invalid username or password."), no username enumeration
 * Rate Limiting: 5 failed attempts per 15 min; live countdown banner
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { ClientApiError } from '../api.js';
import { Lock, User, AlertCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isApiError, setIsApiError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [rateLimitSeconds, setRateLimitSeconds] = useState(null);
  const [demoMode, setDemoMode] = useState(() => {
    return (
      process.env.DEMO_MODE === 'true' ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_MODE === 'true')
    );
  });

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirect = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        if (typeof data.demo_mode === 'boolean') {
          setDemoMode(data.demo_mode);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!rateLimitSeconds || rateLimitSeconds <= 0) return;

    const timer = setInterval(() => {
      setRateLimitSeconds(prev => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsApiError(false);
    setFieldErrors({});

    const errors = {};
    if (!username.trim()) errors.username = 'Username is required.';
    if (!password) errors.password = 'Password is required.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setLoading(true);

    try {
      const user = await login({ username: username.trim(), password });
      showToast(`Welcome back, ${user.full_name?.split(' ')[0] || user.username}.`, 'success');

      if (redirect !== '/dashboard') {
        navigate(redirect);
      } else if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'organizer') {
        navigate('/organizer');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.status === 429) {
          const seconds = err.retryAfterSeconds || 60;
          setRateLimitSeconds(seconds);
          setErrorMessage(null);
        } else if (err.status === 401) {
          setErrorMessage('Invalid username or password.');
          if (err.fields) setFieldErrors(err.fields);
        } else if (err.status === 422) {
          setErrorMessage(err.message || 'The submitted form contains invalid or missing data.');
          if (err.fields) setFieldErrors(err.fields);
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
          if (err.fields) setFieldErrors(err.fields);
        }
      } else {
        setIsApiError(true);
        setErrorMessage("The server can't be reached. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const minutes = rateLimitSeconds ? Math.floor(rateLimitSeconds / 60) : 0;
  const seconds = rateLimitSeconds ? rateLimitSeconds % 60 : 0;

  return (
    <main role="main" className="max-w-md mx-auto px-4 py-12">
      <div className="bg-paper border-2 border-ink shadow-hard-lg p-6 sm:p-8">
        <div className="border-b-2 border-ink pb-4 mb-6">
          <span className="text-xs font-mono font-bold tracking-widest text-[#3B372E] uppercase">
            Campus Authentication
          </span>
          <h1 className="font-display font-black text-2xl text-ink mt-1">
            Sign In to CampusPass
          </h1>
        </div>

        {rateLimitSeconds && rateLimitSeconds > 0 ? (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="rate-limit-notice"
            className="p-3 border-2 border-mustard bg-mustard-faint text-ink flex items-center gap-3 font-mono text-xs shadow-hard-sm mb-4"
          >
            <AlertTriangle className="w-4 h-4 text-mustard shrink-0" />
            <p className="font-bold text-ink">
              Too many failed attempts. Try again in {minutes} min {seconds} s.
            </p>
          </div>
        ) : isApiError ? (
          <div
            role="alert"
            data-testid="api-error-notice"
            className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs flex items-start gap-2 mb-4"
          >
            <AlertCircle className="w-4 h-4 text-vermilion shrink-0 mt-0.5" />
            <div data-testid="login-error-summary">
              <p className="font-bold text-ink">Sign-in Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            data-testid="login-error-summary"
            className="p-3 border-2 border-vermilion bg-vermilion-faint text-ink font-mono text-xs flex items-start gap-2 mb-4"
          >
            <AlertCircle className="w-4 h-4 text-vermilion shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-ink">Sign-in Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-mono font-bold text-ink uppercase mb-1"
            >
              Username
            </label>
            <div className="relative">
              <input
                id="login-username"
                type="text"
                data-testid="login-username"
                autoComplete="username"
                placeholder="Enter your username (e.g. student01, organizer01, admin01)"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (errorMessage) {
                    setErrorMessage(null);
                    setIsApiError(false);
                  }
                }}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'error-username' : undefined}
                className="w-full pl-9 pr-3 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-[#524C40] focus:bg-paper"
              />
              <User className="w-4 h-4 text-[#3B372E] absolute left-3 top-3 pointer-events-none" />
            </div>
            {fieldErrors.username && (
              <p
                id="error-username"
                data-testid="field-error-username"
                className="mt-1 text-xs font-mono text-[#B83210] font-medium"
              >
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-mono font-bold text-ink uppercase mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                data-testid="login-password"
                autoComplete="current-password"
                placeholder="Enter your password (e.g. Test@1234)"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMessage) {
                    setErrorMessage(null);
                    setIsApiError(false);
                  }
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'error-password' : undefined}
                className="w-full pl-9 pr-10 py-2 border-2 border-ink bg-paper-light text-sm font-mono text-ink placeholder:text-[#524C40] focus:bg-paper"
              />
              <Lock className="w-4 h-4 text-[#3B372E] absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-2.5 text-[#3B372E] hover:text-ink cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p
                id="error-password"
                data-testid="field-error-password"
                className="mt-1 text-xs font-mono text-[#B83210] font-medium"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading || Boolean(rateLimitSeconds)}
            className="w-full py-2.5 px-4 mt-2 text-xs font-mono font-bold uppercase tracking-wider border-2 border-ink bg-ink text-paper hover:bg-ink-light transition-colors shadow-hard disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-ink/20 text-center font-mono text-xs text-[#3B372E]">
          <span>Don&apos;t have a student account? </span>
          <Link
            to="/register"
            data-testid="link-to-register"
            className="text-[#B83210] font-bold hover:underline"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
};
