import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { 
  Permission, 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  UserRole,
  canPerformAction,
  isValidRole
} from '../lib/rbac';

// Re-export Permission for convenience
export { Permission, UserRole } from '../lib/rbac';

// Enhanced RBAC middleware
export const requirePermission = (permission: Permission) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        userRole: userRole
      });
    }

    next();
  };
};

// Require any of the specified permissions
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!hasAnyPermission(userRole, permissions)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        userRole: userRole
      });
    }

    next();
  };
};

// Require all specified permissions
export const requireAllPermissions = (permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!hasAllPermissions(userRole, permissions)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        userRole: userRole
      });
    }

    next();
  };
};

// Check if user can perform specific action on resource
export const requireAction = (action: string, resource: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!canPerformAction(userRole, action, resource)) {
      return res.status(403).json({ 
        error: 'Forbidden: Cannot perform this action',
        code: 'ACTION_NOT_ALLOWED',
        action,
        resource,
        userRole: userRole
      });
    }

    next();
  };
};

// Role-based authorization (legacy support)
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient role permissions',
        code: 'INSUFFICIENT_ROLE',
        required: roles,
        userRole: userRole
      });
    }

    next();
  };
};

// Self-service permissions (users can manage their own profile)
export const requireSelfOrPermission = (permission: Permission, userIdField = 'id') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    // Allow if user has the permission OR is accessing their own resource
    const isOwnResource = req.params[userIdField] === req.user.id || 
                        req.body?.[userIdField] === req.user.id ||
                        req.query[userIdField] === req.user.id;

    if (!isOwnResource && !hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: 'Forbidden: Can only access own resources or need permission',
        code: 'SELF_OR_PERMISSION_REQUIRED',
        permission,
        userRole: userRole
      });
    }

    next();
  };
};

// Resource-based permissions with ownership check
export const requireOwnershipOrPermission = (
  resourceType: string,
  permission: Permission,
  ownerIdField = 'userId'
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role as UserRole;
    
    if (!isValidRole(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    // Admin and Manager can bypass ownership check
    if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
      return next();
    }

    // Check if user has permission (for non-admins)
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        permission,
        userRole: userRole
      });
    }

    // For other roles, we would need to fetch the resource and check ownership
    // This would be implemented per resource type
    next();
  };
};

// Audit logging middleware
export const auditAction = (action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Store the original res.json function
    const originalJson = res.json;
    
    // Override res.json to capture the response
    res.json = function(data: any) {
      // Log the action (in a real implementation, this would go to a database)
      console.log('AUDIT:', {
        action,
        user: req.user,
        method: req.method,
        url: req.url,
        body: req.body,
        timestamp: new Date().toISOString(),
        response: data
      });
      
      // Call the original json function
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Rate limiting middleware for sensitive operations
export const rateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const now = Date.now();
    const userRequests = requests.get(userId);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
      });
    }

    userRequests.count++;
    next();
  };
};
