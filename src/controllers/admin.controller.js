"use strict";
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Usage = require('../models/Usage');
const VoiceFile = require('../models/VoiceFile');
const storageService = require('../services/storageService');
const emailService = require('../services/emailService');

// Get all users with pagination and filters
const getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      role, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Apply filters
    if (status) {
      if (status === 'active') {
        query.isEmailVerified = true;
      } else if (status === 'inactive') {
        query.isEmailVerified = false;
      }
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .populate('subscription')
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

// Get specific user details
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate({
        path: 'subscription',
        populate: {
          path: 'plan'
        }
      })
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's usage statistics
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const usage = await Usage.findOne({
      user: userId,
      month: currentMonth,
      year: currentYear
    });

    // Get user's files
    const files = await VoiceFile.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get storage usage
    const storageUsage = await storageService.getUserStorageUsage(userId);

    res.status(200).json({
      success: true,
      data: {
        user,
        usage: usage || {
          charactersUsed: 0,
          charactersLimit: user.subscription ? user.subscription.plan.features.charactersPerMonth : 0,
          requestsCount: 0,
          audioFilesGenerated: 0
        },
        recentFiles: files,
        storageUsage
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
};

// Update user (admin can change role, status, etc.)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Only allow specific fields to be updated by admin
    const allowedUpdates = ['name', 'role', 'isEmailVerified'];
    const filteredUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      filteredUpdates,
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
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
};

// Delete user and all associated data
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's files for deletion from S3
    const userFiles = await VoiceFile.find({ user: userId });
    const s3Keys = userFiles.map(file => file.s3Key);

    // Delete user's data in order
    await Promise.all([
      VoiceFile.deleteMany({ user: userId }),
      Usage.deleteMany({ user: userId }),
      Subscription.deleteMany({ user: userId })
    ]);

    // Delete files from S3
    if (s3Keys.length > 0) {
      try {
        await storageService.deleteMultipleFiles(s3Keys);
      } catch (s3Error) {
        console.error('Error deleting S3 files:', s3Error);
        // Continue with user deletion even if S3 deletion fails
      }
    }

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};

// Get pending subscriptions for approval
const getPendingSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const subscriptions = await Subscription.find({ status: 'pending' })
      .populate('user', 'name email')
      .populate('plan', 'name price duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Subscription.countDocuments({ status: 'pending' });

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get pending subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending subscriptions'
    });
  }
};

// Approve subscription
const approveSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { approved, notes } = req.body;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('user')
      .populate('plan');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not pending approval'
      });
    }

    if (approved) {
      // Approve subscription
      const startDate = new Date();
      let endDate = new Date();

      switch (subscription.plan.duration) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        case 'lifetime':
          endDate.setFullYear(endDate.getFullYear() + 100);
          break;
        default:
          endDate.setMonth(endDate.getMonth() + 1);
      }

      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.lastPaymentDate = startDate;

      // Cancel any other active subscriptions for this user
      await Subscription.updateMany(
        { 
          user: subscription.user._id, 
          _id: { $ne: subscriptionId },
          status: 'active'
        },
        { status: 'cancelled' }
      );

      // Update user's subscription reference
      await User.findByIdAndUpdate(subscription.user._id, {
        subscription: subscriptionId
      });

      // Send approval email
      try {
        await emailService.sendSubscriptionApprovalEmail(
          subscription.user.email,
          subscription.user.name,
          subscription.plan.name,
          endDate
        );
      } catch (emailError) {
        console.error('Error sending approval email:', emailError);
        // Continue even if email fails
      }
    } else {
      // Reject subscription
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.cancelReason = notes || 'Payment not verified';
    }

    await subscription.save();

    res.status(200).json({
      success: true,
      message: approved ? 'Subscription approved successfully' : 'Subscription rejected',
      data: subscription
    });
  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process subscription approval'
    });
  }
};

// Get system usage statistics
const getUsageStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        break;
      case 'week':
        startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    }

    // Get aggregated statistics
    const stats = await Promise.all([
      // Total users
      User.countDocuments(),
      
      // Active users (verified email)
      User.countDocuments({ isEmailVerified: true }),
      
      // Total subscriptions
      Subscription.countDocuments({ status: 'active' }),
      
      // Pending subscriptions
      Subscription.countDocuments({ status: 'pending' }),
      
      // Total files generated
      VoiceFile.countDocuments(),
      
      // Files generated in period
      VoiceFile.countDocuments({ createdAt: { $gte: startDate } }),
      
      // Total characters processed
      Usage.aggregate([
        { $group: { _id: null, total: { $sum: '$charactersUsed' } } }
      ]),
      
      // Characters processed in period
      Usage.aggregate([
        { $match: { lastUsedAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$charactersUsed' } } }
      ])
    ]);

    const [
      totalUsers,
      activeUsers,
      activeSubscriptions,
      pendingSubscriptions,
      totalFiles,
      periodFiles,
      totalCharactersResult,
      periodCharactersResult
    ] = stats;

    const totalCharacters = totalCharactersResult[0]?.total || 0;
    const periodCharacters = periodCharactersResult[0]?.total || 0;

    // Get plan distribution
    const planStats = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'plans', localField: 'plan', foreignField: '_id', as: 'planInfo' } },
      { $unwind: '$planInfo' },
      { $group: { _id: '$planInfo.name', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          activeSubscriptions,
          pendingSubscriptions,
          totalFiles,
          totalCharacters
        },
        period: {
          name: period,
          startDate,
          filesGenerated: periodFiles,
          charactersProcessed: periodCharacters
        },
        planDistribution: planStats
      }
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics'
    });
  }
};

// Get all subscriptions with filters
const getAllSubscriptions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      planId,
      userId 
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (status) query.status = status;
    if (planId) query.plan = planId;
    if (userId) query.user = userId;

    const subscriptions = await Subscription.find(query)
      .populate('user', 'name email')
      .populate('plan', 'name price duration')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Subscription.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions'
    });
  }
};

// Get payment proof for admin review
const getPaymentProof = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('user', 'firstName lastName email')
      .populate('plan', 'name price currency');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    if (!subscription.paymentProofKey) {
      return res.status(404).json({
        success: false,
        error: 'No payment proof found for this subscription'
      });
    }

    try {
      // Generate presigned URL for admin to view payment proof
      const viewUrl = storageService.generatePresignedUrl(subscription.paymentProofKey, 3600); // 1 hour expiry

      res.status(200).json({
        success: true,
        data: {
          subscription: {
            id: subscription._id,
            user: subscription.user,
            plan: subscription.plan,
            paymentAmount: subscription.paymentAmount,
            paymentCurrency: subscription.paymentCurrency,
            createdAt: subscription.createdAt,
            status: subscription.status
          },
          paymentProof: {
            viewUrl,
            expiresIn: 3600
          }
        }
      });

    } catch (error) {
      console.error('Error generating payment proof URL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate payment proof URL'
      });
    }

  } catch (error) {
    console.error('Get payment proof error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment proof'
    });
  }
};

// Update subscription status and details
const updateSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { status, adminNotes, endDate } = req.body;

    const subscription = await Subscription.findById(subscriptionId)
      .populate('user')
      .populate('plan');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Update allowed fields
    if (status) subscription.status = status;
    if (adminNotes) subscription.adminNotes = adminNotes;
    if (endDate) subscription.endDate = new Date(endDate);

    // Track who made the changes
    if (status === 'active') {
      subscription.approvedBy = req.user.id;
      subscription.approvedAt = new Date();
    } else if (status === 'cancelled') {
      subscription.rejectedBy = req.user.id;
      subscription.rejectedAt = new Date();
      subscription.cancelledAt = new Date();
    }

    await subscription.save();

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription'
    });
  }
};

// Clean up expired files manually
const cleanupExpiredFiles = async (req, res) => {
  try {
    const { daysOld = 90 } = req.body;

    const result = await storageService.cleanupExpiredFiles(daysOld);

    res.status(200).json({
      success: true,
      message: `Cleanup completed. ${result.deletedCount} files removed.`,
      data: {
        deletedCount: result.deletedCount,
        errors: result.errors
      }
    });

  } catch (error) {
    console.error('Cleanup expired files error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup expired files'
    });
  }
};

// Get system health and status
const getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'connected',
        storage: 'connected',
        email: 'connected',
        tts: 'connected'
      },
      metrics: {}
    };

    // Test database connection
    try {
      await User.findOne().limit(1);
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    // Test storage service
    try {
      await storageService.getUserStorageUsage('test');
      health.services.storage = 'connected';
    } catch (error) {
      health.services.storage = 'error';
      health.status = 'degraded';
    }

    // Get basic metrics
    const [totalUsers, activeSubscriptions, pendingSubscriptions] = await Promise.all([
      User.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'pending' })
    ]);

    health.metrics = {
      totalUsers,
      activeSubscriptions,
      pendingSubscriptions
    };

    res.status(200).json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    });
  }
};

module.exports = {
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
};
