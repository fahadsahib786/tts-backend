"use strict";
const Subscription = require('../models/Subscription');
const User = require('../models/User');

// Middleware to check if user has an active subscription
const checkSubscription = async (req, res, next) => {
  try {
    // Get user with subscription details
    const user = await User.findById(req.user.id).populate({
      path: 'subscription',
      populate: {
        path: 'plan'
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has a subscription
    if (!user.subscription) {
      return res.status(403).json({
        success: false,
        error: 'No subscription found. Please subscribe to a plan to use this feature.',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Check if subscription is active
    if (user.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Your subscription is not active. Please ensure your payment is processed.',
        code: 'INACTIVE_SUBSCRIPTION',
        data: {
          subscriptionStatus: user.subscription.status,
          subscriptionId: user.subscription._id
        }
      });
    }

    // Check if subscription has expired
    const now = new Date();
    if (user.subscription.endDate && user.subscription.endDate < now) {
      // Mark subscription as expired
      user.subscription.status = 'expired';
      await user.subscription.save();

      return res.status(403).json({
        success: false,
        error: 'Your subscription has expired. Please renew to continue using this feature.',
        code: 'EXPIRED_SUBSCRIPTION',
        data: {
          expiredDate: user.subscription.endDate,
          subscriptionId: user.subscription._id
        }
      });
    }

    // Add subscription info to request for use in controllers
    req.subscription = user.subscription;
    req.plan = user.subscription.plan;

    next();
  } catch (error) {
    console.error('Check subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify subscription status'
    });
  }
};

// Middleware to check if user has a specific plan feature
const requirePlanFeature = (featureName) => {
  return (req, res, next) => {
    if (!req.plan || !req.plan.features) {
      return res.status(403).json({
        success: false,
        error: 'Plan features not available'
      });
    }

    const hasFeature = req.plan.features[featureName];
    if (!hasFeature) {
      return res.status(403).json({
        success: false,
        error: `Your current plan does not include ${featureName}. Please upgrade your plan.`,
        code: 'FEATURE_NOT_AVAILABLE',
        data: {
          requiredFeature: featureName,
          currentPlan: req.plan.name
        }
      });
    }

    next();
  };
};

// Middleware to check character limit before processing
const checkCharacterLimit = async (req, res, next) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const textLength = text.length;
    
    // Get current usage
    const Usage = require('../models/Usage');
    const usage = await Usage.getOrCreateCurrentUsage(req.user.id, req.subscription._id);

    // Check if user has enough quota
    if (!usage.hasQuota(textLength)) {
      const remaining = usage.getRemainingCharacters();
      const usagePercentage = usage.getUsagePercentage();

      return res.status(403).json({
        success: false,
        error: 'Character limit exceeded for this month',
        code: 'QUOTA_EXCEEDED',
        data: {
          charactersUsed: usage.charactersUsed,
          charactersLimit: usage.charactersLimit,
          textLength: textLength,
          remaining: remaining,
          usagePercentage: usagePercentage,
          resetDate: new Date(usage.year, usage.month, 1) // Next month
        }
      });
    }

    // Add usage info to request
    req.usage = usage;
    req.textLength = textLength;

    next();
  } catch (error) {
    console.error('Check character limit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check character limit'
    });
  }
};

// Middleware to check if subscription allows multiple concurrent requests
const checkConcurrentRequests = async (req, res, next) => {
  try {
    // For now, we'll implement a simple check
    // In a production environment, you might use Redis to track active requests
    
    const VoiceFile = require('../models/VoiceFile');
    
    // Check if user has any processing files
    const processingFiles = await VoiceFile.countDocuments({
      user: req.user.id,
      status: 'processing'
    });

    // Basic plans might be limited to 1 concurrent request
    const maxConcurrentRequests = req.plan.features.maxConcurrentRequests || 5;

    if (processingFiles >= maxConcurrentRequests) {
      return res.status(429).json({
        success: false,
        error: 'Maximum concurrent requests reached. Please wait for current requests to complete.',
        code: 'CONCURRENT_LIMIT_EXCEEDED',
        data: {
          activeRequests: processingFiles,
          maxAllowed: maxConcurrentRequests
        }
      });
    }

    next();
  } catch (error) {
    console.error('Check concurrent requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check concurrent request limit'
    });
  }
};

module.exports = {
  checkSubscription,
  requirePlanFeature,
  checkCharacterLimit,
  checkConcurrentRequests
};
