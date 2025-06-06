"use strict";
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const storageService = require('../services/storageService');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// Get all active plans
const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 });

    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
};

// Get single plan by ID
const getPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan'
    });
  }
};

// Subscribe to a plan
const subscribeToPlan = async (req, res) => {
  try {
    const { planId, paymentMethod = 'manual' } = req.body;

    // Check if plan exists
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found or inactive'
      });
    }

    // Check if user already has an active or pending subscription
    const existingSubscription = await Subscription.findOne({
      user: req.user.id,
      status: { $in: ['active', 'pending'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active or pending subscription'
      });
    }

    // Calculate end date based on plan duration
    const startDate = new Date();
    let endDate = new Date();

    switch (plan.duration) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'lifetime':
        endDate.setFullYear(endDate.getFullYear() + 100); // 100 years for lifetime
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create subscription with pending status for manual payment
    const subscription = new Subscription({
      user: req.user.id,
      plan: planId,
      startDate,
      endDate,
      paymentMethod,
      paymentAmount: plan.price,
      paymentCurrency: plan.currency,
      status: paymentMethod === 'manual' ? 'pending' : 'active'
    });

    await subscription.save();

    // Update user's subscription reference if payment method is not manual
    if (paymentMethod !== 'manual') {
      await User.findByIdAndUpdate(req.user.id, {
        subscription: subscription._id
      });
    }

    // Populate plan details
    await subscription.populate('plan');

    // Prepare response based on payment method
    let responseMessage = 'Subscription created successfully';
    let paymentInstructions = null;

    if (paymentMethod === 'manual') {
      responseMessage = 'Subscription created. Please upload payment proof to activate.';
      paymentInstructions = {
        amount: plan.price,
        currency: plan.currency,
        bankDetails: {
          accountName: 'TTS Platform Ltd',
          accountNumber: '1234567890',
          bankName: 'Example Bank',
          routingNumber: '123456789',
          swiftCode: 'EXAMPLEXXX'
        },
        instructions: [
          `Transfer ${plan.currency} ${plan.price} to the above account`,
          'Include your subscription ID in the transfer reference',
          'Upload payment proof using the upload endpoint',
          'Your subscription will be activated after admin approval'
        ],
        subscriptionId: subscription._id
      };
    }

    res.status(201).json({
      success: true,
      message: responseMessage,
      data: {
        subscription,
        paymentInstructions
      }
    });

  } catch (error) {
    console.error('Subscribe to plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user.id,
      status: 'active'
    }).populate('plan');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found'
      });
    }

    // Update subscription status
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancelReason = req.body.reason || 'User requested cancellation';
    subscription.autoRenew = false;

    await subscription.save();

    // Remove subscription reference from user
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { subscription: 1 }
    });

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        cancelledAt: subscription.cancelledAt,
        endDate: subscription.endDate // User can still use until end date
      }
    });

    // TODO: Cancel subscription with payment processor
    // This would involve calling the payment processor's API to cancel recurring payments

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
};

// Get user's subscription details
const getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user.id
    }).populate('plan').sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24)));

    const subscriptionData = {
      ...subscription.toObject(),
      daysRemaining,
      isExpired: subscription.endDate < now,
      isActive: subscription.status === 'active' && subscription.endDate > now
    };

    res.status(200).json({
      success: true,
      data: subscriptionData
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription details'
    });
  }
};

// Admin: Create new plan
const createPlan = async (req, res) => {
  try {
    const planData = req.body;

    const plan = new Plan(planData);
    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create plan'
    });
  }
};

// Admin: Update plan
const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updates = req.body;

    const plan = await Plan.findByIdAndUpdate(
      planId,
      updates,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update plan'
    });
  }
};

// Admin: Delete plan
const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    // Check if plan has active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({
      plan: planId,
      status: 'active'
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete plan with active subscriptions'
      });
    }

    const plan = await Plan.findByIdAndDelete(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete plan'
    });
  }
};

// Upload payment proof for manual payment
const uploadPaymentProof = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Check if subscription exists and belongs to user
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      user: req.user.id,
      status: 'pending',
      paymentMethod: 'manual'
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Pending subscription not found or not eligible for payment proof upload'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Payment proof file is required'
      });
    }

    try {
      // Upload file to S3
      const uploadResult = await storageService.uploadPaymentProof(
        req.file.buffer,
        req.user.id,
        req.file.originalname,
        req.file.mimetype
      );

      // Update subscription with payment proof details
      subscription.paymentProofUrl = uploadResult.location;
      subscription.paymentProofKey = uploadResult.key;
      await subscription.save();

      res.status(200).json({
        success: true,
        message: 'Payment proof uploaded successfully. Awaiting admin approval.',
        data: {
          subscriptionId: subscription._id,
          uploadedAt: new Date(),
          status: subscription.status
        }
      });

    } catch (uploadError) {
      console.error('File upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload payment proof'
      });
    }

  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment proof upload'
    });
  }
};

// Get payment proof URL for viewing
const getPaymentProof = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    // Check if subscription exists and belongs to user
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      user: req.user.id
    });

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
      // Generate presigned URL for viewing
      const viewUrl = storageService.generatePresignedUrl(subscription.paymentProofKey, 3600); // 1 hour expiry

      res.status(200).json({
        success: true,
        data: {
          viewUrl,
          expiresIn: 3600
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

module.exports = {
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
  upload // Export multer middleware
};
