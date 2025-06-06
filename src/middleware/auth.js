"use strict";
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authorized, user not found'
        });
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token'
    });
  }
};

// Admin only access
const admin = (req, res, next) => {
  if (req.user && ['admin', 'super_admin', 'finance_admin', 'manager'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
};

// Check if user has active subscription
const checkSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'subscription',
      populate: {
        path: 'plan'
      }
    });

    if (!user.subscription || user.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Active subscription required'
      });
    }

    // Check if subscription has expired
    if (user.subscription.endDate < new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Subscription has expired'
      });
    }

    req.user.subscription = user.subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during subscription verification'
    });
  }
};

module.exports = {
  protect,
  admin,
  checkSubscription
};
