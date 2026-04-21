import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, isValidRole } from '../lib/rbac';

const JWT_SECRET = process.env.JWT_SECRET || 'bhojai_secret';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    restaurantId: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized: No token provided',
      code: 'NO_TOKEN'
    });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];
    
    // Validate role
    if (!isValidRole(decoded.role)) {
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Legacy role-based authorization (deprecated - use RBAC middleware instead)
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Validate role
    if (!isValidRole(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ 
          error: 'Forbidden: Insufficient permissions',
          code: 'INSUFFICIENT_ROLE',
          userRole: req.user.role,
          requiredRoles: roles
        });
    }
    next();
  };
};

// Enhanced authorize function with role validation
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!isValidRole(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid user role',
        code: 'INVALID_ROLE'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ 
          error: 'Forbidden: Insufficient permissions',
          code: 'INSUFFICIENT_ROLE',
          userRole: req.user.role,
          requiredRoles: roles
        });
    }
    next();
  };
};
