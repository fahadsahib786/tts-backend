"use strict";
const crypto = require('crypto');
const OTP = require('../models/OTP');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a secure random OTP using crypto
const generateSecureOTP = () => {
  const buffer = crypto.randomBytes(3);
  const otp = parseInt(buffer.toString('hex'), 16) % 1000000;
  return otp.toString().padStart(6, '0');
};

// Create and save OTP to database
const createOTP = async (email, type) => {
  try {
    // Delete any existing OTPs for this email and type
    await OTP.deleteMany({ email, type });

    // Generate new OTP
    const otpCode = generateSecureOTP();

    // Create new OTP record
    const otp = new OTP({
      email,
      otp: otpCode,
      type,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    await otp.save();
    return otpCode;
  } catch (error) {
    console.error('Error creating OTP:', error);
    throw new Error('Failed to create OTP');
  }
};

// Verify OTP
const verifyOTP = async (email, otpCode, type) => {
  try {
    const otp = await OTP.findOne({
      email,
      otp: otpCode,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otp) {
      return {
        success: false,
        message: 'Invalid or expired OTP'
      };
    }

    // Mark OTP as used
    otp.isUsed = true;
    await otp.save();

    return {
      success: true,
      message: 'OTP verified successfully'
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new Error('Failed to verify OTP');
  }
};

// Clean up expired OTPs (can be called periodically)
const cleanupExpiredOTPs = async () => {
  try {
    const result = await OTP.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isUsed: true }
      ]
    });
    console.log(`Cleaned up ${result.deletedCount} expired/used OTPs`);
  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
  }
};

// Check if user has too many OTP requests
const checkOTPRateLimit = async (email, type, maxAttempts = 3, windowMinutes = 5) => {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const recentOTPs = await OTP.countDocuments({
      email,
      type,
      createdAt: { $gte: windowStart }
    });

    return {
      allowed: recentOTPs < maxAttempts,
      remaining: Math.max(0, maxAttempts - recentOTPs),
      resetTime: new Date(Date.now() + windowMinutes * 60 * 1000)
    };
  } catch (error) {
    console.error('Error checking OTP rate limit:', error);
    return { allowed: true, remaining: maxAttempts };
  }
};

module.exports = {
  generateOTP,
  generateSecureOTP,
  createOTP,
  verifyOTP,
  cleanupExpiredOTPs,
  checkOTPRateLimit
};
