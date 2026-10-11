/**
 * COMPLETE EXAMPLE: Using Notification Tracking in Controllers
 * 
 * This shows real-world examples of how to track notifications
 * in your booking, work request, and payment controllers.
 */

// =====================================================
// EXAMPLE 1: BOOKING CONTROLLER - APPROVE BOOKING
// =====================================================

const Booking = require('../models/Booking');
const Hoarding = require('../models/Hoarding');

const approveBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const { sendNotificationWithTracking } = require('../utils/notificationTracking');

        // Get booking details
        const booking = await Booking.findById(bookingId).populate('bannerUser hoardingId');

        if (!booking) {
            return res.status(404).json({
                status: 0,
                message: 'Booking not found'
            });
        }

        // Update booking status
        booking.status = 'approved';
        booking.approvedBy = req.user._id;
        booking.approvedAt = new Date();
        await booking.save();

        // Send notification WITH TRACKING
        await sendNotificationWithTracking(
            {
                userId: booking.bannerUser._id,
                title: 'Booking Approved! 🎉',
                message: `Your booking request for "${booking.hoardingId.hoardingName}" has been approved. The hoarding is now reserved for your campaign.`,
                type: 'booking_approved',
                relatedModel: 'Booking',
                relatedId: booking._id,
                actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
                actionLabel: 'View Booking',
                sendEmail: true,
                emailTemplate: 'bookingNotification',
                emailData: {
                    hoardingName: booking.hoardingId.hoardingName,
                    bookingNumber: booking.requestNumber,
                    actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
                    actionLabel: 'View Your Booking'
                },
                req
            },
            {
                // TRACKING DATA - Shows who sent the notification
                senderModule: 'bookingController',
                senderFunction: 'approveBooking',
                senderId: req.user._id,  // Admin who approved
                relatedModel: 'Booking',
                relatedId: booking._id,
                additionalDetails: {
                    hoardingName: booking.hoardingId.hoardingName,
                    hoardingId: booking.hoardingId._id,
                    requestNumber: booking.requestNumber,
                    customerName: booking.bannerUser.firstName,
                    customerId: booking.bannerUser._id,
                    approvalTime: new Date(),
                    approvedByAdmin: req.user.firstName
                }
            }
        );

        console.log(`✅ Booking ${bookingId} approved and notification sent to ${booking.bannerUser._id}`);

        return res.status(200).json({
            status: 1,
            message: 'Booking approved successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error approving booking:', error);
        res.status(500).json({
            status: 0,
            message: 'Error approving booking',
            error: error.message
        });
    }
};

// =====================================================
// EXAMPLE 2: BOOKING CONTROLLER - REJECT BOOKING
// =====================================================

const rejectBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;
        const { sendNotificationWithTracking } = require('../utils/notificationTracking');

        const booking = await Booking.findById(bookingId).populate('bannerUser hoardingId');

        if (!booking) {
            return res.status(404).json({
                status: 0,
                message: 'Booking not found'
            });
        }

        // Update booking status
        booking.status = 'rejected';
        booking.rejectionReason = reason;
        booking.rejectedBy = req.user._id;
        booking.rejectedAt = new Date();
        await booking.save();

        // Send rejection notification with tracking
        await sendNotificationWithTracking(
            {
                userId: booking.bannerUser._id,
                title: 'Booking Request Rejected',
                message: `Your booking request for "${booking.hoardingId.hoardingName}" has been rejected.\n\nReason: ${reason}`,
                type: 'booking_rejected',
                relatedModel: 'Booking',
                relatedId: booking._id,
                actionUrl: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
                actionLabel: 'View Details',
                sendEmail: true,
                emailTemplate: 'bookingNotification',
                emailData: {
                    notificationTitle: 'Booking Request Rejected',
                    notificationMessage: `Your booking request for "${booking.hoardingId.hoardingName}" has been rejected.\n\nReason: ${reason}`,
                    hoardingName: booking.hoardingId.hoardingName,
                    bookingNumber: booking.requestNumber
                },
                req
            },
            {
                senderModule: 'bookingController',
                senderFunction: 'rejectBooking',
                senderId: req.user._id,
                relatedModel: 'Booking',
                relatedId: booking._id,
                additionalDetails: {
                    hoardingName: booking.hoardingId.hoardingName,
                    customerName: booking.bannerUser.firstName,
                    rejectionReason: reason,
                    rejectionTime: new Date(),
                    rejectedByAdmin: req.user.firstName
                }
            }
        );

        console.log(`❌ Booking ${bookingId} rejected: ${reason}`);

        return res.status(200).json({
            status: 1,
            message: 'Booking rejected',
            data: booking
        });
    } catch (error) {
        console.error('Error rejecting booking:', error);
        res.status(500).json({
            status: 0,
            message: 'Error rejecting booking',
            error: error.message
        });
    }
};

// =====================================================
// EXAMPLE 3: WORK REQUEST CONTROLLER - SEND REQUEST
// =====================================================

const sendWorkRequest = async (req, res) => {
    try {
        const { workerId, description, budget } = req.body;
        const WorkRequest = require('../models/workRequest');
        const { sendNotificationWithTracking } = require('../utils/notificationTracking');

        // Create work request
        const workRequest = new WorkRequest({
            requesterId: req.user._id,
            workerId,
            description,
            budget,
            status: 'pending'
        });

        await workRequest.save();
        await workRequest.populate('requesterId workerId');

        // Send notification to worker with tracking
        await sendNotificationWithTracking(
            {
                userId: workerId,
                title: `New Work Request from ${req.user.firstName}`,
                message: `${req.user.firstName} has sent you a new work request.\n\nDescription: ${description}\nBudget: ₹${budget}`,
                type: 'worker_request',
                relatedModel: 'WorkRequest',
                relatedId: workRequest._id,
                actionUrl: `${process.env.FRONTEND_URL}/work-requests/${workRequest._id}`,
                actionLabel: 'View & Accept',
                sendEmail: true,
                emailTemplate: 'bookingNotification',
                emailData: {
                    notificationTitle: 'New Work Request',
                    notificationMessage: `${req.user.firstName} has sent you a work request.\n\nDescription: ${description}\nBudget: ₹${budget}`,
                    requesterName: req.user.firstName,
                    actionUrl: `${process.env.FRONTEND_URL}/work-requests/${workRequest._id}`
                },
                req
            },
            {
                senderModule: 'workRequestController',
                senderFunction: 'sendWorkRequest',
                senderId: req.user._id,  // Customer who sent request
                relatedModel: 'WorkRequest',
                relatedId: workRequest._id,
                additionalDetails: {
                    requesterName: req.user.firstName,
                    workerId: workerId,
                    description: description,
                    budget: budget,
                    requestTime: new Date()
                }
            }
        );

        return res.status(201).json({
            status: 1,
            message: 'Work request sent successfully',
            data: workRequest
        });
    } catch (error) {
        console.error('Error sending work request:', error);
        res.status(500).json({
            status: 0,
            message: 'Error sending work request',
            error: error.message
        });
    }
};

// =====================================================
// EXAMPLE 4: PURCHASE PLAN CONTROLLER - PAYMENT SUCCESS
// =====================================================

const handlePaymentSuccess = async (req, res) => {
    try {
        const { userId, bookingId, amount, transactionId } = req.body;
        const { sendNotificationWithTracking } = require('../utils/notificationTracking');

        // Update booking with payment info
        const booking = await Booking.findById(bookingId);
        booking.paymentStatus = 'completed';
        booking.transactionId = transactionId;
        booking.paidAmount = amount;
        booking.paidAt = new Date();
        await booking.save();

        // Send payment confirmation with tracking
        await sendNotificationWithTracking(
            {
                userId: userId,
                title: 'Payment Confirmed ✅',
                message: `Your payment of ₹${amount} for booking #${booking.requestNumber} has been successfully processed.`,
                type: 'payment_confirmation',
                relatedModel: 'Booking',
                relatedId: bookingId,
                actionUrl: `${process.env.FRONTEND_URL}/payments/${bookingId}`,
                actionLabel: 'View Receipt',
                sendEmail: true,
                emailTemplate: 'bookingNotification',
                emailData: {
                    notificationTitle: 'Payment Confirmed',
                    notificationMessage: `Payment of ₹${amount} has been received.`,
                    hoardingName: `Amount: ₹${amount}`,
                    bookingNumber: transactionId,
                    actionUrl: `${process.env.FRONTEND_URL}/payments/${bookingId}`
                },
                req
            },
            {
                senderModule: 'purchasePlanController',
                senderFunction: 'handlePaymentSuccess',
                senderId: null,  // System payment processor
                relatedModel: 'Booking',
                relatedId: bookingId,
                additionalDetails: {
                    paymentAmount: amount,
                    transactionId: transactionId,
                    bookingNumber: booking.requestNumber,
                    paymentTime: new Date(),
                    paymentMethod: 'Online'
                }
            }
        );

        return res.status(200).json({
            status: 1,
            message: 'Payment processed successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            status: 0,
            message: 'Error processing payment',
            error: error.message
        });
    }
};

// =====================================================
// EXAMPLE 5: ADMIN BROADCAST - SYSTEM ANNOUNCEMENT
// =====================================================

const broadcastSystemAnnouncement = async (req, res) => {
    try {
        const { title, message } = req.body;
        const User = require('../models/User');
        const { sendNotificationWithTracking } = require('../utils/notificationTracking');

        // Get all active users
        const users = await User.find({ isDeleted: false });

        console.log(`📢 Broadcasting announcement to ${users.length} users...`);

        // Send to each user with tracking
        const notifications = await Promise.all(
            users.map(user =>
                sendNotificationWithTracking(
                    {
                        userId: user._id,
                        title: title,
                        message: message,
                        type: 'system_announcement',
                        sendEmail: true,
                        emailTemplate: 'bookingNotification',
                        emailData: {
                            notificationTitle: title,
                            notificationMessage: message,
                            actionUrl: `${process.env.FRONTEND_URL}/notifications`
                        },
                        req
                    },
                    {
                        senderModule: 'adminController',
                        senderFunction: 'broadcastSystemAnnouncement',
                        senderId: req.user._id,  // Admin who sent
                        additionalDetails: {
                            totalRecipients: users.length,
                            recipientId: user._id,
                            recipientName: user.firstName,
                            broadcastTime: new Date()
                        }
                    }
                )
            )
        );

        return res.status(200).json({
            status: 1,
            message: `Announcement sent to ${users.length} users`,
            sentCount: notifications.filter(n => n !== null).length
        });
    } catch (error) {
        console.error('Error broadcasting:', error);
        res.status(500).json({
            status: 0,
            message: 'Error broadcasting announcement',
            error: error.message
        });
    }
};

// Export all functions
module.exports = {
    approveBooking,
    rejectBooking,
    sendWorkRequest,
    handlePaymentSuccess,
    broadcastSystemAnnouncement
};
