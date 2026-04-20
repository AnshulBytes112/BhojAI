const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();

let defaultApi = 'http://localhost:3333/api';
if (typeof window !== 'undefined') {
  defaultApi = `http://${window.location.hostname}:3333/api`;
}

export const API_BASE = configuredApiBase || defaultApi;

export interface StoredUser {
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  restaurantId?: string;
}

function isSerializableBody(body: unknown) {
  return (
    body !== null &&
    body !== undefined &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  );
}

function clearInvalidSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('auth.token');
  sessionStorage.removeItem('auth.user');
}

export async function apiRequest<T>(path: string, init: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth.token') : null;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = init.body as BodyInit | null | undefined;
  if (isSerializableBody(init.body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(init.body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body,
  });

  if (response.status === 204) {
    return null as T;
  }

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearInvalidSession();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: string }).error || 'Request failed')
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('auth.user');
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
