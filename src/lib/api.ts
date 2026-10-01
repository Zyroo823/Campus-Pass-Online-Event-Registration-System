/**
 * API Fetch Client
 * NFR-004: Consistent JSON error handling
 * NFR-005: Availability status tracking
 */

import { ApiError } from '../types/index.ts';

export class ClientApiError extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string>;
  public retryAfterSeconds?: number;

  constructor(status: number, errorData: ApiError) {
    super(errorData.message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = errorData.code || 'UNKNOWN_ERROR';
    this.fields = errorData.fields;
    this.retryAfterSeconds = errorData.retryAfterSeconds;
  }
}

let isSystemDownCallback: ((down: boolean) => void) | null = null;

export function registerSystemDownListener(cb: (down: boolean) => void) {
  isSystemDownCallback = cb;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Sends httpOnly cookies
    });

    if (response.status === 503) {
      if (isSystemDownCallback) isSystemDownCallback(true);
    }

    if (!response.ok) {
      let errorJson: { error?: ApiError } = {};
      try {
        errorJson = await response.json();
      } catch {
        // If not JSON
        errorJson = {
          error: {
            code: `HTTP_${response.status}`,
            message: `Request failed with HTTP status ${response.status}.`,
          },
        };
      }

      const retryHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryHeader ? parseInt(retryHeader, 10) : errorJson.error?.retryAfterSeconds;

      throw new ClientApiError(response.status, {
        code: errorJson.error?.code || 'REQUEST_FAILED',
        message: errorJson.error?.message || 'An error occurred while communicating with the server.',
        fields: errorJson.error?.fields,
        retryAfterSeconds,
      });
    }

    // If 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err instanceof ClientApiError) {
      throw err;
    }

    // Network / offline error
    if (isSystemDownCallback) isSystemDownCallback(true);
    throw new ClientApiError(503, {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the campus server. Please check your network connection.',
    });
  }
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) => {
    let query = '';
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const str = searchParams.toString();
      if (str) query = `?${str}`;
    }
    return apiRequest<T>(`${endpoint}${query}`, { method: 'GET' });
  },

  post: <T = any>(endpoint: string, data?: any) => {
    return apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  put: <T = any>(endpoint: string, data?: any) => {
    return apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  patch: <T = any>(endpoint: string, data?: any) => {
    return apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  delete: <T = any>(endpoint: string) => {
    return apiRequest<T>(endpoint, { method: 'DELETE' });
  },
};
