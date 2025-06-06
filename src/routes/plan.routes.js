"use strict";
const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, admin } = require('../middleware/auth');
const {
  getPlans,
  getPlan,
  subscribeToPlan,
  cancelSubscription,
  getSubscription,
  createPlan,
  updatePlan,
  deletePlan,
  uploadPaymentProof,
  getPaymentProof,
  upload
} = require('../controllers/plan.controller');

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

// Subscription validation
const subscriptionValidation = [
  body('planId')
    .notEmpty()
    .isMongoId()
    .withMessage('Valid plan ID is required'),
  body('paymentMethod')
    .optional()
    .isIn(['stripe', 'paypal', 'manual'])
    .withMessage('Payment method must be stripe, paypal, or manual')
];

// Plan creation validation
const planValidation = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Plan name must be between 2 and 100 characters'),
  body('description')
    .notEmpty()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Plan description must be between 10 and 500 characters'),
  body('price')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('duration')
    .isIn(['monthly', 'yearly', 'lifetime'])
    .withMessage('Duration must be monthly, yearly, or lifetime'),
  body('features.charactersPerMonth')
    .isInt({ min: 0 })
    .withMessage('Characters per month must be a positive integer'),
  body('features.voicesAvailable')
    .isInt({ min: 1 })
    .withMessage('Voices available must be at least 1'),
  body('features.audioFormats')
    .isArray()
    .withMessage('Audio formats must be an array'),
  body('features.audioFormats.*')
    .isIn(['mp3', 'wav', 'ogg'])
    .withMessage('Audio formats must be mp3, wav, or ogg')
];

// Public routes
router.get('/', getPlans);
router.get('/:planId', getPlan);

// Protected routes (authentication required)
router.use(protect);

// Subscription management
router.post('/subscribe', subscriptionValidation, handleValidationErrors, subscribeToPlan);
router.delete('/subscription', cancelSubscription);
router.get('/subscription/details', getSubscription);

// Payment proof management
router.post('/subscription/:subscriptionId/payment-proof', upload.single('paymentProof'), uploadPaymentProof);
router.get('/subscription/:subscriptionId/payment-proof', getPaymentProof);

// Admin routes (admin access required)
router.use(admin);
router.post('/admin/create', planValidation, handleValidationErrors, createPlan);
router.put('/admin/:planId', planValidation, handleValidationErrors, updatePlan);
router.delete('/admin/:planId', deletePlan);

module.exports = router;
