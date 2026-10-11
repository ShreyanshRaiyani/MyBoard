const Notification = require('../models/notification');
const User = require("../models/User");
const { notifyUser } = require('../middleware/socketHandler');
const {
  sendNotificationEmail,
  sendBookingNotificationEmail,
  sendWorkRequestNotificationEmail,
  sendPaymentNotificationEmail,
  sendSystemNotificationEmail
} = require('../middleware/emailNotificationService');

// 1. CREATE NOTIFICATION (Utility function for other controllers)
const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

// 2. SEND NOTIFICATION (Main function to be used by other controllers)
const sendNotification = async ({
  userId,
  title,
  message,
  type,
  relatedModel = null,
  relatedId = null,
  actionUrl = null,
  actionLabel = null,
  expiresInDays = 30,
  sendEmail = true,
  emailTemplate = 'bookingNotification',
  emailData = {},
  req = null
}) => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for notification`);
      return null;
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const notificationData = {
      user: userId,
      title,
      message,
      type,
      expiresAt,
      isRead: false,
      isDeleted: false
    };

    // Add related entity if provided
    if (relatedModel && relatedId) {
      notificationData.relatedTo = {
        model: relatedModel,
        id: relatedId
      };
    }

    // Add action if provided
    if (actionUrl) {
      notificationData.actionUrl = actionUrl;
    }
    if (actionLabel) {
      notificationData.actionLabel = actionLabel;
    }

    const notification = await createNotification(notificationData);

    // Send real-time Socket.io notification
    sendRealTimeNotification(userId, notification);

    // Send email notification (if enabled and email exists)
    if (sendEmail && user.email) {
      try {
        const emailPayload = {
          firstName: user.firstName || 'User',
          notificationTitle: title,
          notificationMessage: message,
          actionUrl,
          actionLabel,
          ...emailData
        };

        // Send email asynchronously (don't wait for it)
        sendNotificationEmail(
          user.email,
          emailTemplate,
          emailPayload,
          title,
          req
        ).catch(error => {
          console.error(`Failed to send email to ${user.email}:`, error.message);
        });

        console.log(`Email notification queued for user ${userId} at ${user.email}`);
      } catch (emailError) {
        console.error(`Error sending email notification:`, emailError.message);
        // Don't fail the notification if email fails
      }
    }

    return notification;
  } catch (error) {
    console.error("Send notification error:", error);
    return null;
  }
};

// 3. GET USER NOTIFICATIONS
const getUserNotifications = async (req, res) => {
  try {
    const {
      type,
      isRead,
      limit = 20,
      page = 1,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const query = {
      user: req.user.id,
      isDeleted: false
    };

    // Apply filters
    if (type) {
      query.type = type;
    }
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const notifications = await Notification.find(query)
      .populate({
        path: 'relatedTo.id',
        select: '_id requestNumber hoardingName campaignName firstName lastName'
      })
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      ...query,
      isRead: false
    });

    res.status(200).json({
      status: 1,
      count: notifications.length,
      total,
      unreadCount,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      notifications: notifications
    });
  } catch (error) {
    console.error("Get notifications error:", error);
     res.status(500).json({
      status: 0,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 4. GET UNREAD COUNT
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
      isDeleted: false
    });

    res.status(200).json({
      status: 1,
      unreadCount: count
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 5. MARK AS READ
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: req.user.id,
      isDeleted: false
    });

    if (!notification) {
      return res.status(404).json({
        status: 0,
        message: "Notification not found"
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({
      status: 1,
      message: "Notification marked as read",
      notification: notification
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 6. MARK ALL AS READ
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        user: req.user.id,
        isRead: false,
        isDeleted: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.status(200).json({
      status: 1,
      message: `Marked ${result.modifiedCount} notifications as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 7. DELETE NOTIFICATION
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      user: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        status: 0,
        message: "Notification not found"
      });
    }

    notification.isDeleted = true;
    await notification.save();

    res.status(200).json({
      status: 1,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 8. DELETE ALL NOTIFICATIONS
const deleteAllNotifications = async (req, res) => {
  try {
    const { type, isRead } = req.query;

    const query = {
      user: req.user.id
    };

    // Apply filters if provided
    if (type) {
      query.type = type;
    }
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const result = await Notification.updateMany(
      query,
      {
        $set: { isDeleted: true }
      }
    );

    res.status(200).json({
      status: 1,
      message: `Deleted ${result.modifiedCount} notifications`,
      deletedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Delete all notifications error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 9. GET NOTIFICATION BY ID
const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id,
      isDeleted: false
    }).populate({
      path: 'relatedTo.id',
      select: '_id requestNumber hoardingName campaignName firstName lastName'
    });

    if (!notification) {
      return res.status(404).json({
        status: 0,
        message: "Notification not found"
      });
    }

    // Mark as read when viewing
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({
      status: 1,
      notification: notification
    });
  } catch (error) {
    console.error("Get notification by ID error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 10. CREATE BULK NOTIFICATIONS (For system announcements)
const createBulkNotifications = async (req, res) => {
  try {
    // Only admin can send bulk notifications
    if (req.user.userType !== "SuperAdmin") {
      return res.status(403).json({
        status: 0,
        message: "Only admin can send bulk notifications"
      });
    }

    const {
      title,
      message,
      type = "system",
      userType, // Send to specific user type
      userIds, // Or specific user IDs
      actionUrl,
      actionLabel,
      expiresInDays = 30
    } = req.body;

    // Validate input
    if (!title || !message) {
      return res.status(400).json({
        status: 0,
        message: "Title and message are required"
      });
    }

    let targetUserIds = [];

    if (userIds && userIds.length > 0) {
      // Use provided user IDs
      targetUserIds = userIds;
    } else if (userType) {
      // Get users by type
      const users = await User.find({ userType, isActive: true }).select('_id');
      targetUserIds = users.map(user => user._id);
    } else {
      // Send to all active users
      const users = await User.find({ isActive: true }).select('_id');
      targetUserIds = users.map(user => user._id);
    }

    // Create notifications
    const notifications = [];
    const errors = [];

    for (const userId of targetUserIds) {
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const notificationData = {
          user: userId,
          title,
          message,
          type,
          expiresAt,
          isRead: false,
          isDeleted: false
        };

        if (actionUrl) notificationData.actionUrl = actionUrl;
        if (actionLabel) notificationData.actionLabel = actionLabel;

        notifications.push(notificationData);
      } catch (error) {
        errors.push({ userId, error: error.message });
      }
    }

    // Insert all notifications
    const result = await Notification.insertMany(notifications);

    // Send real-time notifications
    for (const notification of result) {
      sendRealTimeNotification(notification.user, notification);
    }

    res.status(201).json({
      status: 1,
      message: `Notifications sent to ${result.length} users`,
      sentCount: result.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Create bulk notifications error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 11. GET NOTIFICATION STATISTICS (Admin only)
const getNotificationStats = async (req, res) => {
  try {
    if (req.user.userType !== "SuperAdmin") {
      return res.status(403).json({
        status: 0,
        message: "Only admin can view notification statistics"
      });
    }

    const { startDate, endDate } = req.query;

    const matchStage = {
      isDeleted: false
    };

    // Date filter if provided
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Notification.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: "$type",
            isRead: "$isRead",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.type",
          total: { $sum: "$count" },
          read: {
            $sum: {
              $cond: [{ $eq: ["$_id.isRead", true] }, "$count", 0]
            }
          },
          unread: {
            $sum: {
              $cond: [{ $eq: ["$_id.isRead", false] }, "$count", 0]
            }
          },
          dailyStats: {
            $push: {
              date: "$_id.date",
              count: "$count",
              isRead: "$_id.isRead"
            }
          }
        }
      },
      {
        $project: {
          type: "$_id",
          total: 1,
          read: 1,
          unread: 1,
          readPercentage: {
            $multiply: [
              { $divide: ["$read", "$total"] },
              100
            ]
          },
          dailyStats: 1
        }
      }
    ]);

    // Get total counts
    const totalStats = await Notification.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: {
            $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] }
          },
          unread: {
            $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      status: 1,
      
        notification: stats,
        totals: totalStats[0] || { total: 0, read: 0, unread: 0 }
      
    });
  } catch (error) {
    console.error("Get notification stats error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// 12. UPDATE NOTIFICATION (Admin only)
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;

    // Only admin can update notifications
    if (req.user.userType !== "SuperAdmin") {
      return res.status(403).json({
        status: 0,
        message: "Only admin can update notifications"
      });
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        status: 0,
        message: "Notification not found"
      });
    }

    // Allowed fields to update
    const allowedUpdates = ['title', 'message', 'type', 'actionUrl', 'actionLabel', 'expiresAt'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 1,
      message: "Notification updated successfully",
      notification: updatedNotification
    });
  } catch (error) {
    console.error("Update notification error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error"
    });
  }
};

// HELPER FUNCTIONS

// Real-time notification sender (WebSocket implementation)
const sendRealTimeNotification = (userId, notification) => {
  // Use Socket.io to send real-time notification
  try {
    notifyUser(userId, 'new_notification', {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      timestamp: notification.createdAt,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      relatedTo: notification.relatedTo
    });
    console.log(`Real-time notification sent to user ${userId}:`, notification.title);
  } catch (error) {
    console.error('Error sending real-time notification:', error);
  }
};

// Predefined notification templates
const notificationTemplates = {
  // Booking Templates
  booking_request: (booking, hoarding) => ({
    title: "New Booking Request",
    message: `You have received a new booking request for ${hoarding?.hoardingName || 'your hoarding'} from ${booking?.bannerUser?.firstName || 'a user'}`,
    type: "booking_request",
    relatedModel: "Booking",
    relatedId: booking._id,
    actionUrl: `/bookings/${booking._id}`,
    actionLabel: "View Request"
  }),

  booking_approved: (booking, hoarding) => ({
    title: "Booking Approved",
    message: `Your booking request for ${hoarding?.hoardingName || 'the hoarding'} has been approved`,
    type: "booking_approved",
    relatedModel: "Booking",
    relatedId: booking._id,
    actionUrl: `/bookings/${booking._id}`,
    actionLabel: "View Booking"
  }),

  booking_rejected: (booking, hoarding, reason) => ({
    title: "Booking Rejected",
    message: `Your booking request for ${hoarding?.hoardingName || 'the hoarding'} was rejected${reason ? `: ${reason}` : ''}`,
    type: "booking_rejected",
    relatedModel: "Booking",
    relatedId: booking._id,
    actionUrl: `/bookings/${booking._id}`,
    actionLabel: "View Details"
  }),

  booking_cancelled: (booking) => ({
    title: "Booking Cancelled",
    message: `Booking ${booking?.requestNumber || ''} has been cancelled`,
    type: "booking_cancelled",
    relatedModel: "Booking",
    relatedId: booking._id,
    actionUrl: `/bookings/${booking._id}`,
    actionLabel: "View Details"
  }),

  // Queue Templates
  queue_joined: (booking, position, hoarding) => ({
        title: "Added to Queue",
        message: `Your booking request has been added to queue for ${hoarding?.hoardingName || 'the hoarding'}. Position: ${position}`,
        type: "queue_joined",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "View Booking"
    }),
    
    queue_position_updated: (booking, newPosition, hoarding) => ({
        title: "Queue Position Updated",
        message: `Your queue position for ${hoarding?.hoardingName || 'the hoarding'} is now #${newPosition}`,
        type: "queue_position_updated",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "View Position"
    }),
    
    queue_next: (booking, hoarding) => ({
        title: "You're Next in Queue",
        message: `Your booking for ${hoarding?.hoardingName || 'the hoarding'} is now next in line`,
        type: "queue_next",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "View Booking"
    }),
    
    queue_advanced_to_current: (booking, hoarding) => ({
        title: "Booking Ready for Review",
        message: `Your booking request for ${hoarding?.hoardingName || 'the hoarding'} is now ready for owner approval`,
        type: "queue_advanced_to_current",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "View Booking"
    }),

    booking_pending_review: (booking, hoarding) => ({
        title: "New Booking Ready for Review",
        message: `A booking request for ${hoarding?.hoardingName || 'your hoarding'} is ready for your review`,
        type: "booking_pending_review",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "Review Booking"
    }),

    // Payment Templates
    payment: (booking, amount, status) => ({
        title: `Payment ${status}`,
        message: `Payment of ₹${amount} for booking ${booking?.requestNumber || ''} has been ${status.toLowerCase()}`,
        type: status === "Completed" ? "payment_confirmation" : "payment_received",
        relatedModel: "Booking",
        relatedId: booking.id,
        actionUrl: booking.url,
        actionLabel: "View Payment"
    }),

  // Worker Templates
  worker_request: (workRequest, worker) => ({
    title: "New Work Request",
    message: `You have received a work request from ${workRequest.bannerUser.firstName}`,
    type: "worker_request",
    relatedModel: "WorkRequest",
    relatedId: workRequest._id,
    actionUrl: `/work-requests/${workRequest._id}`,
    actionLabel: "Respond to Request"
  }),

  worker_approved: (workRequest) => ({
    title: "Work Request Accepted",
    message: `Your work request has been accepted by the worker`,
    type: "worker_approved",
    relatedModel: "WorkRequest",
    relatedId: workRequest._id,
    actionUrl: `/work-requests/${workRequest._id}`,
    actionLabel: "View Details"
  }),

  worker_rejected: (workRequest, reason) => ({
    title: "Work Request Rejected",
    message: `Your work request has been rejected${reason ? `: ${reason}` : ''}`,
    type: "worker_rejected",
    relatedModel: "WorkRequest",
    relatedId: workRequest._id,
    actionUrl: `/work-requests/${workRequest._id}`,
    actionLabel: "Select New Worker"
  }),

  // payment: (entity, amount, type) => ({
  //   title: `Payment ${type}`,
  //   message: `Payment of ₹${amount} ${type.toLowerCase()} successfully`,
  //   type: "payment",
  //   relatedModel: entity.model,
  //   relatedId: entity.id,
  //   actionUrl: entity.url,
  //   actionLabel: "View Receipt"
  // }),

  system: (title, message) => ({
    title,
    message,
    type: "system"
  })
};

// Export everything
module.exports = {
  // Utility functions for other controllers
  sendNotification,
  createNotification,
  notificationTemplates,

  // API endpoints
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getNotificationById,
  createBulkNotifications,
  getNotificationStats,
  updateNotification
};