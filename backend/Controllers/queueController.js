// controllers/queueController.js
const Queue = require("../models/Queue");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const Booking = require("../models/Booking");

async function syncHoardingStatusIfAvailable(hoardingId) {
  const hasApprovedBooking = await Booking.exists({
    hoarding: hoardingId,
    "ownerResponse.status": "Approved"
  });

  const queue = await Queue.findOne({ hoarding: hoardingId });
  const hasQueue = Boolean(queue && (queue.currentBooking || queue.queue.length > 0));

  if (!hasApprovedBooking && !hasQueue) {
    await Hoarding.findByIdAndUpdate(hoardingId, {
      status: "Active"
    });
  }
}

// Get all queues (for admin/owners)
const getAllQueues = async (req, res) => {
  try {
    const { 
      hoardingId, 
      isActive, 
      page = 1, 
      limit = 20 
    } = req.query;

    const query = {};

    // Filter by hoarding
    if (hoardingId) {
      query.hoarding = hoardingId;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // If user is hoarding owner, only show their queues
    if (req.user.userType === 'hoardingOwner') {
      query.hoardingOwner = req.user.id;
    }

    const skip = (page - 1) * limit;

    const queues = await Queue.find(query)
      .populate("hoarding", "hoardingName hoardingCode location")
      .populate("hoardingOwner", "firstName lastName email")
      .populate("currentBooking", "requestNumber campaignName")
      .populate("queue.bannerUser", "firstName lastName email")
      .populate("queue.bookingRequest", "requestNumber campaignName")
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Queue.countDocuments(query);

    res.status(200).json({
      status:1,
      count: queues.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: queues
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//  Get queue by ID
const getQueueById = async (req, res) => {
  try {
    const queue = await Queue.findById(req.params.id)
      .populate("hoarding", "hoardingName hoardingCode location dimensions pricePerDay")
      .populate("hoardingOwner", "firstName lastName email mobileNumber")
      .populate("currentBooking")
      .populate("queue.bannerUser", "firstName lastName email mobileNumber")
      .populate("queue.bookingRequest");

    if (!queue) {
      return res.status(404).json({
        status:0,
        message: "Queue not found"
      });
    }

    // Authorization check
    const isOwner = queue.hoardingOwner._id.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";
    const isInQueue = queue.queue.some(
      entry => entry.bannerUser._id.toString() === req.user.id
    );

    if (!isOwner && !isSuperAdmin && !isInQueue) {
      return res.status(403).json({
        status:0,
        message: "Not authorized to view this queue"
      });
    }

    res.status(200).json({
      status:1,
      data: queue
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// Get user's position in queue (for banner users)
const getMyQueuePositions = async (req, res) => {
  try {
    if (req.user.userType !== "BannerUser") {
      return res.status(403).json({
        status:0,
        message: "Only banner users can check their queue positions"
      });
    }

    const queues = await Queue.find({
      "queue.bannerUser": req.user.id,
      isActive: true
    })
      .populate("hoarding", "hoardingName hoardingCode location")
      .populate("hoardingOwner", "firstName lastName")
      .populate("queue.$", "position status estimatedStartDate estimatedEndDate");

    const myPositions = queues.map(queue => {
      const myEntry = queue.queue.find(
        entry => entry.bannerUser.toString() === req.user.id
      );
      
      return {
        queueId: queue._id,
        hoarding: queue.hoarding,
        hoardingOwner: queue.hoardingOwner,
        currentPosition: myEntry.position,
        totalInQueue: queue.queue.length,
        status: myEntry.status,
        estimatedStartDate: myEntry.estimatedStartDate,
        estimatedEndDate: myEntry.estimatedEndDate,
        joinDate: myEntry.joinDate,
        isCurrentBooking: queue.currentBooking?.toString() === myEntry.bookingRequest?.toString()
      };
    });

    res.status(200).json({
      status:1,
      count: myPositions.length,
      data: myPositions
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// Remove user from queue (banner user can remove themselves)
const removeFromQueue = async (req, res) => {
  try {
    const { queueId } = req.params;
    
    const queue = await Queue.findById(queueId);

    if (!queue) {
      return res.status(404).json({
        status:0,
        message: "Queue not found"
      });
    }

    // Check if user is in this queue
    const userIndex = queue.queue.findIndex(
      entry => entry.bannerUser.toString() === req.user.id
    );

    if (userIndex === -1) {
      return res.status(400).json({
        status:0,
        message: "You are not in this queue"
      });
    }

    // Get the booking request ID before removing
    const bookingRequestId = queue.queue[userIndex].bookingRequest;

    // Remove user from queue
    queue.queue.splice(userIndex, 1);

    // Update positions of remaining entries
    queue.queue.forEach((entry, index) => {
      entry.position = index + 1;
      // Recalculate estimated dates if needed
    });

    // If queue becomes empty and no current booking, deactivate queue
    if (queue.queue.length === 0 && !queue.currentBooking) {
      queue.isActive = false;
    }

    await queue.save();

    // Update booking status to rejected
    if (bookingRequestId) {
      await Booking.findByIdAndUpdate(bookingRequestId, {
        "ownerResponse.status": "Rejected",
        "ownerResponse.rejectionReason": "User removed themselves from queue",
        "ownerResponse.responseDate": new Date()
      });
    }

    await syncHoardingStatusIfAvailable(queue.hoarding);

    // Notify next in queue if any
    if (queue.queue.length > 0) {
      const nextInQueue = queue.queue[0];
      // Send notification
    }

    res.status(200).json({
      status:1,
      message: "Successfully removed from queue"
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// Admin/Owner: Force process next in queue
const forceProcessNext = async (req, res) => {
  try {
    const { queueId } = req.params;
    
    const queue = await Queue.findById(queueId)
      .populate("currentBooking");

    if (!queue) {
      return res.status(404).json({
        status:0,
        message: "Queue not found"
      });
    }

    // Authorization: Only owner or super admin
    const isOwner = queue.hoardingOwner.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        status:0,
        message: "Only hoarding owner or admin can force process queue"
      });
    }

    if (queue.queue.length === 0) {
      return res.status(400).json({
        status:0,
        message: "Queue is empty"
      });
    }

    // Get current booking end date or use current date
    const nextAvailableDate = queue.currentBooking?.duration?.endDate || new Date();
    
    // Process next in queue
    const nextBookingRequest = queue.queue[0].bookingRequest;
    
    // Update hoarding status
    await Hoarding.findByIdAndUpdate(queue.hoarding, {
      status: "Booked"
    });

    // Update current booking
    queue.currentBooking = nextBookingRequest;
    queue.nextAvailableDate = new Date(nextAvailableDate);
    queue.nextAvailableDate.setDate(queue.nextAvailableDate.getDate() + 1);

    // Remove from queue array
    queue.queue.shift();

    // Update positions
    queue.queue.forEach((entry, index) => {
      entry.position = index + 1;
      // Recalculate estimated dates
    });

    await queue.save();

    // Update booking status to approved
    await Booking.findByIdAndUpdate(nextBookingRequest, {
      "ownerResponse.status": "Approved",
      "ownerResponse.responseDate": new Date()
    });

    // Send notifications
    // ...

    res.status(200).json({
      status:1,
      message: "Next booking in queue has been processed",
      data: {
        newCurrentBooking: nextBookingRequest,
        queueLength: queue.queue.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// 6. Update queue entry (admin/owner only)
const updateQueueEntry = async (req, res) => {
  try {
    const { queueId, entryId } = req.params;
    const { position, status, estimatedStartDate, estimatedEndDate } = req.body;
    
    const queue = await Queue.findById(queueId);

    if (!queue) {
      return res.status(404).json({
        status:0,
        message: "Queue not found"
      });
    }

    // Authorization
    const isOwner = queue.hoardingOwner.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        status:0,
        message: "Not authorized to update queue"
      });
    }

    const entryIndex = queue.queue.findIndex(
      entry => entry._id.toString() === entryId
    );

    if (entryIndex === -1) {
      return res.status(404).json({
        status:0,
        message: "Queue entry not found"
      });
    }

    // Update fields
    if (position !== undefined) {
      // Handle position change (swap with other entry)
      const newPosition = parseInt(position);
      if (newPosition >= 1 && newPosition <= queue.queue.length) {
        // Remove from current position
        const [entry] = queue.queue.splice(entryIndex, 1);
        // Insert at new position
        queue.queue.splice(newPosition - 1, 0, entry);
        
        // Update all positions
        queue.queue.forEach((entry, index) => {
          entry.position = index + 1;
        });
      }
    }

    if (status) {
      queue.queue[entryIndex].status = status;
    }

    if (estimatedStartDate) {
      queue.queue[entryIndex].estimatedStartDate = new Date(estimatedStartDate);
    }

    if (estimatedEndDate) {
      queue.queue[entryIndex].estimatedEndDate = new Date(estimatedEndDate);
    }

    await queue.save();

    res.status(200).json({
      status:1,
      message: "Queue entry updated successfully",
      data: queue.queue[entryIndex]
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// 7. Deactivate/activate queue
const toggleQueueStatus = async (req, res) => {
  try {
    const { queueId } = req.params;
    const { isActive } = req.body;
    
    const queue = await Queue.findById(queueId);

    if (!queue) {
      return res.status(404).json({
        status:0,
        message: "Queue not found"
      });
    }

    // Authorization
    const isOwner = queue.hoardingOwner.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        status:0,
        message: "Not authorized to update queue status"
      });
    }

    queue.isActive = isActive;
    await queue.save();

    res.status(200).json({
      status:1,
      message: `Queue ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: queue
    });
  } catch (error) {
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

module.exports = {
  getAllQueues,
  getQueueById,
  getMyQueuePositions,
  removeFromQueue,
  forceProcessNext,
  updateQueueEntry,
  toggleQueueStatus
};