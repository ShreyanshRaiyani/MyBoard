const asybcHandler = require("express-async-handler");
const Booking = require("../models/Booking");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const WorkAssignment = require('../models/workerRequest');
const Queue = require("../models/Queue");
const { sendNotification, notificationTemplates } = require("./notificationController");

// Generate unique request number
const generateRequestNumber = async () => {
    const prefix = "REQ";
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const requestNumber = `${prefix}${randomNum}`;

    const existingBooking = await Booking.findOne({ requestNumber });
    if (existingBooking) {
        return generateRequestNumber();
    }
    return requestNumber;
};

// 1. CREATE BOOKING REQUEST
const createBooking = asybcHandler(async (req, res) => {
    const { hoardingId, campaignName, startDate, endDate, notes } = req.body;

    // Check if user is authenticated and is a banner user
    if (!req.user || req.user.userType !== "BannerUser") {
        return res.status(403).json({
            status: 0,
            message: "Only banner users can create bookings"
        });
    }

    // Check if hoarding exists and is available
    const hoarding = await Hoarding.findById(hoardingId)
        .populate("owner", "firstName lastName email mobileNumber");

    if (!hoarding) {
        return res.status(404).json({
            status: 0,
            message: "Hoarding not found"
        });
    }

    // Check hoarding status and approval
    if (hoarding.status !== "Active" || hoarding.approvalStatus !== "Approved") {
        return res.status(400).json({
            status: 0,
            message: "Hoarding is not available for booking"
        });
    }

    // Check dates validity
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
        return res.status(400).json({
            status: 0,
            message: "End date must be after start date"
        });
    }

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // Check if hoarding is already booked for these dates
    const conflictingBooking = await Booking.findOne({
        hoarding: hoardingId,
        "ownerResponse.status": "Approved",
        $or: [
            {
                "duration.startDate": { $lte: end },
                "duration.endDate": { $gte: start }
            }
        ]
    });

    // Calculate pricing
    const basePrice = hoarding.pricePerDay * totalDays;
    const taxAmount = basePrice * 0.18;
    const totalAmount = basePrice + taxAmount;

    // Create initial booking data
    const bookingData = {
        requestNumber: await generateRequestNumber(),
        bannerUser: req.user.id,
        hoarding: hoardingId,
        hoardingOwner: hoarding.owner._id,
        campaignName,
        duration: {
            startDate: start,
            endDate: end,
            totalDays
        },
        pricing: {
            basePrice,
            taxAmount,
            totalAmount
        },
        notes,
        ownerResponse: {
            status: "Pending"
        }
    };

    // Check if queue exists
    let queue = await Queue.findOne({
        hoarding: hoardingId,
        isActive: true
    });

    if (conflictingBooking && hoarding.status === "Booked") {
        // Hoarding is currently booked, handle queue logic
        if (!queue) {
            // Create new queue for this hoarding
            queue = await createQueueForHoarding(hoardingId, hoarding.owner._id, conflictingBooking._id, end);
        }

        // Add booking request to queue
        const booking = new Booking(bookingData);
        await booking.save();

        const queueEntry = {
            bannerUser: req.user.id,
            bookingRequest: booking._id,
            position: queue.queue.length + 1,
            joinDate: new Date(),
            status: "Waiting"
        };

        // Calculate estimated dates based on queue position
        const estimatedDates = calculateEstimatedDates(queue, queueEntry.position);
        queueEntry.estimatedStartDate = estimatedDates.startDate;
        queueEntry.estimatedEndDate = estimatedDates.endDate;

        queue.queue.push(queueEntry);
        await queue.save();

        // Send notification to banner user about queue position
        await sendNotification({
            userId: req.user.id,
            title: "Added to Queue",
            message: `Your booking request has been added to queue. Position: ${queueEntry.position}`,
            type: "queue_joined",
            relatedModel: "Booking",
            relatedId: booking._id,
            actionUrl: `/bookings/${booking._id}`,
            actionLabel: "View Booking"
        });

        const populatedBooking = await Booking.findById(booking._id)
            .populate("bannerUser", "firstName lastName email mobileNumber")
            .populate("hoarding")
            .populate("hoardingOwner", "firstName lastName email mobileNumber");

        return res.status(200).json({
            status: 1,
            message: "Hoarding is currently booked. You have been added to the queue.",
            data: {
                booking: populatedBooking,
                queuePosition: queueEntry.position,
                estimatedStartDate: queueEntry.estimatedStartDate,
                estimatedEndDate: queueEntry.estimatedEndDate,
                inQueue: true
            }
        });
    }

    // No conflict or hoarding is active - create direct booking
    const booking = new Booking(bookingData);
    await booking.save();

    // Send notification to hoarding owner using template
    await sendNotification({
        userId: hoarding.owner._id,
        ...notificationTemplates.booking_request(booking, hoarding)
    });

    // Send notification to banner user
    await sendNotification({
        userId: req.user.id,
        title: "Booking Request Created",
        message: `Your booking request for ${hoarding.hoardingName} has been submitted`,
        type: "booking_request",
        relatedModel: "Booking",
        relatedId: booking._id,
        actionUrl: `/bookings/${booking._id}`,
        actionLabel: "View Request"
    });

    const populatedBooking = await Booking.findById(booking._id)
        .populate("bannerUser", "firstName lastName email mobileNumber")
        .populate("hoarding")
        .populate("hoardingOwner", "firstName lastName email mobileNumber");

    res.status(201).json({
        status: 1,
        message: "Booking request created successfully",
        data: populatedBooking
    });
});

// 2. GET ALL BOOKINGS
const getAllBookings = asybcHandler(async (req, res) => {
    const {
        status,
        paymentStatus,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc"
    } = req.query;

    const query = {};

    // Apply filters based on user type
    if (req.user.userType === "bannerUser") {
        query.bannerUser = req.user.id;
    } else if (req.user.userType === "hoardingOwner") {
        query.hoardingOwner = req.user.id;
    }
    // SuperAdmin can see all bookings

    // Apply additional filters
    if (status) query["ownerResponse.status"] = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(query)
        .populate("bannerUser", "firstName lastName email mobileNumber")
        .populate("hoarding")
        .populate("hoardingOwner", "firstName lastName email mobileNumber")
        .populate("workAssignment")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    // For banner users, also get queue information
    let queueInfo = [];
    if (req.user.userType === "bannerUser") {
        queueInfo = await Queue.find({
            "queue.bannerUser": req.user.id,
            isActive: true
        }).populate("hoarding", "hoardingName hoardingCode");
    }

    res.status(200).json({
        status:1,
        count: bookings.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        data: bookings,
        queueInfo: queueInfo.length > 0 ? queueInfo : undefined
    });
});

// 3. GET BOOKING BY ID
const getBookingById = asybcHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate("bannerUser", "firstName lastName email mobileNumber")
        .populate("hoarding")
        .populate("hoardingOwner", "firstName lastName email mobileNumber")
        .populate("workAssignment");

    if (!booking) {
        return res.status(404).json({
            status: 0,
            message: "Booking not found"
        });
    }

    // Check authorization
    const isBannerUser = booking.bannerUser._id.toString() === req.user.id;
    const isHoardingOwner = booking.hoardingOwner._id.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isBannerUser && !isHoardingOwner && !isSuperAdmin) {
        return res.status(403).json({
            status: 0,
            message: "Not authorized to view this booking"
        });
    }

    // Get queue information if this booking is in queue
    let queueInfo = null;
    if (booking.ownerResponse.status === "Pending") {
        const queue = await Queue.findOne({
            hoarding: booking.hoarding._id,
            "queue.bookingRequest": booking._id,
            isActive: true
        });

        if (queue) {
            const queueEntry = queue.queue.find(
                entry => entry.bookingRequest.toString() === booking._id.toString()
            );

            queueInfo = {
                position: queueEntry?.position,
                estimatedStartDate: queueEntry?.estimatedStartDate,
                estimatedEndDate: queueEntry?.estimatedEndDate,
                totalInQueue: queue.queue.length
            };
        }
    }

    res.status(200).json({
        status: 1,
        data: {
            ...booking.toObject(),
            queueInfo
        }
    });
});

// 4. UPDATE BOOKING
const updateBooking = asybcHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const booking = await Booking.findById(id)
        .populate("hoarding")
        .populate("bannerUser")
        .populate("hoardingOwner");

    if (!booking) {
        return res.status(404).json({
            status: 0,
            message: "Booking not found"
        });
    }

    // Check authorization based on update type
    if (updates.ownerResponse) {
        // Only hoarding owner can update owner response
        if (req.user.id !== booking.hoardingOwner._id.toString() && req.user.userType !== "SuperAdmin") {
            return res.status(403).json({
                status: 0,
                message: "Only hoarding owner can update booking response"
            });
        }

        const newStatus = updates.ownerResponse.status;

        // Validate status transition
        if (!["Approved", "Rejected", "Pending"].includes(newStatus)) {
            return res.status(400).json({
                status: 0,
                message: "Invalid status"
            });
        }

        if (newStatus === "Approved") {
            // Check if this booking is in queue
            const queue = await Queue.findOne({
                hoarding: booking.hoarding._id,
                "queue.bookingRequest": booking._id
            });

            if (queue) {
                // Update queue entry status
                const queueIndex = queue.queue.findIndex(
                    entry => entry.bookingRequest.toString() === booking._id.toString()
                );

                if (queueIndex !== -1) {
                    queue.queue[queueIndex].status = "Approved";
                    queue.currentBooking = booking._id;
                    await queue.save();

                    // Update hoarding status
                    await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
                        status: "Booked"
                    });

                    // Process next in queue for future dates
                    await processNextInQueue(queue._id);
                }
            } else {
                // Direct booking approval
                await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
                    status: "Booked"
                });
            }

            // Send notification using template
            await sendNotification({
                userId: booking.bannerUser._id,
                ...notificationTemplates.booking_approved(booking, booking.hoarding)
            });

        } else if (newStatus === "Rejected") {
            // Check if this booking is in queue
            const queue = await Queue.findOne({
                hoarding: booking.hoarding._id,
                "queue.bookingRequest": booking._id
            });

            if (queue) {
                // Remove from queue and update positions
                const rejectedIndex = queue.queue.findIndex(
                    entry => entry.bookingRequest.toString() === booking._id.toString()
                );

                if (rejectedIndex !== -1) {
                    // Remove rejected entry
                    queue.queue.splice(rejectedIndex, 1);

                    // Update positions of remaining entries
                    queue.queue.forEach((entry, index) => {
                        entry.position = index + 1;
                        // Recalculate estimated dates
                        const estimatedDates = calculateEstimatedDates(queue, entry.position);
                        entry.estimatedStartDate = estimatedDates.startDate;
                        entry.estimatedEndDate = estimatedDates.endDate;
                    });

                    await queue.save();

                    // Notify next in queue if any
                    if (queue.queue.length > 0) {
                        const nextInQueue = queue.queue[0];
                        await sendNotification({
                            userId: nextInQueue.bannerUser,
                            title: "Queue Position Updated",
                            message: `Your queue position is now ${nextInQueue.position}`,
                            type: "queue_advanced",
                            relatedModel: "Booking",
                            relatedId: nextInQueue.bookingRequest,
                            actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
                            actionLabel: "View Booking"
                        });
                    }
                }
            }

            // Send rejection notification using template
            await sendNotification({
                userId: booking.bannerUser._id,
                ...notificationTemplates.booking_rejected(booking, booking.hoarding, updates.ownerResponse.rejectionReason)
            });
        }

        // Update booking response
        booking.ownerResponse = {
            status: newStatus,
            responseDate: new Date(),
            remarks: updates.ownerResponse.remarks,
            rejectionReason: newStatus === "Rejected" ? updates.ownerResponse.rejectionReason : undefined
        };
    }

    if (updates.paymentStatus || updates.paymentDetails) {
        // Only banner user or admin can update payment
        if (req.user.id !== booking.bannerUser._id.toString() && req.user.userType !== "SuperAdmin") {
            return res.status(403).json({
                status: 0,
                message: "Only banner user can update payment information"
            });
        }

        if (updates.paymentStatus) {
            booking.paymentStatus = updates.paymentStatus;

            if (updates.paymentStatus === "Paid") {
                booking.paymentDetails = {
                    ...updates.paymentDetails,
                    paymentDate: new Date()
                };

                // Send payment confirmation notification using template
                await sendNotification({
                    userId: booking.hoardingOwner._id,
                    ...notificationTemplates.payment(
                        { model: "Booking", id: booking._id, url: `/bookings/${booking._id}` },
                        booking.pricing.totalAmount,
                        "Completed"
                    )
                });
            }
        }
    }

    if (updates.workAssignment) {
        // Only hoarding owner can assign work
        if (req.user.id !== booking.hoardingOwner._id.toString()) {
            return res.status(403).json({
                status: 0,
                message: "Only hoarding owner can assign work"
            });
        }

        // Check if booking is approved
        if (booking.ownerResponse.status !== "Approved") {
            return res.status(400).json({
                status: 0,
                message: "Cannot assign work to unapproved booking"
            });
        }

        // Create work assignment
        const workAssignment = new WorkAssignment({
            booking: booking._id,
            hoarding: booking.hoarding._id,
            worker: updates.workAssignment.workerId,
            assignedBy: req.user.id,
            scheduledDate: updates.workAssignment.scheduledDate,
            notes: updates.workAssignment.notes
        });

        await workAssignment.save();
        booking.workAssignment = workAssignment._id;

        // Send notification to worker
        await sendNotification({
            userId: updates.workAssignment.workerId,
            title: "New Work Assignment",
            message: `You have been assigned work for booking ${booking.requestNumber}`,
            type: "worker_request",
            relatedModel: "WorkAssignment",
            relatedId: workAssignment._id,
            actionUrl: `/work-assignments/${workAssignment._id}`,
            actionLabel: "View Assignment"
        });
    }

    await booking.save();
    const updatedBooking = await Booking.findById(id)
        .populate("bannerUser", "firstName lastName email mobileNumber")
        .populate("hoarding")
        .populate("hoardingOwner", "firstName lastName email mobileNumber")
        .populate("workAssignment");

    res.status(200).json({
        status: 1,
        message: "Booking updated successfully",
        data: updatedBooking
    });
});

// 5. DELETE BOOKING
const deleteBooking = asybcHandler(async (req, res) => {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
        return res.status(404).json({
            status: 0,
            message: "Booking not found"
        });
    }

    // Check authorization
    const isBannerUser = booking.bannerUser._id.toString() === req.user.id;
    const isHoardingOwner = booking.hoardingOwner._id.toString() === req.user.id;
    const isSuperAdmin = req.user.userType === "SuperAdmin";

    if (!isBannerUser && !isHoardingOwner && !isSuperAdmin) {
        return res.status(403).json({
            status: 0,
            message: "Not authorized to delete this booking"
        });
    }

    // Only allow deletion if booking is pending or rejected
    if (booking.ownerResponse.status === "Approved" && booking.paymentStatus === "Paid") {
        return res.status(400).json({
            status: 0,
            message: "Cannot delete approved and paid booking. Please contact support."
        });
    }

    // Check if booking is in queue
    const queue = await Queue.findOne({
        hoarding: booking.hoarding,
        "queue.bookingRequest": booking._id
    });

    if (queue) {
        // Remove from queue
        const entryIndex = queue.queue.findIndex(
            entry => entry.bookingRequest.toString() === booking._id.toString()
        );

        if (entryIndex !== -1) {
            queue.queue.splice(entryIndex, 1);

            // Update positions
            queue.queue.forEach((entry, index) => {
                entry.position = index + 1;
                // Recalculate estimated dates
                const estimatedDates = calculateEstimatedDates(queue, entry.position);
                entry.estimatedStartDate = estimatedDates.startDate;
                entry.estimatedEndDate = estimatedDates.endDate;
            });

            await queue.save();

            // If queue becomes empty and no current booking, deactivate queue
            if (queue.queue.length === 0 && !queue.currentBooking) {
                queue.isActive = false;
                await queue.save();
            }

            // Notify next in queue if any
            if (queue.queue.length > 0) {
                const nextInQueue = queue.queue[0];
                await sendNotification({
                    userId: nextInQueue.bannerUser,
                    title: "Queue Position Updated",
                    message: `Your queue position is now ${nextInQueue.position}`,
                    type: "queue_advanced",
                    relatedModel: "Booking",
                    relatedId: nextInQueue.bookingRequest,
                    actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
                    actionLabel: "View Booking"
                });
            }
        }
    }

    // If booking is approved, make hoarding available again
    if (booking.ownerResponse.status === "Approved") {
        await Hoarding.findByIdAndUpdate(booking.hoarding, {
            status: "Active"
        });
    }

    await booking.deleteOne();

    // Send notification to hoarding owner about deletion
    if (isBannerUser) {
        await sendNotification({
            userId: booking.hoardingOwner,
            title: "Booking Cancelled",
            message: `Booking ${booking.requestNumber} has been cancelled by the banner user`,
            type: "booking_cancelled",
            relatedModel: "Booking",
            relatedId: booking._id
        });
    }

    res.status(200).json({
        status: 1,
        message: "Booking deleted successfully"
    });
});

// HELPER FUNCTIONS

// Create queue for hoarding
const createQueueForHoarding = async (hoardingId, hoardingOwnerId, currentBookingId, nextAvailableDate) => {
    const queue = new Queue({
        hoarding: hoardingId,
        hoardingOwner: hoardingOwnerId,
        currentBooking: currentBookingId,
        nextAvailableDate: nextAvailableDate,
        queue: [],
        isActive: true
    });

    await queue.save();
    return queue;
};

// Calculate estimated dates based on queue position
const calculateEstimatedDates = (queue, position) => {
    // Simple calculation: each booking gets 30 days by default
    const daysPerBooking = 30;
    const startDate = queue.nextAvailableDate || new Date();

    const estimatedStartDate = new Date(startDate);
    estimatedStartDate.setDate(estimatedStartDate.getDate() + ((position - 1) * daysPerBooking));

    const estimatedEndDate = new Date(estimatedStartDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + daysPerBooking);

    return {
        startDate: estimatedStartDate,
        endDate: estimatedEndDate
    };
};

// Process next in queue when current booking ends
const processNextInQueue = async (queueId) => {
    try {
        const queue = await Queue.findById(queueId);

        if (!queue || queue.queue.length === 0) {
            // No more in queue, deactivate
            queue.isActive = false;
            await queue.save();
            return;
        }

        // Get the next booking in queue
        const nextInQueue = queue.queue[0];

        // Update hoarding's next available date
        const nextBooking = await Booking.findById(nextInQueue.bookingRequest);
        if (nextBooking) {
            const newNextAvailableDate = new Date(nextBooking.duration.endDate);
            newNextAvailableDate.setDate(newNextAvailableDate.getDate() + 1); // Add buffer day

            queue.nextAvailableDate = newNextAvailableDate;
            queue.currentBooking = nextInQueue.bookingRequest;

            // Remove from queue array
            queue.queue.shift();

            // Update positions of remaining entries
            queue.queue.forEach((entry, index) => {
                entry.position = index + 1;
                const estimatedDates = calculateEstimatedDates(queue, entry.position);
                entry.estimatedStartDate = estimatedDates.startDate;
                entry.estimatedEndDate = estimatedDates.endDate;
            });

            await queue.save();

            // Notify banner user
            await sendNotification({
                userId: nextInQueue.bannerUser,
                title: "Your Booking is Now Active",
                message: "Your booking request has moved to the front of the queue and is now active",
                type: "queue_advanced_to_current",
                relatedModel: "Booking",
                relatedId: nextInQueue.bookingRequest,
                actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
                actionLabel: "View Booking"
            });
        }
    } catch (error) {
        console.error("Process next in queue error:", error);
    }
};

// Additional API for worker response
const respondToWorkAssignment = asybcHandler(async (req, res) => {
    const { assignmentId, status, reason } = req.body;

    const workAssignment = await WorkAssignment.findById(assignmentId)
        .populate("booking")
        .populate("worker");

    if (!workAssignment) {
        return res.status(404).json({
            status: 0,
            message: "Work assignment not found"
        });
    }

    // Check if user is the assigned worker
    if (workAssignment.worker._id.toString() !== req.user.id) {
        return res.status(403).json({
            status: 0,
            message: "Only assigned worker can respond"
        });
    }

    workAssignment.workerResponse = {
        status, // "Accepted", "Rejected"
        responseDate: new Date(),
        reason
    };

    await workAssignment.save();

    // Send notification to hoarding owner
    await sendNotification({
        userId: workAssignment.assignedBy,
        title: `Worker ${status} Assignment`,
        message: `Worker ${workAssignment.worker.firstName} has ${status.toLowerCase()} the work assignment`,
        type: status === "Accepted" ? "worker_approved" : "worker_rejected",
        relatedModel: "WorkAssignment",
        relatedId: workAssignment._id,
        actionUrl: `/work-assignments/${workAssignment._id}`,
        actionLabel: "View Assignment"
    });

    // Get booking for banner user notification
    const booking = await Booking.findById(workAssignment.booking);

    if (status === "Rejected") {
        // Send notification to banner user to select different worker
        await sendNotification({
            userId: booking.bannerUser,
            title: "Worker Rejected Assignment",
            message: "The assigned worker has rejected the assignment. Please select a different worker.",
            type: "worker_rejected",
            relatedModel: "Booking",
            relatedId: booking._id,
            actionUrl: `/bookings/${booking._id}`,
            actionLabel: "Select New Worker"
        });
    } else if (status === "Accepted") {
        // Send notification to banner user
        await sendNotification({
            userId: booking.bannerUser,
            title: "Worker Accepted Assignment",
            message: "The assigned worker has accepted the work assignment.",
            type: "worker_approved",
            relatedModel: "WorkAssignment",
            relatedId: workAssignment._id,
            actionUrl: `/work-assignments/${workAssignment._id}`,
            actionLabel: "View Assignment"
        });
    }

    res.status(200).json({
        status: 1,
        message: `Work assignment ${status.toLowerCase()} successfully`,
        data: workAssignment
    });
});

// get queue status for a hoarding
const getQueueStatus = asybcHandler(async (req, res) => {
    const { hoardingId } = req.params;

    const queue = await Queue.findOne({
        hoarding: hoardingId,
        isActive: true
    }).populate("queue.bannerUser", "firstName lastName")
        .populate("queue.bookingRequest", "requestNumber campaignName")
        .populate("currentBooking", "requestNumber");

    if (!queue) {
        return res.status(404).json({
            status: 0,
            message: "No active queue found for this hoarding"
        });
    }

    res.status(200).json({
        status: 1,
        data: queue
    });
});

module.exports = {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    respondToWorkAssignment,
    getQueueStatus
};