import { friendlyError } from './errors';
import { API_BASE } from './config';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(friendlyError(message, code));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});
  
  const token = localStorage.getItem('accessToken');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Auto-inject Idempotency-Key if this is a mutating state modification
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET');
  if (isMutation && !headers.has('Idempotency-Key') && (path.startsWith('/api/tickets') || path.startsWith('/api/wallet') || path.startsWith('/api/parcels') || path.startsWith('/api/payments'))) {
    headers.set('Idempotency-Key', crypto.randomUUID());
  }
  
  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
      try {
        const newAccessToken = await attemptTokenRefresh();
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        const retryResponse = await fetch(url, { ...options, headers });
        return await handleResponse(retryResponse);
      } catch (refreshErr) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth-logout'));
        throw refreshErr;
      }
    }
    
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error instanceof Error ? error.message : 'Network connection failure', 500);
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  let data: any = null;
  
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText || 'An error occurred';
    throw new ApiError(message, response.status, data?.code, data?.details);
  }
  
  return data;
}

async function attemptTokenRefresh(): Promise<string> {
  if (isRefreshing) {
    return new Promise(resolve => {
      subscribeTokenRefresh(token => {
        resolve(token);
      });
    });
  }

  isRefreshing = true;
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    isRefreshing = false;
    throw new ApiError('No refresh token available', 401);
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    isRefreshing = false;
    onRefreshed(data.accessToken);
    return data.accessToken;
  } catch (err) {
    isRefreshing = false;
    throw new ApiError('Session expired. Please log in again.', 401);
  }
}

export const api = {
  get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
  post: (path: string, body?: any, options?: RequestInit) =>
    request(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any, options?: RequestInit) =>
    request(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: any, options?: RequestInit) =>
    request(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
  /**
   * Multipart upload. Pass a FormData object. The browser sets the boundary
   * header automatically when Content-Type is omitted/blank — we deliberately
   * do NOT set application/json for FormData.
   */
  upload: (path: string, formData: FormData, options?: RequestInit) =>
    request(path, { ...options, method: 'POST', body: formData }),
};
