/**
 * CampusPass API Client
 * Plain JavaScript
 * NFR-004: Consistent JSON error handling
 * NFR-005: System availability tracking
 */

export class ClientApiError extends Error {
  constructor(status, errorData) {
    super(errorData.message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = errorData.code || 'UNKNOWN_ERROR';
    this.fields = errorData.fields;
    this.retryAfterSeconds = errorData.retryAfterSeconds;
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

    if (response.status === 503) {
      if (isSystemDownCallback) isSystemDownCallback(true);
    }

    if (response.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    if (!response.ok) {
      let errorJson = {};
      try {
        errorJson = await response.json();
      } catch {
        errorJson = {
          error: {
            code: `HTTP_${response.status}`,
            message: `Request failed with HTTP status ${response.status}.`,
          },
        };
      }

      const retryHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryHeader
        ? parseInt(retryHeader, 10)
        : errorJson.error?.retryAfterSeconds;

      throw new ClientApiError(response.status, {
        code: errorJson.error?.code || 'REQUEST_FAILED',
        message: errorJson.error?.message || 'An error occurred while communicating with the server.',
        fields: errorJson.error?.fields,
        retryAfterSeconds,
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

    if (isSystemDownCallback) isSystemDownCallback(true);
    throw new ClientApiError(503, {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the campus server. Please check your network connection.',
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
