"use strict";
const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin, requireFinanceAdmin } = require('../middleware/roleMiddleware');
const {
  getUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  getPendingSubscriptions,
  approveSubscription,
  getUsageStats,
  getAllSubscriptions,
  getPaymentProof,
  updateSubscription,
  cleanupExpiredFiles,
  getSystemHealth
} = require('../controllers/admin.controller');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User update validation
const userUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .isIn(['user', 'admin', 'super_admin', 'finance_admin', 'manager'])
    .withMessage('Invalid role'),
  body('isEmailVerified')
    .optional()
    .isBoolean()
    .withMessage('Email verification status must be boolean')
];

// Subscription approval validation
const subscriptionApprovalValidation = [
  body('approved')
    .isBoolean()
    .withMessage('Approved status must be boolean'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// All admin routes require authentication
router.use(protect);

// User management routes (Admin and Super Admin)
router.get('/users', requireAdmin, getUsers);
router.get('/users/:userId', requireAdmin, getUserDetails);
router.put('/users/:userId', requireAdmin, userUpdateValidation, handleValidationErrors, updateUser);
router.delete('/users/:userId', requireSuperAdmin, deleteUser); // Only super admin can delete users

// Subscription management routes
router.get('/subscriptions', requireAdmin, getAllSubscriptions);
router.get('/subscriptions/pending', requireFinanceAdmin, getPendingSubscriptions);
router.put('/subscriptions/:subscriptionId/approve', 
  requireFinanceAdmin, 
  subscriptionApprovalValidation, 
  handleValidationErrors, 
  approveSubscription
);

// Statistics and monitoring (Admin and Manager)
router.get('/stats/usage', requireAdmin, getUsageStats);
router.get('/system/health', requireAdmin, getSystemHealth);

// Payment proof management (Finance Admin and above)
router.get('/subscriptions/:subscriptionId/payment-proof', requireFinanceAdmin, getPaymentProof);

// Advanced subscription management (Admin and Super Admin)
router.put('/subscriptions/:subscriptionId', requireAdmin, updateSubscription);

// System maintenance (Super Admin only)
router.post('/system/cleanup', requireSuperAdmin, cleanupExpiredFiles);

module.exports = router;
