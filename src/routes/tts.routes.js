"use strict";
const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const { checkSubscription, checkCharacterLimit, checkConcurrentRequests } = require('../middleware/subscription');
const { ttsLimiter } = require('../middleware/limiter');
const {
  getVoices,
  convertTextToSpeech,
  getDownloadUrl,
  previewVoice
} = require('../controllers/tts.controller');

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

// Text to speech validation
const ttsValidation = [
  body('text')
    .notEmpty()
    .withMessage('Text is required')
    .isLength({ min: 1, max: 300000 })
    .withMessage('Text must be between 1 and 300000 characters'),
  body('voiceId')
    .notEmpty()
    .withMessage('Voice ID is required'),
  body('outputFormat')
    .optional()
    .isIn(['mp3', 'wav', 'ogg'])
    .withMessage('Output format must be mp3, wav, or ogg'),
  body('engine')
    .optional()
    .isIn(['standard', 'neural'])
    .withMessage('Engine must be standard or neural')
];

// Voice preview validation
const previewValidation = [
  body('voiceId')
    .notEmpty()
    .withMessage('Voice ID is required'),
  body('sampleText')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Sample text cannot exceed 100 characters')
];

// Public routes (no authentication required)
router.get('/voices', getVoices);
router.post('/preview', previewValidation, handleValidationErrors, previewVoice);

// Protected routes (authentication required)
router.use(protect);

// TTS conversion (requires active subscription)
router.post('/convert', 
  checkSubscription, 
  checkCharacterLimit,
  checkConcurrentRequests,
  ttsLimiter, 
  ttsValidation, 
  handleValidationErrors, 
  convertTextToSpeech
);

// Download routes
router.get('/download/:fileId', getDownloadUrl);

module.exports = router;
