"use strict";

// Define roles and their permissions
const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  FINANCE_ADMIN: 'finance_admin',
  MANAGER: 'manager'
};

const PERMISSIONS = {
  // User permissions
  VIEW_OWN_PROFILE: 'view_own_profile',
  EDIT_OWN_PROFILE: 'edit_own_profile',
  DELETE_OWN_ACCOUNT: 'delete_own_account',
  USE_TTS: 'use_tts',
  MANAGE_OWN_FILES: 'manage_own_files',
  MANAGE_OWN_SUBSCRIPTION: 'manage_own_subscription',

  // Admin permissions
  VIEW_ALL_USERS: 'view_all_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  VIEW_SUBSCRIPTIONS: 'view_subscriptions',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  APPROVE_PAYMENTS: 'approve_payments',
  VIEW_USAGE_STATS: 'view_usage_stats',
  MANAGE_PLANS: 'manage_plans',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_SYSTEM: 'manage_system',

  // Super admin permissions
  MANAGE_ROLES: 'manage_roles',
  SYSTEM_CONFIG: 'system_config',
  MANAGE_ADMINS: 'manage_admins'
};

// Define base user permissions
const USER_PERMISSIONS = [
  PERMISSIONS.VIEW_OWN_PROFILE,
  PERMISSIONS.EDIT_OWN_PROFILE,
  PERMISSIONS.DELETE_OWN_ACCOUNT,
  PERMISSIONS.USE_TTS,
  PERMISSIONS.MANAGE_OWN_FILES,
  PERMISSIONS.MANAGE_OWN_SUBSCRIPTION
];

// Role-permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.USER]: USER_PERMISSIONS,
  
  [ROLES.MANAGER]: [
    ...USER_PERMISSIONS,
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.VIEW_SUBSCRIPTIONS,
    PERMISSIONS.VIEW_USAGE_STATS,
    PERMISSIONS.VIEW_AUDIT_LOGS
  ],
  
  [ROLES.FINANCE_ADMIN]: [
    ...USER_PERMISSIONS,
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.VIEW_SUBSCRIPTIONS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.APPROVE_PAYMENTS,
    PERMISSIONS.VIEW_USAGE_STATS
  ],
  
  [ROLES.ADMIN]: [
    ...USER_PERMISSIONS,
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.EDIT_USERS,
    PERMISSIONS.DELETE_USERS,
    PERMISSIONS.VIEW_SUBSCRIPTIONS,
    PERMISSIONS.MANAGE_SUBSCRIPTIONS,
    PERMISSIONS.APPROVE_PAYMENTS,
    PERMISSIONS.VIEW_USAGE_STATS,
    PERMISSIONS.MANAGE_PLANS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.MANAGE_SYSTEM
  ],
  
  [ROLES.SUPER_ADMIN]: [
    ...Object.values(PERMISSIONS)
  ]
};

class RoleManager {
  static getRoles() {
    return ROLES;
  }

  static getPermissions() {
    return PERMISSIONS;
  }

  static getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
  }

  static hasPermission(userRole, permission) {
    const rolePermissions = this.getRolePermissions(userRole);
    return rolePermissions.includes(permission);
  }

  static hasAnyPermission(userRole, permissions) {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  static hasAllPermissions(userRole, permissions) {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  static isAdmin(userRole) {
    return [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN, ROLES.MANAGER].includes(userRole);
  }

  static isSuperAdmin(userRole) {
    return userRole === ROLES.SUPER_ADMIN;
  }

  static canManageUser(adminRole, targetUserRole) {
    // Super admin can manage anyone
    if (adminRole === ROLES.SUPER_ADMIN) return true;
    
    // Admin can manage users and managers but not other admins
    if (adminRole === ROLES.ADMIN) {
      return [ROLES.USER, ROLES.MANAGER].includes(targetUserRole);
    }
    
    // Finance admin and manager can only view, not manage users
    return false;
  }
}

// Middleware to check if user has required role
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    
    // Convert single role to array for consistency
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: roles,
        current: userRole
      });
    }

    next();
  };
};

// Middleware to check if user has required permission
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    
    const hasPermission = RoleManager.hasAllPermissions(userRole, permissions);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permissions,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware to check if user has any of the required permissions
const requireAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    
    const hasAnyPermission = RoleManager.hasAnyPermission(userRole, permissions);
    
    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permissions,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware for admin-only routes
const requireAdmin = requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN, ROLES.MANAGER]);

// Middleware for super admin-only routes
const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);

// Middleware for finance admin routes
const requireFinanceAdmin = requireRole([ROLES.FINANCE_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

// Middleware to check if user can manage another user
const canManageUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const adminRole = req.user.role;
  const targetUserId = req.params.userId || req.params.id;
  
  // If managing own account, allow
  if (req.user.id === targetUserId) {
    return next();
  }

  // Check if admin role can manage users
  if (!RoleManager.hasPermission(adminRole, PERMISSIONS.EDIT_USERS)) {
    return res.status(403).json({
      success: false,
      error: 'Cannot manage other users'
    });
  }

  next();
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleManager,
  requireRole,
  requirePermission,
  requireAnyPermission,
  requireAdmin,
  requireSuperAdmin,
  requireFinanceAdmin,
  canManageUser
};
