export type AppRole = 'ADMIN' | 'MANAGER' | 'WAITER' | 'CHEF';

const DEFAULT_ROLE: AppRole = 'WAITER';

const ROLE_HOME_PATH: Record<AppRole, string> = {
  ADMIN: '/analytics',
  MANAGER: '/analytics',
  WAITER: '/pos/tables',
  CHEF: '/kds',
};

const ROLE_ALLOWED_PATHS: Record<AppRole, string[]> = {
  ADMIN: [
    '/analytics',
    '/inventory',
    '/menu',
    '/promotions',
    '/settings',
    '/kds',
    '/pos/tables',
    '/pos/order',
    '/pos/bills',
  ],
  MANAGER: [
    '/analytics',
    '/inventory',
    '/menu',
    '/promotions',
    '/settings',
    '/kds',
    '/pos/tables',
    '/pos/order',
    '/pos/bills',
  ],
  WAITER: ['/pos/tables', '/pos/order', '/pos/bills'],
  CHEF: ['/kds', '/menu'],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  const normalized = (role || '').toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'WAITER' || normalized === 'CHEF') {
    return normalized;
  }
  return DEFAULT_ROLE;
}

export function getRoleHomePath(role: string | null | undefined): string {
  return ROLE_HOME_PATH[normalizeRole(role)];
}

export function canRoleAccessPath(role: string | null | undefined, path: string): boolean {
  const allowedPrefixes = ROLE_ALLOWED_PATHS[normalizeRole(role)];
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
