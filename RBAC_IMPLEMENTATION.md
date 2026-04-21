# Role-Based Access Control (RBAC) Implementation

## Overview

This document outlines the comprehensive RBAC system implemented for the BhojAI Restaurant Management System. The RBAC system provides fine-grained access control based on user roles and permissions.

## User Roles

### 1. ADMIN
- **Description**: Full system access with all permissions
- **Capabilities**: Can manage users, restaurants, menu, orders, bills, inventory, analytics, and system settings
- **Use Case**: Restaurant owner or system administrator

### 2. MANAGER
- **Description**: High-level management access (except user management and critical system settings)
- **Capabilities**: Can manage menu, orders, bills, tables, inventory, view analytics and reports
- **Use Case**: Restaurant manager

### 3. WAITER
- **Description**: Front-line staff access for order management
- **Capabilities**: Can create/update orders, process payments, manage tables, view menu
- **Use Case**: Waiter staff

### 4. CASHIER
- **Description**: Payment and billing focused access
- **Capabilities**: Can process payments, manage bills, view orders and tables, view reports
- **Use Case**: Cashier staff

### 5. KITCHEN
- **Description**: Kitchen operations access
- **Capabilities**: Can view orders, update order status, view menu
- **Use Case**: Kitchen staff

## Permission System

### Permission Categories

#### User Management
- `CREATE_USER` - Create new user accounts
- `READ_USERS` - View user information
- `UPDATE_USER` - Modify user details
- `DELETE_USER` - Remove user accounts

#### Restaurant Management
- `READ_RESTAURANT` - View restaurant details
- `UPDATE_RESTAURANT` - Modify restaurant settings

#### Menu Management
- `CREATE_MENU` - Add menu items/categories
- `READ_MENU` - View menu items
- `UPDATE_MENU` - Modify menu items
- `DELETE_MENU` - Remove menu items

#### Order Management
- `CREATE_ORDER` - Create new orders
- `READ_ORDERS` - View order information
- `UPDATE_ORDER` - Modify order details
- `DELETE_ORDER` - Cancel/remove orders
- `UPDATE_ORDER_STATUS` - Change order status

#### Bill & Payment Management
- `CREATE_BILL` - Generate bills
- `READ_BILLS` - View bill information
- `UPDATE_BILL` - Modify bill details
- `DELETE_BILL` - Remove bills
- `PROCESS_PAYMENT` - Process payments
- `REFUND_PAYMENT` - Process refunds

#### Table Management
- `CREATE_TABLE` - Add restaurant tables
- `READ_TABLES` - View table information
- `UPDATE_TABLE` - Modify table details
- `DELETE_TABLE` - Remove tables

#### Inventory Management
- `READ_INVENTORY` - View inventory items
- `CREATE_INVENTORY` - Add inventory items
- `UPDATE_INVENTORY` - Modify inventory
- `DELETE_INVENTORY` - Remove inventory items

#### Analytics & Reports
- `READ_ANALYTICS` - View analytics data
- `READ_REPORTS` - View reports
- `EXPORT_DATA` - Export system data

#### System Management
- `READ_AUDIT_LOGS` - View audit logs
- `MANAGE_SETTINGS` - Modify system settings

## Role-Permission Matrix

| Permission | ADMIN | MANAGER | WAITER | CASHIER | KITCHEN |
|------------|-------|---------|--------|---------|---------|
| CREATE_USER | **X** | | | | |
| READ_USERS | **X** | **X** | | | |
| UPDATE_USER | **X** | | | | |
| DELETE_USER | **X** | | | | |
| READ_RESTAURANT | **X** | **X** | | | |
| UPDATE_RESTAURANT | **X** | | | | |
| CREATE_MENU | **X** | **X** | | | |
| READ_MENU | **X** | **X** | **X** | **X** | **X** |
| UPDATE_MENU | **X** | **X** | | | |
| DELETE_MENU | **X** | **X** | | | |
| CREATE_ORDER | **X** | **X** | **X** | | |
| READ_ORDERS | **X** | **X** | **X** | **X** | **X** |
| UPDATE_ORDER | **X** | **X** | **X** | | |
| DELETE_ORDER | **X** | **X** | | | |
| UPDATE_ORDER_STATUS | **X** | **X** | **X** | | **X** |
| CREATE_BILL | **X** | **X** | **X** | **X** | |
| READ_BILLS | **X** | **X** | **X** | **X** | |
| UPDATE_BILL | **X** | **X** | | | |
| DELETE_BILL | **X** | **X** | | | |
| PROCESS_PAYMENT | **X** | **X** | **X** | **X** | |
| REFUND_PAYMENT | **X** | **X** | | **X** | |
| CREATE_TABLE | **X** | **X** | | | |
| READ_TABLES | **X** | **X** | **X** | **X** | |
| UPDATE_TABLE | **X** | **X** | **X** | | |
| DELETE_TABLE | **X** | **X** | | | |
| READ_INVENTORY | **X** | **X** | | | |
| CREATE_INVENTORY | **X** | **X** | | | |
| UPDATE_INVENTORY | **X** | **X** | | | |
| DELETE_INVENTORY | **X** | **X** | | | |
| READ_ANALYTICS | **X** | **X** | | **X** | |
| READ_REPORTS | **X** | **X** | | **X** | |
| EXPORT_DATA | **X** | **X** | | | |
| READ_AUDIT_LOGS | **X** | **X** | | | |
| MANAGE_SETTINGS | **X** | | | | |

## Implementation Details

### Middleware Functions

#### `requirePermission(permission)`
Ensures user has the specific permission to access the route.

```typescript
router.get('/orders', requirePermission(Permission.READ_ORDERS), (req, res) => {
  // Route logic
});
```

#### `requireAnyPermission(permissions)`
Ensures user has at least one of the specified permissions.

```typescript
router.get('/reports', requireAnyPermission([Permission.READ_REPORTS, Permission.READ_ANALYTICS]), (req, res) => {
  // Route logic
});
```

#### `requireAllPermissions(permissions)`
Ensures user has all the specified permissions.

```typescript
router.post('/users', requireAllPermissions([Permission.CREATE_USER, Permission.READ_USERS]), (req, res) => {
  // Route logic
});
```

#### `requireRole(...roles)`
Ensures user has one of the specified roles (legacy support).

```typescript
router.get('/admin', requireRole(UserRole.ADMIN, UserRole.MANAGER), (req, res) => {
  // Route logic
});
```

### Database Schema Updates

#### User Model Enhancements
```prisma
model User {
  id           String     @id @default(cuid())
  username     String     @unique
  passwordHash String
  name         String
  email        String?    @unique
  phone        String?
  role         UserRole   @default(WAITER)
  pin          String?
  isActive     Boolean    @default(true)
  lastLoginAt  DateTime?
  restaurantId String
  // ... other fields
}

enum UserRole {
  ADMIN
  MANAGER
  WAITER
  CASHIER
  KITCHEN
}
```

#### Order Model Audit Fields
```prisma
model Order {
  // ... existing fields
  createdById   String?
  createdBy     User?    @relation("OrderCreator", fields: [createdById], references: [id])
  updatedById   String?
  updatedBy     User?    @relation("OrderUpdater", fields: [updatedById], references: [id])
  // ... other fields
}
```

## Usage Examples

### Protecting Routes
```typescript
// Only admins can create users
router.post('/users', 
  authenticate, 
  requirePermission(Permission.CREATE_USER),
  createUserController
);

// Managers and admins can view analytics
router.get('/analytics', 
  authenticate, 
  requireAnyPermission([Permission.READ_ANALYTICS, Permission.READ_REPORTS]),
  analyticsController
);

// Kitchen staff can update order status
router.patch('/orders/:id/status', 
  authenticate, 
  requirePermission(Permission.UPDATE_ORDER_STATUS),
  updateOrderStatusController
);
```

### Checking Permissions in Code
```typescript
import { hasPermission, UserRole, Permission } from '../lib/rbac';

function canUserDeleteOrder(userRole: UserRole): boolean {
  return hasPermission(userRole, Permission.DELETE_ORDER);
}

function canUserAccessReports(userRole: UserRole): boolean {
  return hasAnyPermission(userRole, [
    Permission.READ_REPORTS,
    Permission.READ_ANALYTICS
  ]);
}
```

### Self-Service Permissions
```typescript
// Users can update their own profile or need admin permission
router.patch('/users/:id', 
  authenticate, 
  requireSelfOrPermission(Permission.UPDATE_USER),
  updateUserController
);
```

## Security Features

### 1. Role Validation
- All user roles are validated against the UserRole enum
- Invalid roles are rejected during authentication

### 2. Permission Checking
- Fine-grained permission checking at route level
- Permission inheritance through role hierarchy

### 3. Audit Logging
- All sensitive actions are logged with user context
- Track who did what, when, and to what resource

### 4. Rate Limiting
- Sensitive operations have rate limiting
- Prevents brute force attacks and abuse

### 5. Input Validation
- Role and permission inputs are strictly validated
- Prevents injection attacks

## Migration Guide

### From Legacy Role System
1. Update existing user roles to new UserRole enum values
2. Apply RBAC middleware to all protected routes
3. Update frontend to handle new permission system
4. Test all user flows with different roles

### Database Migration
```bash
# Apply schema changes
npx prisma db push

# Generate types
npx prisma generate
```

## Testing

### Unit Tests
```typescript
import { hasPermission, UserRole, Permission } from '../lib/rbac';

describe('RBAC Permissions', () => {
  test('Admin should have all permissions', () => {
    Object.values(Permission).forEach(permission => {
      expect(hasPermission(UserRole.ADMIN, permission)).toBe(true);
    });
  });

  test('Waiter should have limited permissions', () => {
    expect(hasPermission(UserRole.WAITER, Permission.CREATE_ORDER)).toBe(true);
    expect(hasPermission(UserRole.WAITER, Permission.DELETE_USER)).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('RBAC Middleware', () => {
  test('Should allow access with correct permission', async () => {
    const response = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(200);
  });

  test('Should deny access without permission', async () => {
    const response = await request(app)
      .delete('/users/some-id')
      .set('Authorization', `Bearer ${waiterToken}`)
      .expect(403);
  });
});
```

## Frontend Integration

### Permission-Based UI
```typescript
// Show/hide UI elements based on permissions
{hasPermission(user.role, Permission.CREATE_USER) && (
  <button onClick={openCreateUserModal}>Add User</button>
)}

// Disable buttons for unauthorized actions
<button 
  disabled={!hasPermission(user.role, Permission.DELETE_ORDER)}
  onClick={deleteOrder}
>
  Delete Order
</button>
```

### Route Guards
```typescript
// Protect routes in React Router
<ProtectedRoute 
  path="/users" 
  component={UsersPage}
  requiredPermission={Permission.READ_USERS}
/>
```

## Best Practices

### 1. Principle of Least Privilege
- Only grant permissions that are absolutely necessary
- Start with minimum permissions and add as needed

### 2. Regular Audits
- Review user permissions regularly
- Remove unnecessary permissions
- Monitor audit logs for suspicious activity

### 3. Role-Based Design
- Design roles based on job functions
- Avoid creating roles for individual users
- Keep role definitions clear and documented

### 4. Error Handling
- Provide clear error messages for permission denials
- Log permission violations for security monitoring
- Don't expose internal system details in error messages

## Troubleshooting

### Common Issues

#### Permission Denied Errors
1. Check user role in database
2. Verify permission mapping in RBAC system
3. Ensure middleware is applied correctly

#### Role Validation Errors
1. Verify UserRole enum values
2. Check database schema migration
3. Ensure role is properly set during user creation

#### Performance Issues
1. Cache permission checks where possible
2. Avoid complex permission logic in hot paths
3. Use database indexes for user role queries

### Debugging Tools
```typescript
// Debug permission checks
console.log('User Role:', user.role);
console.log('Required Permission:', Permission.CREATE_ORDER);
console.log('Has Permission:', hasPermission(user.role, Permission.CREATE_ORDER));

// Debug middleware
console.log('RBAC Check:', {
  userRole: req.user?.role,
  requiredPermission: permission,
  hasPermission: hasPermission(req.user?.role, permission)
});
```

## Future Enhancements

### 1. Dynamic Permissions
- Allow runtime permission configuration
- Support for custom permission sets

### 2. Resource-Based Permissions
- Permissions scoped to specific resources
- Owner-based access control

### 3. Time-Based Permissions
- Temporary permissions with expiration
- Shift-based access control

### 4. Multi-Tenant Support
- Organization-level permissions
- Cross-tenant access controls

This RBAC implementation provides a robust, scalable, and secure access control system for the BhojAI Restaurant Management System.
