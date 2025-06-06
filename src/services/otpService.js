"use strict";
const crypto = require('crypto');
const OTP = require('../models/OTP');

class OTPService {
  constructor() {
    this.otpLength = 6;
    this.defaultExpiryMinutes = 10;
    this.maxAttempts = 5;
    this.rateLimitWindow = 5; // minutes
  }

  generateNumericOTP(length = this.otpLength) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  generateSecureOTP(length = this.otpLength) {
    try {
      const buffer = crypto.randomBytes(Math.ceil(length / 2));
      const otp = parseInt(buffer.toString('hex'), 16) % Math.pow(10, length);
      return otp.toString().padStart(length, '0');
    } catch (error) {
      console.error('Error generating secure OTP:', error);
      // Fallback to numeric generation
      return this.generateNumericOTP(length).toString();
    }
  }

  async createOTP(email, type, expiryMinutes = this.defaultExpiryMinutes) {
    try {
      // Delete any existing OTPs for this email and type
      await OTP.deleteMany({ email: email.toLowerCase(), type });

      // Generate new OTP
      const otpCode = this.generateSecureOTP();
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Create new OTP record
      const otp = new OTP({
        email: email.toLowerCase(),
        otp: otpCode,
        type,
        expiresAt
      });

      await otp.save();
      
      console.log(`OTP created for ${email} (${type}): ${otpCode}`);
      return otpCode;
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw new Error('Failed to create OTP');
    }
  }

  async verifyOTP(email, otpCode, type) {
    try {
      const otp = await OTP.findOne({
        email: email.toLowerCase(),
        otp: otpCode,
        type,
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!otp) {
        return {
          success: false,
          message: 'Invalid or expired OTP',
          code: 'INVALID_OTP'
        };
      }

      // Mark OTP as used
      otp.isUsed = true;
      await otp.save();

      console.log(`OTP verified successfully for ${email} (${type})`);
      return {
        success: true,
        message: 'OTP verified successfully',
        code: 'OTP_VERIFIED'
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  async checkRateLimit(email, type, maxAttempts = 3, windowMinutes = this.rateLimitWindow) {
    try {
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
      
      const recentOTPs = await OTP.countDocuments({
        email: email.toLowerCase(),
        type,
        createdAt: { $gte: windowStart }
      });

      const remaining = Math.max(0, maxAttempts - recentOTPs);
      const resetTime = new Date(Date.now() + windowMinutes * 60 * 1000);

      return {
        allowed: recentOTPs < maxAttempts,
        remaining,
        resetTime,
        windowMinutes
      };
    } catch (error) {
      console.error('Error checking OTP rate limit:', error);
      // Allow request if we can't check rate limit
      return { 
        allowed: true, 
        remaining: maxAttempts,
        resetTime: new Date(Date.now() + windowMinutes * 60 * 1000)
      };
    }
  }

  async checkVerificationAttempts(email, type, maxAttempts = this.maxAttempts) {
    try {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour window
      
      // Count failed verification attempts (we can track this by looking at used OTPs)
      const recentAttempts = await OTP.countDocuments({
        email: email.toLowerCase(),
        type,
        createdAt: { $gte: windowStart }
      });

      return {
        allowed: recentAttempts < maxAttempts,
        remaining: Math.max(0, maxAttempts - recentAttempts),
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error checking verification attempts:', error);
      return { allowed: true, remaining: maxAttempts };
    }
  }

  async cleanupExpiredOTPs() {
    try {
      const result = await OTP.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isUsed: true, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Delete used OTPs older than 24 hours
        ]
      });

      console.log(`Cleaned up ${result.deletedCount} expired/used OTPs`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up OTPs:', error);
      throw new Error('Failed to cleanup expired OTPs');
    }
  }

  async getOTPStats(email = null, type = null) {
    try {
      const query = {};
      if (email) query.email = email.toLowerCase();
      if (type) query.type = type;

      const stats = await OTP.aggregate([
        { $match: query },
        {
          $group: {
            _id: { type: '$type', isUsed: '$isUsed' },
            count: { $sum: 1 }
          }
        }
      ]);

      return stats.reduce((acc, stat) => {
        const key = `${stat._id.type}_${stat._id.isUsed ? 'used' : 'unused'}`;
        acc[key] = stat.count;
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting OTP stats:', error);
      throw new Error('Failed to get OTP statistics');
    }
  }

  async resendOTP(email, type) {
    try {
      // Check rate limit first
      const rateLimit = await this.checkRateLimit(email, type);
      if (!rateLimit.allowed) {
        return {
          success: false,
          message: `Too many OTP requests. Please try again after ${rateLimit.windowMinutes} minutes.`,
          code: 'RATE_LIMITED',
          resetTime: rateLimit.resetTime
        };
      }

      // Create new OTP
      const otpCode = await this.createOTP(email, type);
      
      return {
        success: true,
        message: 'New OTP sent successfully',
        code: 'OTP_SENT',
        otp: otpCode // In production, don't return the actual OTP
      };
    } catch (error) {
      console.error('Error resending OTP:', error);
      throw new Error('Failed to resend OTP');
    }
  }

  validateOTPFormat(otp) {
    // Check if OTP is exactly 6 digits
    const otpRegex = /^\d{6}$/;
    return otpRegex.test(otp);
  }

  async invalidateAllOTPs(email, type = null) {
    try {
      const query = { email: email.toLowerCase() };
      if (type) query.type = type;

      const result = await OTP.updateMany(
        query,
        { isUsed: true }
      );

      console.log(`Invalidated ${result.modifiedCount} OTPs for ${email}`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error invalidating OTPs:', error);
      throw new Error('Failed to invalidate OTPs');
    }
  }

  // Utility method to get OTP types
  getOTPTypes() {
    return {
      EMAIL_VERIFICATION: 'email_verification',
      PASSWORD_RESET: 'password_reset',
      TWO_FACTOR: 'two_factor',
      PHONE_VERIFICATION: 'phone_verification'
    };
  }

  // Method to schedule cleanup (can be called by a cron job)
  scheduleCleanup(intervalMinutes = 60) {
    setInterval(async () => {
      try {
        await this.cleanupExpiredOTPs();
      } catch (error) {
        console.error('Scheduled OTP cleanup failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

module.exports = new OTPService();
