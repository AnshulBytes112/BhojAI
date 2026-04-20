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
    '/pos/reservations',
    '/invoice',
    '/invoice/receipt',
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
    '/pos/reservations',
    '/invoice',
    '/invoice/receipt',
  ],
  WAITER: ['/pos/tables', '/pos/order', '/pos/bills', '/pos/reservations', '/invoice', '/invoice/receipt'],
  CHEF: ['/kds', '/menu', '/pos/order'],
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
  // Always allow /pos/order for all authenticated users
  if (path === '/pos/order' || path.startsWith('/pos/order/')) {
    return true;
  }
  const allowedPrefixes = ROLE_ALLOWED_PATHS[normalizeRole(role)];
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
