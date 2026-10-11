/**
 * Notification Tracking & Logging System
 * 
 * Tracks:
 * - Who initiated the notification (module, function, user)
 * - Who received it (recipient userId)
 * - Delivery status (Socket.io + Email)
 * - Timestamps
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log notification activity to file and console
 */
const logNotification = (notificationData) => {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    type: 'NOTIFICATION',
    sender: {
      module: notificationData.senderModule,      // e.g., 'bookingController'
      function: notificationData.senderFunction,  // e.g., 'approveBooking'
      userId: notificationData.senderId           // Admin/User who triggered it
    },
    recipient: {
      userId: notificationData.recipientId,
      email: notificationData.recipientEmail
    },
    notification: {
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      relatedModel: notificationData.relatedModel,
      relatedId: notificationData.relatedId
    },
    delivery: {
      socketIo: notificationData.socketIoSent || false,
      email: notificationData.emailSent || false,
      emailTemplate: notificationData.emailTemplate
    },
    details: notificationData.details  // Any additional info
  };

  // Log to console
  console.log('\n========== NOTIFICATION SENT ==========');
  console.log(`[${timestamp}]`);
  console.log(`From: ${notificationData.senderModule}.${notificationData.senderFunction}`);
  console.log(`From User: ${notificationData.senderId || 'SYSTEM'}`);
  console.log(`To User: ${notificationData.recipientId}`);
  console.log(`Title: ${notificationData.title}`);
  console.log(`Socket.io: ${notificationData.socketIoSent ? '✅' : '❌'}`);
  console.log(`Email: ${notificationData.emailSent ? '✅' : '❌'}`);
  console.log('=========================================\n');

  // Log to file
  const logFile = path.join(logsDir, 'notifications.log');
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

  return logEntry;
};

/**
 * Enhanced sendNotification with tracking
 * This wraps the original sendNotification function
 */
const sendNotificationWithTracking = async (notificationConfig, trackingData) => {
  const {
    userId: recipientId,
    title,
    message,
    type,
    sendEmail = true,
    emailTemplate = 'bookingNotification',
    emailData = {},
    req = null,
    // ... other original params
  } = notificationConfig;

  const {
    senderModule,      // e.g., 'bookingController'
    senderFunction,    // e.g., 'approveBooking'
    senderId = null,   // User who triggered the action
    relatedModel = null,
    relatedId = null,
    actionUrl = null,
    actionLabel = null,
    expiresInDays = 30,
    additionalDetails = {}
  } = trackingData;

  try {
    // Get recipient details
    const User = require('../models/User');
    const user = await User.findById(recipientId);

    if (!user) {
      console.error(`User ${recipientId} not found`);
      return null;
    }

    // Log the notification start
    const logEntry = logNotification({
      senderModule,
      senderFunction,
      senderId,
      recipientId,
      recipientEmail: user.email,
      title,
      message,
      type,
      relatedModel,
      relatedId,
      emailTemplate,
      socketIoSent: false,
      emailSent: false,
      details: additionalDetails
    });

    // Call original sendNotification
    const { sendNotification } = require('../Controllers/notificationController');
    
    const notification = await sendNotification({
      userId: recipientId,
      title,
      message,
      type,
      relatedModel,
      relatedId,
      actionUrl,
      actionLabel,
      expiresInDays,
      sendEmail,
      emailTemplate,
      emailData,
      req
    });

    if (notification) {
      // Update log with success status
      logEntry.socketIoSent = true;
      logEntry.emailSent = sendEmail;
      logEntry.notificationId = notification._id;

      // Append update to log
      const logFile = path.join(logsDir, 'notifications.log');
      fs.appendFileSync(logFile, JSON.stringify({
        ...logEntry,
        status: 'SUCCESS'
      }) + '\n');

      console.log(`✅ Notification logged: ${notification._id}`);
    }

    return notification;
  } catch (error) {
    console.error('Error in sendNotificationWithTracking:', error.message);
    
    // Log error
    const logFile = path.join(logsDir, 'notifications.log');
    fs.appendFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      error: error.message,
      senderModule,
      senderFunction,
      recipientId
    }) + '\n');

    return null;
  }
};

/**
 * Get notification history for a specific user
 */
const getUserNotificationHistory = (userId) => {
  try {
    const logFile = path.join(logsDir, 'notifications.log');
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(entry => entry.recipient?.userId === userId);

    return logs;
  } catch (error) {
    console.error('Error reading notification history:', error.message);
    return [];
  }
};

/**
 * Get who sent notifications to a user
 */
const getNotificationSenders = (recipientUserId) => {
  const history = getUserNotificationHistory(recipientUserId);
  
  const senders = {};
  history.forEach(entry => {
    const senderKey = `${entry.sender?.module}.${entry.sender?.function}`;
    if (!senders[senderKey]) {
      senders[senderKey] = {
        module: entry.sender?.module,
        function: entry.sender?.function,
        count: 0,
        details: []
      };
    }
    senders[senderKey].count++;
    senders[senderKey].details.push({
      timestamp: entry.timestamp,
      title: entry.notification?.title,
      type: entry.notification?.type
    });
  });

  return senders;
};

/**
 * Get all recipients of notification from a specific action
 */
const getNotificationRecipients = (senderModule, senderFunction) => {
  try {
    const logFile = path.join(logsDir, 'notifications.log');
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(entry => 
        entry.sender?.module === senderModule && 
        entry.sender?.function === senderFunction
      );

    return logs;
  } catch (error) {
    console.error('Error reading recipients:', error.message);
    return [];
  }
};

/**
 * Get notification statistics
 */
const getNotificationStats = () => {
  try {
    const logFile = path.join(logsDir, 'notifications.log');
    
    if (!fs.existsSync(logFile)) {
      return {
        totalNotifications: 0,
        successCount: 0,
        errorCount: 0,
        emailsSent: 0,
        socketIoSent: 0
      };
    }

    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const stats = {
      totalNotifications: logs.length,
      successCount: logs.filter(l => l.status === 'SUCCESS').length,
      errorCount: logs.filter(l => l.status === 'ERROR').length,
      emailsSent: logs.filter(l => l.delivery?.email).length,
      socketIoSent: logs.filter(l => l.delivery?.socketIo).length,
      byType: {},
      byModule: {}
    };

    logs.forEach(log => {
      // Count by notification type
      if (log.notification?.type) {
        stats.byType[log.notification.type] = (stats.byType[log.notification.type] || 0) + 1;
      }

      // Count by sender module
      if (log.sender?.module) {
        stats.byModule[log.sender.module] = (stats.byModule[log.sender.module] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error calculating stats:', error.message);
    return {};
  }
};

module.exports = {
  logNotification,
  sendNotificationWithTracking,
  getUserNotificationHistory,
  getNotificationSenders,
  getNotificationRecipients,
  getNotificationStats
};
