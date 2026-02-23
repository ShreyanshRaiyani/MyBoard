const cron = require('node-cron');
const Booking = require('../models/Booking');
const WorkRequest = require('../models/workRequest');
const Queue = require('../models/Queue');
const Hoarding = require('../models/Hoarding');
const { sendNotification, notificationTemplates } = require('../Controllers/notificationController');

const REQUEST_EXPIRY_SCHEDULE = '0 * * * *'; // hourly

const runRequestExpiryJob = async () => {
  const now = new Date();

  // Auto-reject bookings with no owner response within 36 hours
  try {
    const bookingThreshold = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const staleBookings = await Booking.find({
      'ownerResponse.status': 'Pending',
      createdAt: { $lte: bookingThreshold }
    }).populate('hoarding');

    for (const booking of staleBookings) {
      const reason = 'No response from hoarding owner within 36 hours';

      booking.ownerResponse = {
        status: 'Rejected',
        responseDate: new Date(),
        remarks: 'Auto rejected',
        rejectionReason: reason
      };

      await booking.save();

      // If booking is part of a queue, remove it and reindex the queue
      const queue = await Queue.findOne({ hoarding: booking.hoarding._id });
      if (queue) {
        const idx = queue.queue.findIndex(e => e.bookingRequest && e.bookingRequest.toString() === booking._id.toString());
        if (idx !== -1) {
          queue.queue.splice(idx, 1);
          queue.queue.forEach((entry, i) => { entry.position = i + 1; });
          if (queue.queue.length === 0 && !queue.currentBooking) queue.isActive = false;
          await queue.save();
        }
      }

      // If no other approved bookings for this hoarding, mark hoarding active
      const hasApproved = await Booking.exists({ hoarding: booking.hoarding._id, 'ownerResponse.status': 'Approved' });
      if (!hasApproved) {
        await Hoarding.findByIdAndUpdate(booking.hoarding._id, { status: 'Active' });
      }

      // Notify banner user about rejection
      await sendNotification({
        userId: booking.bannerUser,
        ...notificationTemplates.booking_rejected(booking, booking.hoarding, reason)
      });
    }
  } catch (err) {
    console.error('Booking expiry job error:', err);
  }

  // Auto-reject work requests with no worker response within 24 hours
  try {
    const workThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleWorkRequests = await WorkRequest.find({
      RequestStatus: 'Pending',
      createdAt: { $lte: workThreshold }
    }).populate('hoarding').populate('bannerUser');

    for (const wr of staleWorkRequests) {
      const reason = 'No response from worker within 24 hours';

      wr.RequestStatus = 'Rejected';
      wr.workerResponse = {
        status: 'Rejected',
        responseDate: new Date(),
        rejectionReason: reason
      };

      wr.workProgress = wr.workProgress || [];
      wr.workProgress.push({
        status: 'Worker Rejected',
        description: 'Automatically rejected due to no response from worker',
        updatedBy: null,
        timestamp: new Date()
      });

      await wr.save();

      // Notify banner user
      await sendNotification({
        userId: wr.bannerUser._id || wr.bannerUser,
        ...notificationTemplates.worker_rejected(wr, reason)
      });

      // Notify hoarding owner (informational)
      if (wr.hoarding && wr.hoarding.owner) {
        await sendNotification({
          userId: wr.hoarding.owner,
          title: 'Work Request Auto-Rejected',
          message: `Work request ${wr.requestNumber} was auto-rejected: ${reason}`,
          type: 'work_request_auto_rejected',
          relatedModel: 'WorkRequest',
          relatedId: wr._id
        });
      }
    }
  } catch (err) {
    console.error('WorkRequest expiry job error:', err);
  }

  return { bookingsProcessed: staleBookings?.length || 0, workRequestsProcessed: staleWorkRequests?.length || 0 };
};

const startRequestExpiryCron = () => {
  cron.schedule(REQUEST_EXPIRY_SCHEDULE, async () => {
    try {
      const result = await runRequestExpiryJob();
      console.log('Request expiry cron completed:', result);
    } catch (error) {
      console.error('Request expiry cron failed:', error);
    }
  });
};

module.exports = {
  startRequestExpiryCron,
  runRequestExpiryJob
};
