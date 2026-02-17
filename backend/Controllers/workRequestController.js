const WorkRequest = require('../models/workRequest');
const Booking = require("../models/Booking");
const User = require("../models/User");
const Hoarding = require("../models/Hoarding");
const { sendNotification, notificationTemplates } = require("./notificationController");

// Generate unique request number
const generateRequestNumber = async () => {
  const prefix = "WR";
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const requestNumber = `${prefix}${randomNum}`;
  
  const existingRequest = await WorkRequest.findOne({ requestNumber });
  if (existingRequest) {
    return generateRequestNumber();
  }
  return requestNumber;
};

//  CREATE WORK REQUEST
const createWorkRequest = async (req, res) => {
  try {
    const { 
      bannerRequest, 
      workerId, 
      scheduledDate, 
      priority, 
      notes,
      workerFee 
    } = req.body;

    // Check if user is authenticated and is banner user
    if (req.user.userType !== "BannerUser") {
      return res.status(403).json({
        status:0,
        message: "Only banner users can create work requests"
      });
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(bannerRequest)
      .populate("hoarding")
      .populate("bannerUser");

    if (!booking) {
      return res.status(404).json({
        status:0,
        message: "Booking not found"
      });
    }

    // Verify booking belongs to user
    if (booking.bannerUser._id.toString() !== req.user.id) {
      return res.status(403).json({
        status:0,
        message: "You can only create work requests for your own bookings"
      });
    }

    // Check if booking is approved
    if (booking.ownerResponse.status !== "Approved") {
      return res.status(400).json({
        status:0,
        message: "Cannot create work request for unapproved booking"
      });
    }

    // Check if worker exists and is a worker
    const worker = await User.findById(workerId);
    if (!worker || worker.userType !== "Worker") {
      return res.status(404).json({
        status:0,
        message: "Worker not found or invalid worker"
      });
    }

    // Check for existing pending work request for this booking
    const existingRequest = await WorkRequest.findOne({
      bannerRequest,
      RequestStatus: "Pending"
    });

    if (existingRequest) {
      return res.status(400).json({
        status:0,
        message: "A pending work request already exists for this booking"
      });
    }

    // Validate scheduled date is within booking duration
    const workStartDate = new Date(scheduledDate.startDate);
    const bookingStartDate = new Date(booking.duration.startDate);
    const bookingEndDate = new Date(booking.duration.endDate);

    if (workStartDate < bookingStartDate || workStartDate > bookingEndDate) {
      return res.status(400).json({
        status:0,
        message: "Work must be scheduled within booking duration"
      });
    }

    // Create work request
    const workRequestData = {
      requestNumber: await generateRequestNumber(),
      bannerRequest,
      bannerUser: req.user.id,
      worker: workerId,
      hoarding: booking.hoarding._id,
      scheduledDate: {
        startDate: workStartDate,
        endDate: scheduledDate.endDate ? new Date(scheduledDate.endDate) : null,
        preferredTimeSlot: scheduledDate.preferredTimeSlot
      },
      priority: priority || "Medium",
      RequestStatus: "Pending",
      payment: {
        workerFee: workerFee || 0
      },
      notes,
      workProgress: [{
        status: "Request Created",
        description: "Work request created by banner user",
        updatedBy: req.user.id
      }]
    };

    const workRequest = new WorkRequest(workRequestData);
    await workRequest.save();

    // Send notification to worker using template
    await sendNotification({
      userId: workerId,
      ...notificationTemplates.worker_request(workRequest, worker)
    });

    // Send notification to hoarding owner
    const hoarding = await Hoarding.findById(booking.hoarding._id).populate("owner");
    await sendNotification({
      userId: hoarding.owner._id,
      title: "Work Request Created for Your Hoarding",
      message: `A work request has been created for your hoarding "${hoarding.hoardingName}"`,
      type: "work_request_created",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id,
      actionUrl: `/work-requests/${workRequest._id}`,
      actionLabel: "View Work Request"
    });

    // Update booking with work request reference
    await Booking.findByIdAndUpdate(bannerRequest, {
      workRequest: workRequest._id
    });

    // Send confirmation to banner user
    await sendNotification({
      userId: req.user.id,
      title: "Work Request Created",
      message: `Work request created successfully and sent to ${worker.firstName}`,
      type: "work_request_sent",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id,
      actionUrl: `/work-requests/${workRequest._id}`,
      actionLabel: "Track Request"
    });

    const populatedRequest = await WorkRequest.findById(workRequest._id);

    res.status(201).json({
      status:1,
      message: "Work request created successfully",
      data: populatedRequest
    });
  } catch (error) {
    console.error("Create work request error:", error);
    res.status(500).json({
      status:0,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//  GET ALL WORK REQUESTS
const getAllWorkRequests = async (req, res) => {
  try {
    const {
      status,
      userType,
      priority,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const query = {};

    // Filter based on user type
    if (req.user.userType === "BannerUser") {
      query.bannerUser = req.user.id;
    } else if (req.user.userType === "Worker") {
      query.worker = req.user.id;
    } else if (req.user.userType === "HoardingOwner") {
      // Hoarding owner can see work requests for their hoardings
      const hoardings = await Hoarding.find({ owner: req.user.id });
      query.hoarding = { $in: hoardings.map(h => h._id) };
    }
    // SuperAdmin can see all

    // Apply filters
    if (status) query.RequestStatus = status;
    if (priority) query.priority = priority;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const workRequests = await WorkRequest.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await WorkRequest.countDocuments(query);

    res.status(200).json({
      status:1,
      count: workRequests.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      data: workRequests
    });
  } catch (error) {
    console.error("Get all work requests error:", error);
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// GET WORK REQUEST BY ID
const getWorkRequestById = async (req, res) => {
  try {
    const workRequest = await WorkRequest.findById(req.params.id);

    if (!workRequest) {
      return res.status(404).json({
        status:0,
        message: "Work request not found"
      });
    }

    // Check authorization
    const isBannerUser = workRequest.bannerUser._id.toString() === req.user.id;
    const isWorker = workRequest.worker._id.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";
    
    // Check if user is hoarding owner
    let isHoardingOwner = false;
    if (req.user.userType === "hoardingOwner") {
      const hoarding = await Hoarding.findById(workRequest.hoarding._id);
      isHoardingOwner = hoarding.owner.toString() === req.user.id;
    }

    if (!isBannerUser && !isWorker && !isSuperAdmin && !isHoardingOwner) {
      return res.status(403).json({
        status:0,
        message: "Not authorized to view this work request"
      });
    }

    res.status(200).json({
      status:1,
      data: workRequest
    });
  } catch (error) {
    console.error("Get work request by ID error:", error);
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// UPDATE WORK REQUEST
const updateWorkRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const workRequest = await WorkRequest.findById(id);

    if (!workRequest) {
      return res.status(404).json({
        status: 0,
        message: "Work request not found"
      });
    }

    // Handle worker response
    if (updates.workerResponse) {
      if (req.user.id !== workRequest.worker?._id.toString()) {
        return res.status(403).json({
          status: 0,
          message: "Only assigned worker can respond to work request"
        });
      }

      if (workRequest.RequestStatus !== "Pending") {
        return res.status(400).json({
          status: 0,
          message: "Cannot respond to non-pending work request"
        });
      }

      const { status, rejectionReason } = updates.workerResponse;
      
      if (!["Accepted", "Rejected"].includes(status)) {
        return res.status(400).json({
          status: 0,
          message: "Invalid response status"
        });
      }

      workRequest.RequestStatus = status;
      workRequest.workerResponse = {
        responseDate: new Date(),
        rejectionReason: status === "Rejected" ? rejectionReason : undefined
      };

      // Add to work progress
      workRequest.workProgress = workRequest.workProgress || [];
      workRequest.workProgress.push({
        status: `Worker ${status}`,
        description: `Worker ${status.toLowerCase()} the work request`,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Only send essential notifications
      if (status === "Rejected") {
        // Notify banner user to select different worker
        await sendNotification({
          userId: workRequest.bannerUser._id,
          title: "Worker Rejected Request",
          message: rejectionReason || "Worker rejected the request. Please select a different worker.",
          type: "worker_rejected",
          relatedModel: "WorkRequest",
          relatedId: workRequest._id
        });
      }
    }

    // Handle payment updates
    if (updates.payment) {
      if (req.user.id !== workRequest.bannerUser?._id.toString() && req.user.userType !== "SuperAdmin") {
        return res.status(403).json({
          status: 0,
          message: "Only banner user can update payment"
        });
      }

      workRequest.payment = {
        ...workRequest.payment,
        ...updates.payment,
        updatedAt: new Date()
      };

      if (updates.payment.paymentStatus === "Paid") {
        workRequest.payment.paymentDate = new Date();
        
        workRequest.workProgress = workRequest.workProgress || [];
        workRequest.workProgress.push({
          status: "Payment Completed",
          description: "Payment has been made for the work",
          updatedBy: req.user.id,
          updatedAt: new Date()
        });

        // Simple notification to worker
        await sendNotification({
          userId: workRequest.worker._id,
          title: "Payment Received",
          message: `Payment of ₹${workRequest.payment.workerFee} has been received`,
          type: "payment_received",
          relatedModel: "WorkRequest",
          relatedId: workRequest._id
        });
      }
    }

    // Handle work progress updates
    if (updates.workProgress) {
      if (req.user.id !== workRequest.worker?._id.toString() && req.user.userType !== "SuperAdmin") {
        return res.status(403).json({
          status: 0,
          message: "Only assigned worker can update work progress"
        });
      }

      workRequest.workProgress = workRequest.workProgress || [];
      workRequest.workProgress.push({
        status: updates.workProgress.status,
        description: updates.workProgress.description,
        images: updates.workProgress.images || [],
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Simple notification to banner user
      await sendNotification({
        userId: workRequest.bannerUser._id,
        title: "Work Progress Updated",
        message: updates.workProgress.description,
        type: "work_progress",
        relatedModel: "WorkRequest",
        relatedId: workRequest._id
      });
    }

    // Handle completion details
    if (updates.completionDetails) {
      if (req.user.id !== workRequest.worker?._id.toString()) {
        return res.status(403).json({
          status: 0,
          message: "Only assigned worker can mark work as complete"
        });
      }

      workRequest.completionDetails = {
        completedDate: new Date(),
        completionNotes: updates.completionDetails.completionNotes,
        beforeImages: updates.completionDetails.beforeImages || [],
        afterImages: updates.completionDetails.afterImages || []
      };

      workRequest.RequestStatus = "Completed";

      workRequest.workProgress = workRequest.workProgress || [];
      workRequest.workProgress.push({
        status: "Work Completed",
        description: "Worker has completed the work",
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Simple notification to banner user
      await sendNotification({
        userId: workRequest.bannerUser._id,
        title: "Work Completed",
        message: "Worker has completed the work. Please review.",
        type: "work_completed",
        relatedModel: "WorkRequest",
        relatedId: workRequest._id
      });
    }

    // Handle feedback by banner user
    if (updates.feedback?.feedbackByBannerUser) {
      if (req.user.id !== workRequest.bannerUser?._id.toString()) {
        return res.status(403).json({
          status: 0,
          message: "Only banner user can give feedback to the worker"
        });
      }

      workRequest.feedback = workRequest.feedback || {};
      workRequest.feedback.feedbackByBannerUser = {
        rating: updates.feedback.feedbackByBannerUser.rating,
        review: updates.feedback.feedbackByBannerUser.review,
        feedbackDate: new Date()
      };

      // Simple notification to worker
      await sendNotification({
        userId: workRequest.worker._id,
        title: "New Feedback",
        message: `You received a ${updates.feedback.feedbackByBannerUser.rating}-star feedback`,
        type: "feedback_received",
        relatedModel: "WorkRequest",
        relatedId: workRequest._id
      });
    }

    // Handle feedback by worker
    if (updates.feedback?.feedbackByWorker) {
      if (req.user.id !== workRequest.worker?._id.toString()) {
        return res.status(403).json({
          status: 0,
          message: "Only worker can give feedback to the banner user"
        });
      }

      workRequest.feedback = workRequest.feedback || {};
      workRequest.feedback.feedbackByWorker = {
        rating: updates.feedback.feedbackByWorker.rating,
        review: updates.feedback.feedbackByWorker.review,
        feedbackDate: new Date()
      };

      // Simple notification to banner user
      await sendNotification({
        userId: workRequest.bannerUser._id,
        title: "New Feedback",
        message: `You received a ${updates.feedback.feedbackByWorker.rating}-star feedback from worker`,
        type: "feedback_received",
        relatedModel: "WorkRequest",
        relatedId: workRequest._id
      });
    }

    // Handle issues
    if (updates.issues) {
      workRequest.issues = workRequest.issues || [];
      workRequest.issues.push({
        issueType: updates.issues.issueType,
        description: updates.issues.description,
        reportedBy: req.user.id,
        reportedDate: new Date()
      });

      // Notify the other party
      const otherPartyId = req.user.id === workRequest.bannerUser?._id.toString() 
        ? workRequest.worker?._id 
        : workRequest.bannerUser?._id;

      if (otherPartyId) {
        await sendNotification({
          userId: otherPartyId,
          title: "Issue Reported",
          message: updates.issues.description,
          type: "issue_reported",
          relatedModel: "WorkRequest",
          relatedId: workRequest._id
        });
      }
    }

    // Save the document
    workRequest.updatedAt = new Date();
    await workRequest.save();
    
    // Fetch updated document with populated fields
    const updatedRequest = await WorkRequest.findById(id)
      .populate('worker')
      .populate('bannerUser')
      .populate('hoarding');

    res.status(200).json({
      status: 1,
      message: "Work request updated successfully",
      data: updatedRequest
    });
  } catch (error) {
    console.error("Update work request error:", error);
    res.status(500).json({
      status: 0,
      message: "Server error",
      error: error.message
    });
  }
};

// DELETE WORK REQUEST
const deleteWorkRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const workRequest = await WorkRequest.findById(id);

    if (!workRequest) {
      return res.status(404).json({
        status:0,
        message: "Work request not found"
      });
    }

    // Check authorization
    const isBannerUser = workRequest.bannerUser._id.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isBannerUser && !isSuperAdmin) {
      return res.status(403).json({
        status:0,
        message: "Only banner user and super admin can delete work request"
      });
    }

    // Only allow deletion if status is Pending
    if (workRequest.RequestStatus !== "Pending") {
      return res.status(400).json({
        status:0,
        message: "Cannot delete work request that is already accepted or rejected"
      });
    }

    // Notify worker about cancellation
    await sendNotification({
      userId: workRequest.worker._id,
      title: "Work Request Cancelled",
      message: "Work request has been cancelled by the banner user",
      type: "work_request_cancelled",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id
    });

    // Notify hoarding owner
    const hoarding = await Hoarding.findById(workRequest.hoarding._id).populate("owner");
    await sendNotification({
      userId: hoarding.owner._id,
      title: "Work Request Cancelled",
      message: `Work request cancelled for hoarding "${hoarding.hoardingName}"`,
      type: "work_request_cancelled",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id
    });

    // Clear work assignment from booking
    await Booking.findByIdAndUpdate(workRequest.bannerRequest._id, {
      $unset: { workRequest: "" }
    });

    await workRequest.deleteOne();

    res.status(200).json({
      status:1,
      message: "Work request deleted successfully"
    });
  } catch (error) {
    console.error("Delete work request error:", error);
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// 6. ASSIGN WORK REQUEST TO DIFFERENT WORKER (when previous worker rejects)
const reassignWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { newWorkerId } = req.body;

    const workRequest = await WorkRequest.findById(id);

    if (!workRequest) {
      return res.status(404).json({
        status:0,
        message: "Work request not found"
      });
    }

    // Only banner user can reassign
    if (workRequest.bannerUser._id.toString() !== req.user.id) {
      return res.status(403).json({
        status:0,
        message: "Only banner user can reassign worker"
      });
    }

    // Check if work request was rejected
    if (workRequest.RequestStatus !== "Rejected") {
      return res.status(400).json({
        status:0,
        message: "Can only reassign when previous worker rejected the request"
      });
    }

    // Check if new worker exists and is a worker
    const newWorker = await User.findById(newWorkerId);
    if (!newWorker || newWorker.userType !== "Worker") {
      return res.status(404).json({
        status:0,
        message: "New worker not found or invalid worker"
      });
    }

    // Update work request
    workRequest.worker = newWorkerId;
    workRequest.RequestStatus = "Pending";
    workRequest.workerResponse = undefined;

    // Add to work progress
    workRequest.workProgress.push({
      status: "Worker Reassigned",
      description: `Work reassigned to new worker: ${newWorker.firstName}`,
      updatedBy: req.user.id
    });

    await workRequest.save();

    // Send notification to new worker using template
    await sendNotification({
      userId: newWorkerId,
      ...notificationTemplates.worker_request(workRequest, newWorker)
    });

    // Notify previous worker (optional)
    const previousWorker = await User.findById(workRequest.workerResponse?.responseBy);
    if (previousWorker) {
      await sendNotification({
        userId: previousWorker._id,
        title: "Work Reassigned",
        message: "The work has been reassigned to another worker",
        type: "work_reassigned",
        relatedModel: "WorkRequest",
        relatedId: workRequest._id
      });
    }

    // Notify hoarding owner
    const hoarding = await Hoarding.findById(workRequest.hoarding._id).populate("owner");
    await sendNotification({
      userId: hoarding.owner._id,
      title: "Worker Reassigned",
      message: `Work reassigned to new worker for hoarding "${hoarding.hoardingName}"`,
      type: "worker_reassigned",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id
    });

    // Confirm to banner user
    await sendNotification({
      userId: req.user.id,
      title: "Worker Reassigned",
      message: `Work reassigned to ${newWorker.firstName}`,
      type: "worker_reassigned",
      relatedModel: "WorkRequest",
      relatedId: workRequest._id,
      actionUrl: `/work-requests/${workRequest._id}`,
      actionLabel: "View Request"
    });

    const updatedRequest = await WorkRequest.findById(id);

    res.status(200).json({
      status:1,
      message: "Worker reassigned successfully",
      data: updatedRequest
    });
  } catch (error) {
    console.error("Reassign worker error:", error);
    res.status(500).json({
      status:0,
      message: "Server error"
    });
  }
};

// HELPER FUNCTIONS
const updateWorkerFeedback = async (workerId, newFeedback) => {
  try {
    const worker = await User.findById(workerId);
    if (worker && worker.userType === "worker") {
      // Get all feedbacks for this worker
      const workRequests = await WorkRequest.find({
        worker: workerId,
        "feedback.feedbackByBannerUser.rating": { $exists: true }
      });

      const feedbacks = workRequests.map(wr => wr.feedback.feedbackByBannerUser.rating);
      feedbacks.push(newFeedback);

      const averageFeedback = feedbacks.reduce((sum, feedback) => sum + feedback, 0) / feedbacks.length;
      
      // Update worker's average feedback
      worker.averageFeedback = averageFeedback;
      worker.totalFeedbacks = feedbacks.length;
      await worker.save();

      // Notify worker about feedback update
      await sendNotification({
        userId: workerId,
        title: "Feedback Updated",
        message: `Your average feedback is now ${averageFeedback.toFixed(1)} stars`,
        type: "feedback_updated",
        relatedModel: "User",
        relatedId: workerId
      });
    }
  } catch (error) {
    console.error("Update worker feedback error:", error);
  }
};

module.exports = {
  createWorkRequest,
  getAllWorkRequests,
  getWorkRequestById,
  updateWorkRequest,
  deleteWorkRequest,
  reassignWorker
};