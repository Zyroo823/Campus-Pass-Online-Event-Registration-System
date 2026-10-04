/**
 * CampusPass API Client
 * Plain JavaScript
 * NFR-004: Consistent JSON error handling
 * NFR-005: System availability tracking
 */

export const SERVER_UNREACHABLE_MESSAGE = "The server can't be reached. Please try again later.";

export class ClientApiError extends Error {
  constructor(status, errorData = {}) {
    super(errorData.message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = errorData.code || 'UNKNOWN_ERROR';
    this.fields = errorData.fields;
    this.retryAfterSeconds = errorData.retryAfterSeconds;
    this.isServerUnreachable = Boolean(errorData.isServerUnreachable);
  }
}

let isSystemDownCallback = null;
let onUnauthorizedCallback = null;

let currentToken = typeof window !== 'undefined' ? localStorage.getItem('campus_auth_token') : null;

export function setAuthToken(token) {
  currentToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('campus_auth_token', token);
    } else {
      localStorage.removeItem('campus_auth_token');
    }
  }
}

export function getAuthToken() {
  if (!currentToken && typeof window !== 'undefined') {
    currentToken = localStorage.getItem('campus_auth_token');
  }
  return currentToken;
}

export function registerSystemDownListener(cb) {
  isSystemDownCallback = cb;
}

export function triggerSystemDown(down = true) {
  if (isSystemDownCallback) {
    isSystemDownCallback(down);
  }
}

export function registerUnauthorizedListener(cb) {
  onUnauthorizedCallback = cb;
}

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Guaranteed on all requests
    });

    if (response.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    if (!response.ok) {
      let errorJson = null;
      try {
        errorJson = await response.json();
      } catch {
        errorJson = null;
      }

      const isApiRoute = url.startsWith('/api') || url.includes('/api');
      const is5xx = response.status >= 500 && response.status <= 599;
      const isBusiness404 =
        response.status === 404 &&
        (errorJson?.error?.code === 'EVENT_NOT_FOUND' || errorJson?.error?.code === 'USER_NOT_FOUND');
      const is404OnApi = response.status === 404 && isApiRoute && !isBusiness404;
      const isServerUnreachable = is5xx || is404OnApi;

      let code = errorJson?.error?.code;
      let message = errorJson?.error?.message;

      if (isServerUnreachable) {
        code = code || (is5xx ? `HTTP_${response.status}` : 'API_NOT_FOUND');
        message = SERVER_UNREACHABLE_MESSAGE;
      } else if (!message || (typeof message === 'string' && message.includes('Request failed with HTTP status'))) {
        message = SERVER_UNREACHABLE_MESSAGE;
      }

      const retryHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryHeader
        ? parseInt(retryHeader, 10)
        : errorJson?.error?.retryAfterSeconds;

      throw new ClientApiError(response.status, {
        code: code || `HTTP_${response.status}`,
        message,
        fields: errorJson?.error?.fields,
        retryAfterSeconds,
        isServerUnreachable,
      });
    }

    if (response.status === 204) {
      return {};
    }

    return await response.json();
  } catch (err) {
    if (err instanceof ClientApiError) {
      throw err;
    }

    throw new ClientApiError(0, {
      code: 'NETWORK_ERROR',
      message: SERVER_UNREACHABLE_MESSAGE,
      isServerUnreachable: true,
    });
  }
}

export const api = {
  get: (endpoint, params) => {
    let query = '';
    if (params) {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          sp.append(k, String(v));
        }
      });
      const qs = sp.toString();
      if (qs) query = `?${qs}`;
    }
    return apiRequest(`${endpoint}${query}`, { method: 'GET' });
  },

  post: (endpoint, body) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    });
  },

  put: (endpoint, body) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    });
  },

  patch: (endpoint, body) => {
    return apiRequest(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    });
  },

  delete: (endpoint) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  },
};
