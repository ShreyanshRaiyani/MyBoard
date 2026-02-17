const asyncHandler = require("express-async-handler");
const Booking = require("../models/Booking");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const WorkRequest = require('../models/workRequest');
const Queue = require("../models/Queue");
const { sendNotification, notificationTemplates } = require("./notificationController");

// Generate unique request number
const generateRequestNumber = async () => {
    const prefix = "REQ-";
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const requestNumber = `${prefix}${randomNum}`;

    const existingBooking = await Booking.findOne({ requestNumber });
    if (existingBooking) {
        return generateRequestNumber();
    }
    return requestNumber;
};

// 1. CREATE BOOKING REQUEST
const createBooking = asyncHandler(async (req, res) => {
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
    if (!hoarding?.isActive || hoarding.approvalStatus !== "Approved") {
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

    if (conflictingBooking) {
        return res.status(400).json({
            status: 0,
            message: "Hoarding is not available for booking Because Conflict Occure"
        });
    };

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

    if (hoarding.status === "Booked") {
        // Check if queue exists
        let queue = await Queue.findOne({
            hoarding: hoardingId,
            isActive: true
        });

        if (!queue) {
            // Create new queue for this hoarding
            queue = await createQueueForHoarding(hoardingId, hoarding.owner);
        }

        // Create booking first
        const booking = new Booking(bookingData);
        await booking.save();

        // Get all existing queue entries with their booking details
        const queueEntriesWithDetails = await Promise.all(
            queue.queue.map(async (entry) => {
                const bookingDetails = await Booking.findById(entry.bookingRequest);
                return {
                    _id: entry._id,
                    bannerUser: entry.bannerUser,
                    bookingRequest: entry.bookingRequest,
                    position: entry.position,
                    joinDate: entry.joinDate,
                    status: entry.status,
                    startDate: bookingDetails?.duration?.startDate,
                    endDate: bookingDetails?.duration?.endDate
                };
            })
        );

        // Create new queue entry with start date
        const newQueueEntry = {
            bannerUser: req.user.id,
            bookingRequest: booking._id,
            joinDate: new Date(),
            status: "Waiting",
            startDate: booking.duration.startDate,
            endDate: booking.duration.endDate
        };

        // Add new entry to array
        queueEntriesWithDetails.push(newQueueEntry);

        // Filter out entries without valid dates and sort by start date
        const validEntries = queueEntriesWithDetails.filter(entry => entry.startDate);
        validEntries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        // Reassign positions based on sorted order
        const updatedQueueEntries = validEntries.map((entry, index) => ({
            bannerUser: entry.bannerUser,
            bookingRequest: entry.bookingRequest,
            position: index + 1,
            joinDate: entry.joinDate || new Date(),
            status: entry.status || "Waiting",
            estimatedStartDate: null, // Will be calculated later
            estimatedEndDate: null     // Will be calculated later
        }));

        // Calculate estimated dates for each queue entry
        const queueWithEstimatedDates = await calculateEstimatedDatesForQueue(
            queue,
            updatedQueueEntries,
            booking
        );

        // Update queue with sorted entries and estimated dates
        queue.queue = queueWithEstimatedDates;
        await queue.save();

        // Find user's queue entry
        const userQueueEntry = queue.queue.find(
            entry => entry.bookingRequest.toString() === booking._id.toString()
        );

        // Send notification to banner user about queue position
        await sendNotification({
            userId: req.user.id,
            title: "Added to Queue",
            message: `Your booking request has been added to queue. Position: ${userQueueEntry.position}`,
            type: "queue_joined",
            relatedModel: "Booking",
            relatedId: booking._id,
            actionUrl: `/bookings/${booking._id}`,
            actionLabel: "View Booking"
        });

        // Notify others in queue about position changes if any
        if (queue.queue.length > 1) {
            await notifyQueuePositionChanges(queue, booking._id);
        }

        const populatedBooking = await Booking.findById(booking._id)
            .populate("bannerUser", "firstName lastName email mobileNumber")
            .populate("hoarding")
            .populate("hoardingOwner", "firstName lastName email mobileNumber");

        return res.status(200).json({
            status: 1,
            message: "Hoarding is currently booked. You have been added to the queue.",
            data: {
                booking: populatedBooking,
                queuePosition: userQueueEntry.position,
                estimatedStartDate: userQueueEntry.estimatedStartDate,
                estimatedEndDate: userQueueEntry.estimatedEndDate,
                inQueue: true,
                totalInQueue: queue.queue.length
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
const getAllBookings = asyncHandler(async (req, res) => {
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
        .populate("workRequest")
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
        status: 1,
        count: bookings.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
        data: bookings,
        queueInfo: queueInfo.length > 0 ? queueInfo : undefined
    });
});

// 3. GET BOOKING BY ID
const getBookingById = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate("bannerUser", "firstName lastName email mobileNumber")
        .populate("hoarding")
        .populate("hoardingOwner", "firstName lastName email mobileNumber")
        .populate("workRequest");

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
// const updateBooking = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const updates = req.body;

//     const booking = await Booking.findById(id)
//         .populate("hoarding")
//         .populate("bannerUser")
//         .populate("hoardingOwner");

//     if (!booking) {
//         return res.status(404).json({
//             status: 0,
//             message: "Booking not found"
//         });
//     }

//     // Check authorization based on update type
//     if (updates.ownerResponse) {
//         // Only hoarding owner can update owner response
//         if (req.user.id !== booking.hoardingOwner._id.toString() && req.user.userType !== "SuperAdmin") {
//             return res.status(403).json({
//                 status: 0,
//                 message: "Only hoarding owner can update booking response"
//             });
//         }

//         const newStatus = updates.ownerResponse.status;

//         // Validate status transition
//         if (!["Approved", "Rejected", "Pending"].includes(newStatus)) {
//             return res.status(400).json({
//                 status: 0,
//                 message: "Invalid status"
//             });
//         }

//         if (newStatus === "Approved") {
//             // Check if this booking is in queue
//             const queue = await Queue.findOne({
//                 hoarding: booking.hoarding._id,
//                 "queue.bookingRequest": booking._id
//             });

//             if (queue) {
//                 // Update queue entry status
//                 const queueIndex = queue.queue.findIndex(
//                     entry => entry.bookingRequest.toString() === booking._id.toString()
//                 );

//                 if (queueIndex !== -1) {
//                     if (queueIndex === 0) {
//                         // queue.queue[queueIndex].status = "Approved";
//                         queue.currentBooking = booking._id;
//                         // await queue.save();

//                         // Remove from queue
//                         queue.queue.splice(queueIndex, 1);

//                         // Update hoarding status
//                         await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
//                             status: "Booked"
//                         });

//                         // Process next in queue for future dates
//                         // await processNextInQueue(queue._id);

//                         // Set next available date
//                         queue.nextAvailableDate = new Date(booking.duration.endDate);
//                         queue.nextAvailableDate.setDate(queue.nextAvailableDate.getDate() + 1);
//                     } else {
//                         // This booking is not first in queue, just mark as approved but keep in queue
//                         queue.queue[queueIndex].status = "Approved";
//                     }
//                     // Recalculate positions for remaining queue entries
//                     const remainingEntries = await recalculateQueuePositions(queue);
//                     queue.queue = remainingEntries;
//                     await queue.save();

//                     // Process next in queue if this was the current booking
//                     if (queueIndex === 0 && queue.queue.length > 0) {
//                         await notifyNextInQueue(queue);
//                     }
//                 }
//             } else {
//                 // Direct booking approval
//                 await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
//                     status: "Booked"
//                 });
//             }

//             // Update booking response
//             booking.ownerResponse = {
//                 status: newStatus,
//                 responseDate: new Date(),
//                 remarks: updates.ownerResponse.remarks || "",
//                 rejectionReason: undefined
//             };

//             // Send notification using template
//             await sendNotification({
//                 userId: booking.bannerUser._id,
//                 ...notificationTemplates.booking_approved(booking, booking.hoarding)
//             });

//         } else if (newStatus === "Rejected") {
//             // Check if this booking is in queue
//             const queue = await Queue.findOne({
//                 hoarding: booking.hoarding._id,
//                 "queue.bookingRequest": booking._id
//             });

//             if (queue) {
//                 // Remove from queue and update positions
//                 const rejectedIndex = queue.queue.findIndex(
//                     entry => entry.bookingRequest.toString() === booking._id.toString()
//                 );

//                 if (rejectedIndex !== -1) {
//                     // Remove rejected entry
//                     queue.queue.splice(rejectedIndex, 1);

//                     // Recalculate positions and estimated dates
//                     const updatedQueue = await recalculateQueuePositions(queue);
//                     queue.queue = updatedQueue;
//                     await queue.save();

//                     // If queue becomes empty and no current booking, deactivate queue
//                     if (queue.queue.length === 0 && !queue.currentBooking) {
//                         queue.isActive = false;
//                         await queue.save();
//                     }

//                     // Notify next in queue if this was the first position
//                     if (rejectedIndex === 0 && queue.queue.length > 0) {
//                         await notifyNextInQueue(queue);
//                     }
                    
//                     // Notify all affected users about position changes
//                     await notifyQueuePositionChanges(queue, null, rejectedIndex);

//                     // Update positions of remaining entries
//                     // queue.queue.forEach((entry, index) => {
//                     //     entry.position = index + 1;
//                     //     // Recalculate estimated dates
//                     //     const estimatedDates = calculateEstimatedDates(queue, entry.position);
//                     //     entry.estimatedStartDate = estimatedDates.startDate;
//                     //     entry.estimatedEndDate = estimatedDates.endDate;
//                     // });

//                     // await queue.save();

//                     // Notify next in queue if any
//                     // if (queue.queue.length > 0) {
//                     //     const nextInQueue = queue.queue[0];
//                     //     await sendNotification({
//                     //         userId: nextInQueue.bannerUser,
//                     //         title: "Queue Position Updated",
//                     //         message: `Your queue position is now ${nextInQueue.position}`,
//                     //         type: "queue_advanced",
//                     //         relatedModel: "Booking",
//                     //         relatedId: nextInQueue.bookingRequest,
//                     //         actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
//                     //         actionLabel: "View Booking"
//                     //     });
//                     // }
//                 }
//             }

//             // Send rejection notification using template
//             await sendNotification({
//                 userId: booking.bannerUser._id,
//                 ...notificationTemplates.booking_rejected(booking, booking.hoarding, updates.ownerResponse.rejectionReason)
//             });
//         }

//         // Update booking response
//         booking.ownerResponse = {
//             status: newStatus,
//             responseDate: new Date(),
//             remarks: updates.ownerResponse.remarks,
//             rejectionReason: newStatus === "Rejected" ? updates.ownerResponse.rejectionReason : undefined
//         };
//     }

//     if (updates.paymentStatus || updates.paymentDetails) {
//         // Only banner user or admin can update payment
//         if (req.user.id !== booking.bannerUser._id.toString() && req.user.userType !== "SuperAdmin") {
//             return res.status(403).json({
//                 status: 0,
//                 message: "Only banner user can update payment information"
//             });
//         }

//         if (updates.paymentStatus) {
//             booking.paymentStatus = updates.paymentStatus;

//             if (updates.paymentStatus === "Paid") {
//                 booking.paymentDetails = {
//                     ...updates.paymentDetails,
//                     paymentDate: new Date()
//                 };

//                 // Send payment confirmation notification using template
//                 await sendNotification({
//                     userId: booking.hoardingOwner._id,
//                     ...notificationTemplates.payment(
//                         { model: "Booking", id: booking._id, url: `/bookings/${booking._id}` },
//                         booking.pricing.totalAmount,
//                         "Completed"
//                     )
//                 });
//             }
//         }
//     }

//     if (updates.workRequest) {
//         // Only Banner User can assign work
//         if (req.user.id !== booking.bannerUser._id.toString()) {
//             return res.status(403).json({
//                 status: 0,
//                 message: "Only Banner User can assign work"
//             });
//         }

//         // Check if booking is approved
//         if (booking.ownerResponse.status !== "Approved") {
//             return res.status(400).json({
//                 status: 0,
//                 message: "Cannot assign work to unapproved booking"
//             });
//         }

//         // Create work assignment
//         const workRequest = new WorkRequest({
//             booking: booking._id,
//             hoarding: booking.hoarding._id,
//             worker: updates.workRequest.workerId,
//             assignedBy: req.user.id,
//             scheduledDate: updates.workRequest.scheduledDate,
//             notes: updates.workRequest.notes
//         });

//         await workRequest.save();
//         booking.workRequest = workRequest._id;

//         // Send notification to worker
//         await sendNotification({
//             userId: updates.workRequest.workerId,
//             title: "New Work Assignment",
//             message: `You have been assigned work for booking ${booking.requestNumber}`,
//             type: "worker_request",
//             relatedModel: "WorkRequest",
//             relatedId: workRequest._id,
//             actionUrl: `/work-assignments/${workRequest._id}`,
//             actionLabel: "View Assignment"
//         });
//     }

//     await booking.save();
//     const updatedBooking = await Booking.findById(id)
//         .populate("bannerUser", "firstName lastName email mobileNumber")
//         .populate("hoarding")
//         .populate("hoardingOwner", "firstName lastName email mobileNumber")
//         .populate("workRequest");

//     res.status(200).json({
//         status: 1,
//         message: "Booking updated successfully",
//         data: updatedBooking
//     });
// });
const updateBooking = asyncHandler(async (req, res) => {
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
                // This booking is in queue
                const queueIndex = queue.queue.findIndex(
                    entry => entry.bookingRequest.toString() === booking._id.toString()
                );

                if (queueIndex !== -1) {
                    // Check if this is the first in queue
                    if (queueIndex === 0) {
                        // This is the next booking to be activated
                        queue.currentBooking = booking._id;
                        
                        // Remove from queue
                        queue.queue.splice(queueIndex, 1);
                        
                        // Update hoarding status
                        await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
                            status: "Booked"
                        });
                        
                        // Set next available date
                        queue.nextAvailableDate = new Date(booking.duration.endDate);
                        queue.nextAvailableDate.setDate(queue.nextAvailableDate.getDate() + 1);
                    } else {
                        // This booking is not first in queue, just mark as approved but keep in queue
                        queue.queue[queueIndex].status = "Approved";
                    }

                    // Recalculate positions for remaining queue entries
                    const remainingEntries = await recalculateQueuePositions(queue);
                    queue.queue = remainingEntries;
                    await queue.save();

                    // Process next in queue if this was the current booking
                    if (queueIndex === 0 && queue.queue.length > 0) {
                        await notifyNextInQueue(queue);
                    }
                }
            } else {
                // Direct booking approval (not in queue)
                await Hoarding.findByIdAndUpdate(booking.hoarding._id, {
                    status: "Booked"
                });
            }

            // Update booking response
            booking.ownerResponse = {
                status: newStatus,
                responseDate: new Date(),
                remarks: updates.ownerResponse.remarks || "",
                rejectionReason: undefined
            };

            // Send notification using template
            if (typeof notificationTemplates?.booking_approved === 'function') {
                await sendNotification({
                    userId: booking.bannerUser._id,
                    ...notificationTemplates.booking_approved(booking, booking.hoarding)
                });
            } else {
                // Fallback notification
                await sendNotification({
                    userId: booking.bannerUser._id,
                    title: "Booking Approved",
                    message: `Your booking for ${booking.hoarding?.hoardingName || 'hoarding'} has been approved`,
                    type: "booking_approved",
                    relatedModel: "Booking",
                    relatedId: booking._id,
                    actionUrl: `/bookings/${booking._id}`,
                    actionLabel: "View Booking"
                });
            }

        } else if (newStatus === "Rejected") {
            // Check if this booking is in queue
            const queue = await Queue.findOne({
                hoarding: booking.hoarding._id,
                "queue.bookingRequest": booking._id
            });

            if (queue) {
                // Remove from queue
                const rejectedIndex = queue.queue.findIndex(
                    entry => entry.bookingRequest.toString() === booking._id.toString()
                );

                if (rejectedIndex !== -1) {
                    // Remove rejected entry
                    queue.queue.splice(rejectedIndex, 1);

                    // Recalculate positions and estimated dates
                    const updatedQueue = await recalculateQueuePositions(queue);
                    queue.queue = updatedQueue;
                    await queue.save();

                    // If queue becomes empty and no current booking, deactivate queue
                    if (queue.queue.length === 0 && !queue.currentBooking) {
                        queue.isActive = false;
                        await queue.save();
                    }

                    await syncHoardingStatusIfAvailable(booking.hoarding._id);

                    // Notify next in queue if this was the first position
                    if (rejectedIndex === 0 && queue.queue.length > 0) {
                        await notifyNextInQueue(queue);
                    }
                    
                    // Notify all affected users about position changes
                    await notifyQueuePositionChanges(queue, null, rejectedIndex);
                }
            }

            // Update booking response
            booking.ownerResponse = {
                status: newStatus,
                responseDate: new Date(),
                remarks: updates.ownerResponse.remarks || "",
                rejectionReason: updates.ownerResponse.rejectionReason || "No reason provided"
            };

            // Send rejection notification
            if (typeof notificationTemplates?.booking_rejected === 'function') {
                await sendNotification({
                    userId: booking.bannerUser._id,
                    ...notificationTemplates.booking_rejected(booking, booking.hoarding, updates.ownerResponse.rejectionReason)
                });
            } else {
                await sendNotification({
                    userId: booking.bannerUser._id,
                    title: "Booking Rejected",
                    message: `Your booking request has been rejected${updates.ownerResponse.rejectionReason ? `: ${updates.ownerResponse.rejectionReason}` : ''}`,
                    type: "booking_rejected",
                    relatedModel: "Booking",
                    relatedId: booking._id,
                    actionUrl: `/bookings/${booking._id}`,
                    actionLabel: "View Details"
                });
            }
        } else if (newStatus === "Pending") {
            // Update booking response to pending
            booking.ownerResponse = {
                status: newStatus,
                responseDate: new Date(),
                remarks: updates.ownerResponse.remarks || "",
                rejectionReason: undefined
            };
        }

        // Save the booking
        await booking.save();
        
        // Return the updated booking
        const updatedBooking = await Booking.findById(id)
            .populate("bannerUser", "firstName lastName email mobileNumber")
            .populate("hoarding")
            .populate("hoardingOwner", "firstName lastName email mobileNumber")
            .populate("workRequest");

        return res.status(200).json({
            status: 1,
            message: `Booking ${newStatus.toLowerCase()} successfully`,
            data: updatedBooking
        });
    }

    // Handle payment status updates
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
                    transactionId: updates.paymentDetails?.transactionId || `TXN${Date.now()}`,
                    paymentMethod: updates.paymentDetails?.paymentMethod || "Online",
                    paymentDate: new Date(),
                    amount: updates.paymentDetails?.amount || booking.pricing?.totalAmount,
                    status: "Completed"
                };

                // Send payment confirmation notification
                if (typeof notificationTemplates?.payment === 'function') {
                    await sendNotification({
                        userId: booking.hoardingOwner._id,
                        ...notificationTemplates.payment(
                            { model: "Booking", id: booking._id, url: `/bookings/${booking._id}` },
                            booking.pricing?.totalAmount || 0,
                            "Completed"
                        )
                    });
                } else {
                    await sendNotification({
                        userId: booking.hoardingOwner._id,
                        title: "Payment Received",
                        message: `Payment of ₹${booking.pricing?.totalAmount || 0} has been received for booking ${booking.requestNumber}`,
                        type: "payment_received",
                        relatedModel: "Booking",
                        relatedId: booking._id,
                        actionUrl: `/bookings/${booking._id}`,
                        actionLabel: "View Payment"
                    });
                }
            }
        }

        await booking.save();
        
        const updatedBooking = await Booking.findById(id)
            .populate("bannerUser", "firstName lastName email mobileNumber")
            .populate("hoarding")
            .populate("hoardingOwner", "firstName lastName email mobileNumber")
            .populate("workRequest");

        return res.status(200).json({
            status: 1,
            message: "Payment status updated successfully",
            data: updatedBooking
        });
    }

    // Handle work request assignment
    // if (updates.workRequest) {
    //     // Only Banner User can assign work
    //     if (req.user.id !== booking.bannerUser._id.toString() && req.user.userType !== "SuperAdmin") {
    //         return res.status(403).json({
    //             status: 0,
    //             message: "Only Banner User can assign work"
    //         });
    //     }

    //     // Check if booking is approved
    //     if (booking.ownerResponse.status !== "Approved") {
    //         return res.status(400).json({
    //             status: 0,
    //             message: "Cannot assign work to unapproved booking"
    //         });
    //     }

    //     // Check if worker exists
    //     const worker = await User.findById(updates.workRequest.workerId);
    //     if (!worker) {
    //         return res.status(404).json({
    //             status: 0,
    //             message: "Worker not found"
    //         });
    //     }

    //     // Create work assignment
    //     const workRequest = new WorkRequest({
    //         booking: booking._id,
    //         hoarding: booking.hoarding._id,
    //         worker: updates.workRequest.workerId,
    //         assignedBy: req.user.id,
    //         scheduledDate: updates.workRequest.scheduledDate || new Date(),
    //         notes: updates.workRequest.notes || "",
    //         status: "Pending"
    //     });

    //     await workRequest.save();
    //     booking.workRequest = workRequest._id;
    //     await booking.save();

    //     // Send notification to worker
    //     await sendNotification({
    //         userId: updates.workRequest.workerId,
    //         title: "New Work Assignment",
    //         message: `You have been assigned work for booking ${booking.requestNumber}`,
    //         type: "worker_request",
    //         relatedModel: "WorkRequest",
    //         relatedId: workRequest._id,
    //         actionUrl: `/work-assignments/${workRequest._id}`,
    //         actionLabel: "View Assignment"
    //     });

    //     const updatedBooking = await Booking.findById(id)
    //         .populate("bannerUser", "firstName lastName email mobileNumber")
    //         .populate("hoarding")
    //         .populate("hoardingOwner", "firstName lastName email mobileNumber")
    //         .populate("workRequest");

    //     return res.status(200).json({
    //         status: 1,
    //         message: "Work assigned successfully",
    //         data: updatedBooking
    //     });
    // }

    // If no valid updates were provided
    return res.status(400).json({
        status: 0,
        message: "No valid updates provided"
    });
});

// 5. DELETE BOOKING
const deleteBooking = asyncHandler(async (req, res) => {
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

    await syncHoardingStatusIfAvailable(booking.hoarding);

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

// Calculate estimated dates based on queue position and existing bookings
const calculateEstimatedDatesForQueue = async (queue, queueEntries, newBooking = null) => {
    try {
        // Get all approved bookings for this hoarding
        const approvedBookings = await Booking.find({
            hoarding: queue.hoarding,
            "ownerResponse.status": "Approved",
            duration: { $exists: true }
        }).sort({ "duration.startDate": 1 });

        // Find the last approved booking date
        let lastBookedDate = new Date();
        if (approvedBookings.length > 0) {
            const lastBooking = approvedBookings[approvedBookings.length - 1];
            lastBookedDate = new Date(lastBooking.duration.endDate);
            lastBookedDate.setDate(lastBookedDate.getDate() + 1);
        }

        // Sort queue entries by start date
        const sortedEntries = [...queueEntries].sort((a, b) => {
            // Handle entries without start date
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate) - new Date(b.startDate);
        });

        // Calculate estimated dates for each entry
        let currentAvailableDate = new Date(lastBookedDate);

        const entriesWithEstimates = await Promise.all(sortedEntries.map(async (entry, index) => {
            const bookingDetails = await Booking.findById(entry.bookingRequest);

            // Calculate estimated start date based on position
            const estimatedStartDate = new Date(currentAvailableDate);

            // Calculate estimated end date based on requested duration
            let estimatedEndDate = new Date(estimatedStartDate);
            if (bookingDetails && bookingDetails.duration) {
                const requestedDays = bookingDetails.duration.totalDays || 30;
                estimatedEndDate.setDate(estimatedEndDate.getDate() + requestedDays);
            } else {
                // Default 30 days if no duration found
                estimatedEndDate.setDate(estimatedEndDate.getDate() + 30);
            }

            // Update current available date for next entry
            currentAvailableDate = new Date(estimatedEndDate);
            currentAvailableDate.setDate(currentAvailableDate.getDate() + 1);

            return {
                bannerUser: entry.bannerUser,
                bookingRequest: entry.bookingRequest,
                position: index + 1,
                joinDate: entry.joinDate || new Date(),
                status: entry.status || "Waiting",
                estimatedStartDate: estimatedStartDate,
                estimatedEndDate: estimatedEndDate
            };
        }));

        return entriesWithEstimates;
    } catch (error) {
        console.error("Error calculating estimated dates:", error);
        return queueEntries;
    }
};

// Recalculate queue positions after changes
const recalculateQueuePositions = async (queue) => {
    try {
        // Get all queue entries with their booking details
        const entriesWithDetails = await Promise.all(
            queue.queue.map(async (entry) => {
                const bookingDetails = await Booking.findById(entry.bookingRequest);
                return {
                    ...entry.toObject(),
                    startDate: bookingDetails?.duration?.startDate
                };
            })
        );

        // Filter out entries without valid dates and sort by start date
        const validEntries = entriesWithDetails.filter(entry => entry.startDate);
        validEntries.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        // Calculate new positions and estimated dates
        const recalculatedEntries = await calculateEstimatedDatesForQueue(
            queue,
            validEntries
        );

        return recalculatedEntries;
    } catch (error) {
        console.error("Error recalculating queue positions:", error);
        return queue.queue;
    }
};

// Notify users about queue position changes
const notifyQueuePositionChanges = async (queue, excludedBookingId = null, startIndex = 0) => {
    try {
        for (let i = startIndex; i < queue.queue.length; i++) {
            const entry = queue.queue[i];

            // Skip if this is the excluded booking
            if (excludedBookingId && entry.bookingRequest.toString() === excludedBookingId.toString()) {
                continue;
            }

            // Send notification about position change
            await sendNotification({
                userId: entry.bannerUser,
                title: "Queue Position Updated",
                message: `Your queue position has been updated to position ${entry.position}`,
                type: "queue_position_updated",
                relatedModel: "Booking",
                relatedId: entry.bookingRequest,
                actionUrl: `/bookings/${entry.bookingRequest}`,
                actionLabel: "View Booking"
            });
        }
    } catch (error) {
        console.error("Error notifying queue position changes:", error);
    }
};

// Notify next in queue
const notifyNextInQueue = async (queue) => {
    if (queue.queue.length > 0) {
        const nextEntry = queue.queue[0];

        await sendNotification({
            userId: nextEntry.bannerUser,
            title: "You're Next in Queue",
            message: "Your booking is now next in line. The owner will review your request soon.",
            type: "queue_next",
            relatedModel: "Booking",
            relatedId: nextEntry.bookingRequest,
            actionUrl: `/bookings/${nextEntry.bookingRequest}`,
            actionLabel: "View Booking"
        });
    }
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

        // Recalculate positions and estimated dates
        const updatedQueue = await recalculateQueuePositions(queue);
        queue.queue = updatedQueue;

        // Get the next booking in queue (should be position 1 after recalculation)
        if (queue.queue.length > 0) {
            const nextInQueue = queue.queue[0];

            // Update queue with next booking
            queue.currentBooking = nextInQueue.bookingRequest;

            // Remove from queue array
            queue.queue.shift();

            // Recalculate positions for remaining entries
            const remainingEntries = await recalculateQueuePositions(queue);
            queue.queue = remainingEntries;

            await queue.save();

            // Notify banner user that their booking is now active
            await sendNotification({
                userId: nextInQueue.bannerUser,
                title: "Your Booking is Now Active",
                message: "Your booking request has moved to the front of the queue and is now ready for owner approval",
                type: "queue_advanced_to_current",
                relatedModel: "Booking",
                relatedId: nextInQueue.bookingRequest,
                actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
                actionLabel: "View Booking"
            });

            // Notify hoarding owner about new booking to review
            const queueWithHoarding = await Queue.findById(queueId).populate("hoardingOwner");
            if (queueWithHoarding?.hoardingOwner) {
                await sendNotification({
                    userId: queueWithHoarding.hoardingOwner._id,
                    title: "New Booking Ready for Review",
                    message: "A booking request is ready for your review",
                    type: "booking_pending_review",
                    relatedModel: "Booking",
                    relatedId: nextInQueue.bookingRequest,
                    actionUrl: `/bookings/${nextInQueue.bookingRequest}`,
                    actionLabel: "Review Booking"
                });
            }
        }
    } catch (error) {
        console.error("Process next in queue error:", error);
    }
};


// Additional API for worker response
const respondToWorkRequest = asyncHandler(async (req, res) => {
    const { requestId, status, rejectionReason } = req.body;

    const workRequest = await WorkRequest.findById(requestId)
        .populate("bannerUser")
        .populate("worker");

    if (!workRequest) {
        return res.status(404).json({
            status: 0,
            message: "Work assignment not found"
        });
    }

    // Check if user is the assigned worker
    if (workRequest.worker._id.toString() !== req.user.id) {
        return res.status(403).json({
            status: 0,
            message: "Only assigned worker can respond"
        });
    }

    workRequest.workerResponse = {
        status, // "Accepted", "Rejected"
        responseDate: new Date(),
        rejectionReason
    };

    await workRequest.save();

    // Send notification to hoarding owner
    // await sendNotification({
    //     userId: workRequest.bannerUser._id,
    //     title: `Worker ${status} Assignment`,
    //     message: `Worker ${workRequest.worker.firstName} has ${status.toLowerCase()} the work assignment`,
    //     type: status === "Accepted" ? "worker_approved" : "worker_rejected",
    //     relatedModel: "WorkRequest",
    //     relatedId: workRequest._id,
    //     actionUrl: `/work-assignments/${workRequest._id}`,
    //     actionLabel: "View Assignment"
    // });

    // Get booking for banner user notification
    // const booking = await Booking.findById(workRequest.bannerUser._id);
    if (status === "Rejected") {
        // Send notification to banner user to select different worker
        await sendNotification({
            userId: workRequest.bannerUser._id,
            title: "Worker Rejected Assignment",
            message: "The assigned worker has rejected the assignment. Please select a different worker.",
            type: "worker_rejected",
            relatedModel: "Booking",
            relatedId: workRequest.bannerRequest._id,
            actionUrl: `/booking/${workRequest.bannerRequest._id}`,
            actionLabel: "Select New Worker"
        });
    } else if (status === "Accepted") {
        // Send notification to banner user
        await sendNotification({
            userId: workRequest.bannerUser._id,
            title: "Worker Accepted Assignment",
            message: "The assigned worker has accepted the work assignment.",
            type: "worker_approved",
            relatedModel: "WorkRequest",
            relatedId: workRequest._id,
            actionUrl: `/workRequest/${workRequest._id}`,
            actionLabel: "View Assignment"
        });
    }

    res.status(200).json({
        status: 1,
        message: `Work assignment ${status.toLowerCase()} successfully`,
        data: workRequest
    });
});

// get queue status for a hoarding
const getQueueStatus = asyncHandler(async (req, res) => {
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
    respondToWorkRequest,
    getQueueStatus
};