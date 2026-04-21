// Role-Based Access Control (RBAC) for BhojAI Restaurant Management System

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  WAITER = 'WAITER',
  CASHIER = 'CASHIER',
  KITCHEN = 'KITCHEN',
}

export enum Permission {
  // User Management
  CREATE_USER = 'CREATE_USER',
  READ_USERS = 'READ_USERS',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  
  // Restaurant Management
  READ_RESTAURANT = 'READ_RESTAURANT',
  UPDATE_RESTAURANT = 'UPDATE_RESTAURANT',
  
  // Menu Management
  CREATE_MENU = 'CREATE_MENU',
  READ_MENU = 'READ_MENU',
  UPDATE_MENU = 'UPDATE_MENU',
  DELETE_MENU = 'DELETE_MENU',
  
  // Order Management
  CREATE_ORDER = 'CREATE_ORDER',
  READ_ORDERS = 'READ_ORDERS',
  UPDATE_ORDER = 'UPDATE_ORDER',
  DELETE_ORDER = 'DELETE_ORDER',
  UPDATE_ORDER_STATUS = 'UPDATE_ORDER_STATUS',
  
  // Bill & Payment Management
  CREATE_BILL = 'CREATE_BILL',
  READ_BILLS = 'READ_BILLS',
  UPDATE_BILL = 'UPDATE_BILL',
  DELETE_BILL = 'DELETE_BILL',
  PROCESS_PAYMENT = 'PROCESS_PAYMENT',
  REFUND_PAYMENT = 'REFUND_PAYMENT',
  
  // Table Management
  CREATE_TABLE = 'CREATE_TABLE',
  READ_TABLES = 'READ_TABLES',
  UPDATE_TABLE = 'UPDATE_TABLE',
  DELETE_TABLE = 'DELETE_TABLE',
  
  // Inventory Management
  READ_INVENTORY = 'READ_INVENTORY',
  CREATE_INVENTORY = 'CREATE_INVENTORY',
  UPDATE_INVENTORY = 'UPDATE_INVENTORY',
  DELETE_INVENTORY = 'DELETE_INVENTORY',
  
  // Analytics & Reports
  READ_ANALYTICS = 'READ_ANALYTICS',
  READ_REPORTS = 'READ_REPORTS',
  EXPORT_DATA = 'EXPORT_DATA',
  
  // System Management
  READ_AUDIT_LOGS = 'READ_AUDIT_LOGS',
  MANAGE_SETTINGS = 'MANAGE_SETTINGS',
}

// Role-Permission Mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin has all permissions
    Permission.CREATE_USER,
    Permission.READ_USERS,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
    Permission.READ_RESTAURANT,
    Permission.UPDATE_RESTAURANT,
    Permission.CREATE_MENU,
    Permission.READ_MENU,
    Permission.UPDATE_MENU,
    Permission.DELETE_MENU,
    Permission.CREATE_ORDER,
    Permission.READ_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.DELETE_ORDER,
    Permission.UPDATE_ORDER_STATUS,
    Permission.CREATE_BILL,
    Permission.READ_BILLS,
    Permission.UPDATE_BILL,
    Permission.DELETE_BILL,
    Permission.PROCESS_PAYMENT,
    Permission.REFUND_PAYMENT,
    Permission.CREATE_TABLE,
    Permission.READ_TABLES,
    Permission.UPDATE_TABLE,
    Permission.DELETE_TABLE,
    Permission.READ_INVENTORY,
    Permission.CREATE_INVENTORY,
    Permission.UPDATE_INVENTORY,
    Permission.DELETE_INVENTORY,
    Permission.READ_ANALYTICS,
    Permission.READ_REPORTS,
    Permission.EXPORT_DATA,
    Permission.READ_AUDIT_LOGS,
    Permission.MANAGE_SETTINGS,
  ],
  
  [UserRole.MANAGER]: [
    // Manager can manage most things except users and critical system settings
    Permission.READ_USERS,
    Permission.READ_RESTAURANT,
    Permission.CREATE_MENU,
    Permission.READ_MENU,
    Permission.UPDATE_MENU,
    Permission.DELETE_MENU,
    Permission.CREATE_ORDER,
    Permission.READ_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.DELETE_ORDER,
    Permission.UPDATE_ORDER_STATUS,
    Permission.CREATE_BILL,
    Permission.READ_BILLS,
    Permission.UPDATE_BILL,
    Permission.DELETE_BILL,
    Permission.PROCESS_PAYMENT,
    Permission.REFUND_PAYMENT,
    Permission.CREATE_TABLE,
    Permission.READ_TABLES,
    Permission.UPDATE_TABLE,
    Permission.DELETE_TABLE,
    Permission.READ_INVENTORY,
    Permission.CREATE_INVENTORY,
    Permission.UPDATE_INVENTORY,
    Permission.DELETE_INVENTORY,
    Permission.READ_ANALYTICS,
    Permission.READ_REPORTS,
    Permission.EXPORT_DATA,
    Permission.READ_AUDIT_LOGS,
  ],
  
  [UserRole.WAITER]: [
    // Waiter can handle orders and tables
    Permission.CREATE_ORDER,
    Permission.READ_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.UPDATE_ORDER_STATUS,
    Permission.CREATE_BILL,
    Permission.READ_BILLS,
    Permission.PROCESS_PAYMENT,
    Permission.READ_TABLES,
    Permission.UPDATE_TABLE,
    Permission.READ_MENU,
  ],
  
  [UserRole.CASHIER]: [
    // Cashier focuses on payments and bills
    Permission.READ_ORDERS,
    Permission.CREATE_BILL,
    Permission.READ_BILLS,
    Permission.PROCESS_PAYMENT,
    Permission.REFUND_PAYMENT,
    Permission.READ_TABLES,
    Permission.READ_MENU,
    Permission.READ_REPORTS,
  ],
  
  [UserRole.KITCHEN]: [
    // Kitchen staff sees orders and menu
    Permission.READ_ORDERS,
    Permission.UPDATE_ORDER_STATUS,
    Permission.READ_MENU,
  ],
};

// Permission checking functions
export const hasPermission = (userRole: UserRole, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
};

export const hasAnyPermission = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission));
};

export const hasAllPermissions = (userRole: UserRole, permissions: Permission[]): boolean => {
  return permissions.every(permission => hasPermission(userRole, permission));
};

// Role hierarchy for authorization
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [UserRole.ADMIN]: [],
  [UserRole.MANAGER]: [UserRole.ADMIN],
  [UserRole.WAITER]: [UserRole.MANAGER, UserRole.ADMIN],
  [UserRole.CASHIER]: [UserRole.MANAGER, UserRole.ADMIN],
  [UserRole.KITCHEN]: [UserRole.MANAGER, UserRole.ADMIN],
};

export const canAccessRole = (userRole: UserRole, targetRole: UserRole): boolean => {
  return userRole === targetRole || ROLE_HIERARCHY[userRole].includes(targetRole);
};

// Common permission groups for easier checking
export const PERMISSION_GROUPS = {
  USER_MANAGEMENT: [
    Permission.CREATE_USER,
    Permission.READ_USERS,
    Permission.UPDATE_USER,
    Permission.DELETE_USER,
  ],
  
  ORDER_MANAGEMENT: [
    Permission.CREATE_ORDER,
    Permission.READ_ORDERS,
    Permission.UPDATE_ORDER,
    Permission.DELETE_ORDER,
    Permission.UPDATE_ORDER_STATUS,
  ],
  
  BILL_MANAGEMENT: [
    Permission.CREATE_BILL,
    Permission.READ_BILLS,
    Permission.UPDATE_BILL,
    Permission.DELETE_BILL,
    Permission.PROCESS_PAYMENT,
    Permission.REFUND_PAYMENT,
  ],
  
  MENU_MANAGEMENT: [
    Permission.CREATE_MENU,
    Permission.READ_MENU,
    Permission.UPDATE_MENU,
    Permission.DELETE_MENU,
  ],
  
  REPORTING: [
    Permission.READ_ANALYTICS,
    Permission.READ_REPORTS,
    Permission.EXPORT_DATA,
  ],
};

// Helper function to check if user can perform action on resource
export const canPerformAction = (
  userRole: UserRole,
  action: string,
  resource: string
): boolean => {
  // Map common actions to permissions
  const actionPermissionMap: Record<string, Permission> = {
    'create': Permission.CREATE_USER,
    'read': Permission.READ_USERS,
    'update': Permission.UPDATE_USER,
    'delete': Permission.DELETE_USER,
    'process_payment': Permission.PROCESS_PAYMENT,
    'refund': Permission.REFUND_PAYMENT,
  };

  const resourcePermissionMap: Record<string, Permission> = {
    'users': Permission.READ_USERS,
    'orders': Permission.READ_ORDERS,
    'bills': Permission.READ_BILLS,
    'menu': Permission.READ_MENU,
    'tables': Permission.READ_TABLES,
    'inventory': Permission.READ_INVENTORY,
    'analytics': Permission.READ_ANALYTICS,
  };

  // Combine action and resource to determine permission
  if (action === 'read' && resourcePermissionMap[resource as keyof typeof resourcePermissionMap]) {
    return hasPermission(userRole, resourcePermissionMap[resource as keyof typeof resourcePermissionMap]);
  }

  if (actionPermissionMap[action as keyof typeof actionPermissionMap]) {
    return hasPermission(userRole, actionPermissionMap[action as keyof typeof actionPermissionMap]);
  }

  return false;
};

// Get all permissions for a role
export const getRolePermissions = (role: UserRole): Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Check if role exists
export const isValidRole = (role: string): role is UserRole => {
  return Object.values(UserRole).includes(role as UserRole);
};

// Get role display name
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.MANAGER]: 'Manager',
    [UserRole.WAITER]: 'Waiter',
    [UserRole.CASHIER]: 'Cashier',
    [UserRole.KITCHEN]: 'Kitchen Staff',
  };
  return roleNames[role] || role;
};
