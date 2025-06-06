"use strict";
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authLimiter, otpLimiter, passwordResetLimiter } = require('../middleware/limiter');
const {
  register,
  verifyEmail,
  login,
  resendVerification,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');

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

// Register
 const registerValidation = [
   body('firstName')
     .trim()
     .isLength({ min: 2, max: 30 })
     .withMessage('First name must be between 2 and 30 characters'),
   body('lastName')
     .trim()
     .isLength({ min: 2, max: 30 })
     .withMessage('Last name must be between 2 and 30 characters'),
   body('email')
     .isEmail()
     .normalizeEmail()
     .withMessage('Please provide a valid email'),
   body('phone')
    .trim()
    .matches(/^(\+?\d{10,15})$/)
    .withMessage('Please enter a valid phone number (10–15 digits, optional leading +)'),
   body('password')
     .isLength({ min: 6 })
     .withMessage('Password must be at least 6 characters long')
     .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
     .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
 ];

// Login validation
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// OTP validation
const otpValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number')
];

// Password reset validation
const passwordResetValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Routes
router.post('/register', authLimiter, registerValidation, handleValidationErrors, register);
router.post('/verify-email', otpLimiter, otpValidation, handleValidationErrors, verifyEmail);
router.post('/login', authLimiter, loginValidation, handleValidationErrors, login);
router.post('/resend-verification', otpLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], handleValidationErrors, resendVerification);
router.post('/forgot-password', passwordResetLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], handleValidationErrors, forgotPassword);
router.post('/reset-password', passwordResetLimiter, passwordResetValidation, handleValidationErrors, resetPassword);

module.exports = router;
