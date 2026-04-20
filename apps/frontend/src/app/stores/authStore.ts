'use client';

import { create } from 'zustand';
import { apiRequest, type StoredUser } from '../lib/api';

export interface AuthUser extends StoredUser {
  id?: string;
  name?: string;
  username?: string;
  role?: string;
  restaurantId?: string;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
}

interface LoginCredentials {
  username: string;
  password?: string;
  pin?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  hydrateFromStorage: () => void;
  setSession: (user: AuthUser, token: string) => void;
  setDemoSession: (user: AuthUser) => void;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  pinLogin: (credentials: Pick<LoginCredentials, 'username' | 'pin'>) => Promise<LoginResponse>;
  logout: () => void;
}

const DEMO_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

function isTokenUsable(token: string | null) {
  if (!token) return false;
  if (token === 'demo-token' && !DEMO_AUTH_ENABLED) return false;
  if (token !== 'demo-token') {
    const decoded = parseJwt(token);
    // If there's an exp claim, check it (with 5 min buffer). If invalid format, return false.
    if (decoded?.exp && decoded.exp * 1000 < Date.now() + 5000) {
      return false;
    }
  }
  return true;
}

function readStorageSession() {
  if (typeof window === 'undefined') {
    return { user: null as AuthUser | null, token: null as string | null };
  }

  const token = sessionStorage.getItem('auth.token');
  const rawUser = sessionStorage.getItem('auth.user');

  let user: AuthUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as AuthUser;
    } catch {
      user = null;
    }
  }

  return { user, token };
}

function writeStorageSession(user: AuthUser | null, token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    sessionStorage.setItem('auth.token', token);
  } else {
    sessionStorage.removeItem('auth.token');
  }

  if (user) {
    sessionStorage.setItem('auth.user', JSON.stringify(user));
  } else {
    sessionStorage.removeItem('auth.user');
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  isAuthenticated: false,

  hydrateFromStorage: () => {
    const session = readStorageSession();
    const token = isTokenUsable(session.token) ? session.token : null;

    if (!token) {
      writeStorageSession(null, null);
    }

    set({
      user: token ? session.user : null,
      token,
      hydrated: true,
      isAuthenticated: Boolean(token),
    });
  },

  setSession: (user, token) => {
    writeStorageSession(user, token);
    set({ user, token, hydrated: true, isAuthenticated: true });
  },

  setDemoSession: (user) => {
    const token = 'demo-token';
    writeStorageSession(user, token);
    set({ user, token, hydrated: true, isAuthenticated: true });
  },

  login: async ({ username, password, pin }) => {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: {
        username,
        password,
        ...(pin ? { pin } : {}),
      },
    });

    get().setSession(response.user, response.token);
    return response;
  },

  pinLogin: async ({ username, pin }) => {
    const response = await apiRequest<LoginResponse>('/auth/pin-login', {
      method: 'POST',
      body: {
        username,
        pin,
      },
    });

    get().setSession(response.user, response.token);
    return response;
  },

  logout: () => {
    writeStorageSession(null, null);
    set({ user: null, token: null, isAuthenticated: false, hydrated: true });
  },
}));

export function hydrateAuthStoreFromStorage() {
  useAuthStore.getState().hydrateFromStorage();
}