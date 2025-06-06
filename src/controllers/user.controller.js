"use strict";
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Usage = require('../models/Usage');
const VoiceFile = require('../models/VoiceFile');

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id)
      .populate({
        path: 'subscription',
        populate: {
          path: 'plan'
        }
      })
      .select('-password');

    if (!userDoc) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build a “safe” payload so that we can tack on daysRemaining
    let subscriptionData = null;
    if (userDoc.subscription) {
      const now = Date.now();
      const endTS = new Date(userDoc.subscription.endDate).getTime();
      const daysRemaining = Math.max(0, Math.ceil((endTS - now)/(1000*60*60*24)));

      subscriptionData = {
        _id: userDoc.subscription._id,
        status: userDoc.subscription.status,
        plan: {
          _id: userDoc.subscription.plan._id,
          name: userDoc.subscription.plan.name,
          features: userDoc.subscription.plan.features
          // (add any other plan‐fields you want front‐end to see)
        },
        startDate: userDoc.subscription.startDate,
        endDate: userDoc.subscription.endDate,
        daysRemaining
      };
    }

    // Build the final “user” object we send back
    const safeUser = {
      _id: userDoc._id,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      email: userDoc.email,
      phone: userDoc.phone,
      role: userDoc.role,
      subscription: subscriptionData
    };

    res.status(200).json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile'
    });
  }
};

// Update user profile

// Update user profile (now accepts firstName / lastName)
const updateProfile = async (req, res) => {
  try {
    // Only allow updating these two fields:
    const allowedUpdates = ['firstName', 'lastName'];
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
};



// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while changing password'
    });
  }
};

// Get user usage statistics
const getUsageStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Get current usage
    const usage = await Usage.findOne({
      user: req.user.id,
      month: targetMonth,
      year: targetYear
    });

    // Get user's subscription for limits
    const user = await User.findById(req.user.id).populate({
      path: 'subscription',
      populate: {
        path: 'plan'
      }
    });

    const stats = {
      month: targetMonth,
      year: targetYear,
      charactersUsed: usage ? usage.charactersUsed : 0,
      charactersLimit: user.subscription ? user.subscription.plan.features.charactersPerMonth : 0,
      requestsCount: usage ? usage.requestsCount : 0,
      audioFilesGenerated: usage ? usage.audioFilesGenerated : 0,
      totalAudioDuration: usage ? usage.totalAudioDuration : 0,
      remainingCharacters: usage ? usage.getRemainingCharacters() : (user.subscription ? user.subscription.plan.features.charactersPerMonth : 0),
      hasExceededLimit: usage ? usage.hasExceededLimit() : false,
      lastUsedAt: usage ? usage.lastUsedAt : null
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching usage statistics'
    });
  }
};


// Get user's voice files (with proper parseInt for page/limit)
const getVoiceFiles = async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page, 10) || 1;
    const limitNum = parseInt(req.query.limit, 10) || 10;
    const status = req.query.status;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    // Get voice files with pagination
    const voiceFiles = await VoiceFile.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await VoiceFile.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        voiceFiles,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get voice files error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching voice files'
    });
  }
};


// Delete voice file
const deleteVoiceFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const voiceFile = await VoiceFile.findOne({
      _id: fileId,
      user: req.user.id
    });

    if (!voiceFile) {
      return res.status(404).json({
        success: false,
        error: 'Voice file not found'
      });
    }

    // TODO: Delete file from S3 storage
    // const s3 = require('../config/s3');
    // await s3.deleteObject({ Bucket: process.env.S3_BUCKET, Key: voiceFile.s3Key }).promise();

    await VoiceFile.findByIdAndDelete(fileId);

    res.status(200).json({
      success: true,
      message: 'Voice file deleted successfully'
    });
  } catch (error) {
    console.error('Delete voice file error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting voice file'
    });
  }
};

// Delete user account
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Delete user's data
    await Promise.all([
      VoiceFile.deleteMany({ user: req.user.id }),
      Usage.deleteMany({ user: req.user.id }),
      Subscription.deleteMany({ user: req.user.id }),
      User.findByIdAndDelete(req.user.id)
    ]);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting account'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getUsageStats,
  getVoiceFiles,
  deleteVoiceFile,
  deleteAccount
};
