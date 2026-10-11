/**
 * EXAMPLE: How to Send Notifications from Controllers
 * This file shows practical examples of sending notifications using Socket.io
 */

/**
 * EXAMPLE 1: Send notification in Booking Controller
 */
const sendBookingNotification = async (booking, hoarding, owner) => {
    const { sendNotification, notificationTemplates } = require('../Controllers/notificationController');
    
    try {
        // Send notification to hoarding owner
        await sendNotification({
            userId: owner._id,
            ...notificationTemplates.booking_request(booking, hoarding)
        });
        
        console.log(`Notification sent to owner ${owner._id}`);
    } catch (error) {
        console.error('Error sending booking notification:', error);
    }
};

/**
 * EXAMPLE 2: Notify Multiple Users
 */
const notifyMultipleUsers = async (userIds, title, message, type) => {
    const { notifyMultipleUsers: notifyUsersSocket } = require('../middleware/socketHandler');
    const Notification = require('../models/notification');
    
    try {
        // Save to database
        const notificationData = userIds.map(userId => ({
            user: userId,
            title,
            message,
            type,
            isRead: false,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }));
        
        await Notification.insertMany(notificationData);
        
        // Send via Socket.io
        notifyUsersSocket(userIds, 'new_notification', {
            title,
            message,
            type,
            timestamp: new Date()
        });
        
        console.log(`Notification sent to ${userIds.length} users`);
    } catch (error) {
        console.error('Error notifying multiple users:', error);
    }
};

/**
 * EXAMPLE 3: Send notification with custom data
 */
const sendCustomNotification = async (userId, notificationData) => {
    const { notifyUser } = require('../middleware/socketHandler');
    const Notification = require('../models/notification');
    
    try {
        // Save to database
        const notification = new Notification({
            user: userId,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type,
            actionUrl: notificationData.actionUrl,
            actionLabel: notificationData.actionLabel,
            relatedTo: notificationData.relatedTo,
            isRead: false,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        
        await notification.save();
        
        // Send real-time notification
        notifyUser(userId, 'new_notification', {
            id: notification._id,
            ...notificationData,
            timestamp: notification.createdAt
        });
        
        console.log(`Custom notification sent to user ${userId}`);
    } catch (error) {
        console.error('Error sending custom notification:', error);
    }
};

/**
 * EXAMPLE 4: In bookingController.js - When approving a booking
 */
const approveBooking = async (req, res) => {
    const { bookingId } = req.params;
    const { sendNotification, notificationTemplates } = require('../Controllers/notificationController');
    const Booking = require('../models/Booking');
    const Hoarding = require('../models/Hoarding');
    
    try {
        const booking = await Booking.findById(bookingId).populate('bannerUser hoardingId');
        if (!booking) {
            return res.status(404).json({ status: 0, message: 'Booking not found' });
        }
        
        // Update booking status
        booking.status = 'approved';
        await booking.save();
        
        const hoarding = await Hoarding.findById(booking.hoardingId);
        
        // Send notification to booking requester
        await sendNotification({
            userId: booking.bannerUser._id,
            ...notificationTemplates.booking_approved(booking, hoarding)
        });
        
        return res.status(200).json({
            status: 1,
            message: 'Booking approved and notification sent',
            data: booking
        });
    } catch (error) {
        console.error('Error approving booking:', error);
        return res.status(500).json({ status: 0, message: 'Server error' });
    }
};

/**
 * EXAMPLE 5: In workRequestController.js - When sending work request
 */
const sendWorkRequest = async (req, res) => {
    const { workerId, requestDetails } = req.body;
    const { sendNotification, notificationTemplates } = require('../Controllers/notificationController');
    const WorkRequest = require('../models/workRequest');
    
    try {
        // Create work request
        const workRequest = new WorkRequest({
            requesterId: req.user.id,
            workerId,
            ...requestDetails
        });
        
        await workRequest.save();
        await workRequest.populate('bannerUser');
        
        // Send notification to worker
        await sendNotification({
            userId: workerId,
            ...notificationTemplates.worker_request(workRequest, workRequest.bannerUser)
        });
        
        return res.status(201).json({
            status: 1,
            message: 'Work request sent and notification delivered',
            data: workRequest
        });
    } catch (error) {
        console.error('Error sending work request:', error);
        return res.status(500).json({ status: 0, message: 'Server error' });
    }
};

/**
 * EXAMPLE 6: Broadcast system notification
 */
const broadcastSystemNotification = async (title, message, urgency = 'normal') => {
    const { broadcastNotification } = require('../middleware/socketHandler');
    const Notification = require('../models/notification');
    const User = require('../models/User');
    
    try {
        // Get all active users
        const users = await User.find({ isDeleted: false });
        
        // Create notifications for all users
        const notificationData = users.map(user => ({
            user: user._id,
            title,
            message,
            type: 'system',
            isRead: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }));
        
        await Notification.insertMany(notificationData);
        
        // Broadcast to all connected users
        broadcastNotification('new_notification', {
            title,
            message,
            type: 'system',
            urgency,
            timestamp: new Date()
        });
        
        console.log('System notification broadcasted to all users');
    } catch (error) {
        console.error('Error broadcasting system notification:', error);
    }
};

/**
 * EXAMPLE 7: Check if user is online
 */
const checkUserOnline = (userId) => {
    const { getUserConnectionStatus } = require('../middleware/socketHandler');
    
    const connectionStatus = getUserConnectionStatus(userId);
    
    if (connectionStatus) {
        console.log(`User ${userId} is online (Socket ID: ${connectionStatus.socketId})`);
        return true;
    } else {
        console.log(`User ${userId} is offline`);
        return false;
    }
};

/**
 * EXAMPLE 8: Get all active users
 */
const viewActiveUsers = () => {
    const { getAllActiveConnections } = require('../middleware/socketHandler');
    
    const activeConnections = getAllActiveConnections();
    console.log('Active users:', activeConnections);
    
    return activeConnections;
};

// Export all examples
module.exports = {
    sendBookingNotification,
    notifyMultipleUsers,
    sendCustomNotification,
    approveBooking,
    sendWorkRequest,
    broadcastSystemNotification,
    checkUserOnline,
    viewActiveUsers
};
