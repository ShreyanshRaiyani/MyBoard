/**
 * Notification Helper Functions
 * 
 * Use these helper functions in your controllers to easily send
 * both Socket.io real-time AND email notifications simultaneously
 */

const { sendNotification, notificationTemplates } = require('../Controllers/notificationController');

/**
 * BOOKING NOTIFICATIONS
 */

const notifyBookingRequest = async (userId, booking, hoarding, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.booking_request(booking, hoarding),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      hoardingName: hoarding?.hoardingName || 'Your Hoarding',
      bookingNumber: booking?.requestNumber || booking?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
      actionLabel: 'View Request'
    },
    req
  });
};

const notifyBookingApproved = async (userId, booking, hoarding, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.booking_approved(booking, hoarding),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      hoardingName: hoarding?.hoardingName || 'The Hoarding',
      bookingNumber: booking?.requestNumber || booking?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
      actionLabel: 'View Booking'
    },
    req
  });
};

const notifyBookingRejected = async (userId, booking, hoarding, reason, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.booking_rejected(booking, hoarding, reason),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      hoardingName: hoarding?.hoardingName || 'The Hoarding',
      bookingNumber: booking?.requestNumber || booking?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
      actionLabel: 'View Details'
    },
    req
  });
};

const notifyBookingCancelled = async (userId, booking, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.booking_cancelled(booking),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      bookingNumber: booking?.requestNumber || booking?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
      actionLabel: 'View Details'
    },
    req
  });
};

const notifyBookingPendingReview = async (userId, booking, hoarding, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.booking_pending_review(booking, hoarding),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      hoardingName: hoarding?.hoardingName || 'Your Hoarding',
      bookingNumber: booking?.requestNumber || booking?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
      actionLabel: 'Review Booking'
    },
    req
  });
};

/**
 * PAYMENT NOTIFICATIONS
 */

const notifyPaymentReceived = async (userId, booking, amount, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.payment(booking, amount, 'Received'),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: `Payment Received - ₹${amount}`,
      notificationMessage: `Payment of ₹${amount} for booking ${booking?.requestNumber || ''} has been received.`,
      bookingNumber: booking?.requestNumber || booking?._id,
      hoardingName: `Amount: ₹${amount}`,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payments/${booking._id}`,
      actionLabel: 'View Payment'
    },
    req
  });
};

const notifyPaymentCompleted = async (userId, booking, amount, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.payment(booking, amount, 'Completed'),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: `Payment Completed - ₹${amount}`,
      notificationMessage: `Payment of ₹${amount} for booking ${booking?.requestNumber || ''} has been completed.`,
      bookingNumber: booking?.requestNumber || booking?._id,
      hoardingName: `Amount: ₹${amount}`,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payments/${booking._id}`,
      actionLabel: 'View Payment'
    },
    req
  });
};

/**
 * WORK REQUEST NOTIFICATIONS
 */

const notifyWorkerRequest = async (userId, workRequest, worker, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.worker_request(workRequest, worker),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      requesterName: worker?.firstName || 'A User',
      workRequestId: workRequest?.requestNumber || workRequest?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/work-requests/${workRequest._id}`,
      actionLabel: 'Respond to Request'
    },
    req
  });
};

const notifyWorkerApproved = async (userId, workRequest, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.worker_approved(workRequest),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: 'Work Request Accepted',
      workRequestId: workRequest?.requestNumber || workRequest?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/work-requests/${workRequest._id}`,
      actionLabel: 'View Details'
    },
    req
  });
};

const notifyWorkerRejected = async (userId, workRequest, reason, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.worker_rejected(workRequest, reason),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: 'Work Request Rejected',
      workRequestId: workRequest?.requestNumber || workRequest?._id,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/work-requests/${workRequest._id}`,
      actionLabel: 'Select New Worker'
    },
    req
  });
};

/**
 * SYSTEM NOTIFICATIONS
 */

const notifySystemMessage = async (userId, title, message, user, req) => {
  return sendNotification({
    userId,
    ...notificationTemplates.system(title, message),
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: title,
      notificationMessage: message,
      actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/notifications`,
      actionLabel: 'Go to Dashboard'
    },
    req
  });
};

/**
 * CUSTOM NOTIFICATION
 */

const notifyCustom = async (userId, title, message, type, emailData, req) => {
  return sendNotification({
    userId,
    title,
    message,
    type,
    sendEmail: true,
    emailTemplate: 'bookingNotification',
    emailData: {
      notificationTitle: title,
      notificationMessage: message,
      ...emailData
    },
    req
  });
};

// Export all helper functions
module.exports = {
  // Booking notifications
  notifyBookingRequest,
  notifyBookingApproved,
  notifyBookingRejected,
  notifyBookingCancelled,
  notifyBookingPendingReview,
  
  // Payment notifications
  notifyPaymentReceived,
  notifyPaymentCompleted,
  
  // Work request notifications
  notifyWorkerRequest,
  notifyWorkerApproved,
  notifyWorkerRejected,
  
  // System notifications
  notifySystemMessage,
  notifyCustom
};
