/**
 * Notification Tracking Routes
 * 
 * These routes allow you to view:
 * - Notification statistics
 * - Who received which notifications
 * - Which controllers sent notifications
 * - Full audit trail of notifications
 */

const express = require('express');
const router = express.Router();
const { 
  getUserNotificationHistory,
  getNotificationSenders,
  getNotificationRecipients,
  getNotificationStats
} = require('../utils/notificationTracking');

/**
 * Middleware to check if user is SuperAdmin
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.userType !== 'SuperAdmin') {
    return res.status(403).json({
      status: 0,
      message: 'Unauthorized - SuperAdmin access required'
    });
  }
  next();
};

/**
 * GET /api/notification/tracking/stats
 * View overall notification statistics
 * SuperAdmin only
 */
router.get('/tracking/stats', isSuperAdmin, (req, res) => {
  try {
    const stats = getNotificationStats();
    
    res.status(200).json({
      status: 1,
      message: 'Notification statistics',
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      status: 0,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/notification/tracking/user/:userId/history
 * View all notifications sent to a specific user
 * SuperAdmin only or the user themselves
 */
router.get('/tracking/user/:userId/history', (req, res) => {
  try {
    // Allow user to view their own history or SuperAdmin to view anyone's
    if (req.user._id.toString() !== req.params.userId && req.user.userType !== 'SuperAdmin') {
      return res.status(403).json({
        status: 0,
        message: 'You can only view your own notification history'
      });
    }

    const history = getUserNotificationHistory(req.params.userId);
    
    res.status(200).json({
      status: 1,
      message: 'User notification history',
      userId: req.params.userId,
      totalNotifications: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({
      status: 0,
      message: 'Error fetching user history',
      error: error.message
    });
  }
});

/**
 * GET /api/notification/tracking/user/:userId/senders
 * View who sent notifications to a specific user
 * SuperAdmin only
 */
router.get('/tracking/user/:userId/senders', isSuperAdmin, (req, res) => {
  try {
    const senders = getNotificationSenders(req.params.userId);
    
    res.status(200).json({
      status: 1,
      message: 'Notification senders for user',
      userId: req.params.userId,
      senderCount: Object.keys(senders).length,
      data: senders
    });
  } catch (error) {
    console.error('Error fetching senders:', error);
    res.status(500).json({
      status: 0,
      message: 'Error fetching senders',
      error: error.message
    });
  }
});

/**
 * GET /api/notification/tracking/module/:module/:function/recipients
 * View all recipients of notifications from a specific controller function
 * SuperAdmin only
 */
router.get('/tracking/module/:module/:function/recipients', isSuperAdmin, (req, res) => {
  try {
    const { module, functionName } = req.params;
    const recipients = getNotificationRecipients(module, functionName);
    
    res.status(200).json({
      status: 1,
      message: 'Notification recipients',
      module: module,
      function: functionName,
      totalRecipients: recipients.length,
      data: recipients
    });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({
      status: 0,
      message: 'Error fetching recipients',
      error: error.message
    });
  }
});

/**
 * GET /api/notification/tracking/summary
 * Quick overview dashboard
 * SuperAdmin only
 */
router.get('/tracking/summary', isSuperAdmin, (req, res) => {
  try {
    const stats = getNotificationStats();
    
    // Calculate derived metrics
    const successRate = stats.totalNotifications > 0 
      ? ((stats.successCount / stats.totalNotifications) * 100).toFixed(2)
      : 0;
    
    const emailRate = stats.totalNotifications > 0
      ? ((stats.emailsSent / stats.totalNotifications) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      status: 1,
      message: 'Notification system summary',
      summary: {
        totalNotifications: stats.totalNotifications,
        successRate: `${successRate}%`,
        failureCount: stats.errorCount,
        emailsSent: stats.emailsSent,
        emailDeliveryRate: `${emailRate}%`,
        socketIoNotifications: stats.socketIoSent,
        topNotificationTypes: Object.entries(stats.byType || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        topSenderModules: Object.entries(stats.byModule || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([module, count]) => ({ module, count }))
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      status: 0,
      message: 'Error fetching summary',
      error: error.message
    });
  }
});

/**
 * GET /api/notification/tracking/debug
 * Debug route - returns all available tracking information
 * SuperAdmin only - use for troubleshooting
 */
router.get('/tracking/debug', isSuperAdmin, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(__dirname, '../logs/notifications.log');
    
    if (!fs.existsSync(logFile)) {
      return res.status(200).json({
        status: 1,
        message: 'No notification logs found yet',
        logsExist: false
      });
    }

    const logs = fs.readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(line => line !== null);

    res.status(200).json({
      status: 1,
      message: 'Debug notification logs',
      totalEntries: logs.length,
      latestEntries: logs.slice(-10).reverse(),  // Last 10 entries
      logFile: logFile
    });
  } catch (error) {
    console.error('Error reading debug logs:', error);
    res.status(500).json({
      status: 0,
      message: 'Error reading logs',
      error: error.message
    });
  }
});

/**
 * POST /api/notification/tracking/clear-logs
 * Clear all notification logs (dangerous - use with caution)
 * SuperAdmin only
 */
router.post('/tracking/clear-logs', isSuperAdmin, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, '../logs');
    const logFile = path.join(logsDir, 'notifications.log');
    
    if (fs.existsSync(logFile)) {
      // Backup old logs
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFile = path.join(logsDir, `notifications.log.backup.${timestamp}`);
      fs.renameSync(logFile, backupFile);
      
      res.status(200).json({
        status: 1,
        message: 'Logs cleared and backed up',
        backupFile: backupFile
      });
    } else {
      res.status(200).json({
        status: 1,
        message: 'No logs to clear'
      });
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      status: 0,
      message: 'Error clearing logs',
      error: error.message
    });
  }
});

module.exports = router;
