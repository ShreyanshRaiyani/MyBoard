const asyncHandler = require("express-async-handler");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const { sendNotification, notificationTemplates } = require("./notificationController");

//  CREATE HOARDING
const createHoarding = asyncHandler(async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 0,
                message: "Authentication required"
            });
        }

        // Check if user exists and is verified hoardingOwner
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: 0,
                message: "User not found"
            });
        }

        // Check if user is hoardingOwner
        if (user.userType !== "HoardingOwner") {
            return res.status(403).json({
                status: 0,
                message: "Only hoarding owners can create hoardings"
            });
        }

        // Check if user is verified 
        if (user.accountStatus !== "Verified") {
            return res.status(403).json({
                status: 0,
                message: "Only verified users can create hoardings"
            });
        }

        // Generate unique hoarding code
        const generateHoardingCode = async () => {
            const prefix = "HOA";
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const code = `${prefix}${randomNum}`;

            // Check if code already exists
            const existingHoarding = await Hoarding.findOne({ hoardingCode: code });
            if (existingHoarding) {
                return generateHoardingCode(); // Recursively generate new code
            }
            return code;
        };

        // Prepare hoarding data
        const hoardingData = {
            ...req.body,
            owner: req.user.id,
            hoardingCode: await generateHoardingCode(),
            approvalStatus: "Pending", // Initial status
            status: "Inactive" // Initially inactive until approved
        };

        // Create hoarding
        const hoarding = new Hoarding(hoardingData);
        await hoarding.save();

        // Send notification to SuperAdmin for approval
        const superAdmins = await User.find({ userType: "SuperAdmin", isActive: true });

        for (const admin of superAdmins) {
            await sendNotification({
                userId: admin._id,
                title: "New Hoarding Pending Approval",
                message: `A new hoarding "${hoardingData.hoardingName}" has been created and requires approval.`,
                type: "system",
                relatedModel: "Hoarding",
                relatedId: hoarding._id,
                actionUrl: `/admin/hoardings/${hoarding._id}`,
                actionLabel: "Review Hoarding"
            });
        }

        // Send notification to hoarding owner
        await sendNotification({
            userId: req.user.id,
            title: "Hoarding Created Successfully",
            message: `Your hoarding "${hoardingData.hoardingName}" has been created and is pending admin approval.`,
            type: "hoarding_created",
            relatedModel: "Hoarding",
            relatedId: hoarding._id,
            actionUrl: `/hoardings/${hoarding._id}`,
            actionLabel: "View Hoarding"
        });

        // Populate the response
        const populatedHoarding = await Hoarding.findById(hoarding._id)
            .populate("owner", "firstName lastName email mobileNumber")
            .populate("location.city")
            .populate("location.state")
            .populate("location.country");

        res.status(201).json({
            status: 1,
            message: "Hoarding created successfully. Waiting for admin approval.",
            hoarding: populatedHoarding
        });
    } catch (error) {
        // Handle duplicate key error for hoardingCode
        if (error.code === 11000 && error.keyPattern && error.keyPattern.hoardingCode) {
            return res.status(400).json({
                status: 0,
                message: "Hoarding code already exists. Please try again."
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                status: 0,
                message: messages.join(', ')
            });
        }

        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//  GET ALL HOARDINGS
const getAllHoardings = asyncHandler(async (req, res) => {
    try {
        const {
            status,
            approvalStatus,
            city,
            state,
            type,
            minPrice,
            maxPrice,
            owner,
            page = 1,
            limit = 20,
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const query = {};

        // Apply filters if provided
        if (status) query.status = status;
        if (approvalStatus) query.approvalStatus = approvalStatus;
        if (type) query.type = type;
        if (owner) query.owner = owner;

        // Price range filter
        if (minPrice || maxPrice) {
            query.pricePerDay = {};
            if (minPrice) query.pricePerDay.$gte = Number(minPrice);
            if (maxPrice) query.pricePerDay.$lte = Number(maxPrice);
        }

        // Location filters
        if (city) query["location.city"] = city;
        if (state) query["location.state"] = state;

        // Sorting
        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        // Pagination
        const skip = (page - 1) * limit;

        // Execute query with pagination
        const hoardings = await Hoarding.find(query)
            .populate("owner", "firstName lastName email mobileNumber")
            .populate("location.city")
            .populate("location.state")
            .populate("location.country")
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));

        const total = await Hoarding.countDocuments(query);

        res.status(200).json({
            status: 1,
            count: hoardings.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            hoarding: hoardings
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//  GET HOARDING BY ID
const getHoardingById = asyncHandler(async (req, res) => {
    try {
        const hoarding = await Hoarding.findById(req.params.id)
            .populate("owner", "firstName lastName email mobileNumber")
            .populate("location.city")
            .populate("location.state")
            .populate("location.country");

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        res.status(200).json({
            status: 1,
            hoarding: hoarding
        });
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 0,
                message: "Invalid hoarding ID format"
            });
        }

        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//  UPDATE HOARDING
const updateHoarding = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Find the hoarding
        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        // Check if user is the owner
        if (hoarding.owner._id.toString() !== req.user.id) {
            return res.status(403).json({
                status: 0,
                message: "You can only update your own hoardings"
            });
        }

        // Check approval status - only SuperAdmin can update approvalStatus
        if (req.body.approvalStatus && req.user.userType !== "SuperAdmin") {
            return res.status(403).json({
                status: 0,
                message: "Only SuperAdmin can update approval status"
            });
        }

        // If user is SuperAdmin updating approvalStatus
        if (req.user.userType === "SuperAdmin" && req.body.approvalStatus) {
            const { approvalStatus } = req.body;

            // Validate approval status value
            if (!["Pending", "Approved", "Rejected"].includes(approvalStatus)) {
                return res.status(400).json({
                    status: 0,
                    message: "Invalid approval status"
                });
            }

            // If approving, set status to Active
            const updateData = {
                approvalStatus,
                status: approvalStatus === "Approved" ? "Active" : hoarding.status
            };

            const updatedHoarding = await Hoarding.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).populate("owner", "firstName lastName email mobileNumber")
                .populate("location.city")
                .populate("location.state")
                .populate("location.country");

            // Send notification to hoarding owner
            const notificationType = approvalStatus === "Approved"
                ? "hoarding_approved"
                : approvalStatus === "Rejected"
                    ? "hoarding_rejected"
                    : "hoarding_pending";

            await sendNotification({
                userId: hoarding.owner,
                title: `Hoarding ${approvalStatus}`,
                message: `Your hoarding "${hoarding.hoardingName}" has been ${approvalStatus.toLowerCase()}.`,
                type: notificationType,
                relatedModel: "Hoarding",
                relatedId: hoarding._id,
                actionUrl: `/hoardings/${hoarding._id}`,
                actionLabel: "View Hoarding"
            });

            // If rejected, include rejection reason if provided
            if (approvalStatus === "Rejected" && req.body.rejectionReason) {
                await sendNotification({
                    userId: hoarding.owner,
                    title: "Hoarding Rejected - Additional Details",
                    message: `Your hoarding was rejected. Reason: ${req.body.rejectionReason}`,
                    type: "hoarding_rejected_detail",
                    relatedModel: "Hoarding",
                    relatedId: hoarding._id
                });
            }

            // Send notification to all SuperAdmins about the update
            const superAdmins = await User.find({
                userType: "SuperAdmin",
                isActive: true,
                _id: { $ne: req.user.id } // Exclude the admin who made the change
            });

            for (const admin of superAdmins) {
                await sendNotification({
                    userId: admin._id,
                    title: `Hoarding ${approvalStatus} by Admin`,
                    message: `Hoarding "${hoarding.hoardingName}" has been ${approvalStatus.toLowerCase()} by ${req.user.firstName}.`,
                    type: "system",
                    relatedModel: "Hoarding",
                    relatedId: hoarding._id
                });
            }

            return res.status(200).json({
                status: 1,
                message: `Hoarding ${approvalStatus.toLowerCase()} successfully`,
                hoarding: updatedHoarding
            });
        }

        // If user is owner (not SuperAdmin), check conditions for updating
        if (req.user.userType !== "SuperAdmin") {
            // Check if hoarding is approved
            if (hoarding.approvalStatus !== "Approved") {
                return res.status(400).json({
                    status: 0,
                    message: "Cannot update hoarding that is not approved"
                });
            }

            // Check if hoarding status is Inactive
            if (hoarding.status !== "Inactive") {
                return res.status(400).json({
                    status: 0,
                    message: "Can only update hoarding when status is Inactive"
                });
            }

            // If owner is updating approved hoarding, notify SuperAdmins
            if (hoarding.approvalStatus === "Approved") {
                const superAdmins = await User.find({ userType: "SuperAdmin", isActive: true });

                for (const admin of superAdmins) {
                    await sendNotification({
                        userId: admin._id,
                        title: "Hoarding Updated by Owner",
                        message: `Hoarding "${hoarding.hoardingName}" has been updated by the owner.`,
                        type: "system",
                        relatedModel: "Hoarding",
                        relatedId: hoarding._id,
                        actionUrl: `/admin/hoardings/${hoarding._id}`,
                        actionLabel: "Review Changes"
                    });
                }
            }
        }

        // Fields that cannot be updated by owner
        const restrictedFields = [
            "owner",
            "hoardingCode",
            "approvalStatus", // Only SuperAdmin can update
            "isActive",
            "averageRating",
            "totalBookings"
        ];

        // Remove restricted fields for non-SuperAdmin users
        if (req.user.userType !== "SuperAdmin") {
            restrictedFields.forEach(field => {
                if (req.body[field]) {
                    delete req.body[field];
                }
            });
        }

        // Update hoarding
        const updatedHoarding = await Hoarding.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate("owner", "firstName lastName email mobileNumber")
            .populate("location.city")
            .populate("location.state")
            .populate("location.country");

        // Send notification to owner about successful update
        await sendNotification({
            userId: hoarding.owner,
            title: "Hoarding Updated Successfully",
            message: `Your hoarding "${hoarding.hoardingName}" has been updated.`,
            type: "hoarding_updated",
            relatedModel: "Hoarding",
            relatedId: hoarding._id,
            actionUrl: `/hoardings/${hoarding._id}`,
            actionLabel: "View Updated Hoarding"
        });

        res.status(200).json({
            status: 1,
            message: "Hoarding updated successfully",
            hoarding: updatedHoarding
        });
    } catch (error) {
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                status: 0,
                message: messages.join(', ')
            });
        }

        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 0,
                message: "Invalid hoarding ID format"
            });
        }

        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE HOARDING
const deleteHoarding = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Find the hoarding
        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        // Check if user is the owner or SuperAdmin
        const isOwner = hoarding.owner._id.toString() === req.user.id;
        const isSuperAdmin = req.user.userType === "SuperAdmin";

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({
                status: 0,
                message: "You can only delete your own hoardings"
            });
        }

        // Additional check for non-SuperAdmin users
        if (!isSuperAdmin) {
            // Check if hoarding is approved
            if (hoarding.approvalStatus !== "Approved") {
                return res.status(400).json({
                    status: 0,
                    message: "Cannot delete hoarding that is not approved"
                });
            }

            // Check if hoarding status is Inactive
            if (hoarding.status !== "Inactive") {
                return res.status(400).json({
                    status: 0,
                    message: "Can only delete hoarding when status is Inactive"
                });
            }
        }

        // Perform deletion (soft delete by setting isActive to false)
        const deletedHoarding = await Hoarding.findByIdAndUpdate(
            id,
            {
                $set: {
                    isActive: false,
                    status: "Inactive"
                }
            },
            { new: true }
        );

        // Send notification to hoarding owner
        await sendNotification({
            userId: hoarding.owner,
            title: "Hoarding Deleted",
            message: `Your hoarding "${hoarding.hoardingName}" has been deleted.`,
            type: "hoarding_deleted",
            relatedModel: "Hoarding",
            relatedId: hoarding._id
        });

        // If deleted by SuperAdmin, notify owner about admin action
        if (isSuperAdmin && !isOwner) {
            const adminName = req.user.firstName || "Admin";
            await sendNotification({
                userId: hoarding.owner,
                title: "Hoarding Deleted by Admin",
                message: `Your hoarding "${hoarding.hoardingName}" has been deleted by ${adminName}.`,
                type: "hoarding_admin_deleted",
                relatedModel: "Hoarding",
                relatedId: hoarding._id
            });
        }

        // Notify SuperAdmins about the deletion (except the one who deleted)
        if (isSuperAdmin) {
            const otherAdmins = await User.find({
                userType: "SuperAdmin",
                isActive: true,
                _id: { $ne: req.user.id }
            });

            for (const admin of otherAdmins) {
                await sendNotification({
                    userId: admin._id,
                    title: "Hoarding Deleted by Admin",
                    message: `Hoarding "${hoarding.hoardingName}" has been deleted by ${req.user.firstName}.`,
                    type: "system",
                    relatedModel: "Hoarding",
                    relatedId: hoarding._id
                });
            }
        }

        res.status(200).json({
            status: 1,
            message: "Hoarding deleted successfully",
            hoarding: deletedHoarding
        });
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 0,
                message: "Invalid hoarding ID format"
            });
        }

        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// UPDATE HOARDING STATUS (Only for owner - Active/Inactive/Booked)
const updateHoardingStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!["Active", "Inactive", "Booked"].includes(status)) {
            return res.status(400).json({
                status: 0,
                message: "Invalid status. Must be Active, Inactive, or Booked"
            });
        }

        // Find the hoarding
        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        // Check if user is the owner
        if (hoarding.owner._id.toString() !== req.user.id) {
            return res.status(403).json({
                status: 0,
                message: "You can only update status of your own hoardings"
            });
        }

        // Check if hoarding is approved
        if (hoarding.approvalStatus !== "Approved") {
            return res.status(400).json({
                status: 0,
                message: "Cannot update status of unapproved hoarding"
            });
        }

        // Update status
        const updatedHoarding = await Hoarding.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true }
        ).populate("owner", "firstName lastName email mobileNumber");

        // Send notification to owner
        await sendNotification({
            userId: hoarding.owner,
            title: `Hoarding Status Updated to ${status}`,
            message: `Your hoarding "${hoarding.hoardingName}" status has been updated to ${status}.`,
            type: "hoarding_status_updated",
            relatedModel: "Hoarding",
            relatedId: hoarding._id,
            actionUrl: `/hoardings/${hoarding._id}`,
            actionLabel: "View Hoarding"
        });

        res.status(200).json({
            status: 1,
            message: `Hoarding status updated to ${status} successfully`,
            hoarding: updatedHoarding
        });
    } catch (error) {
        console.error("Update hoarding status error:", error);
        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    createHoarding,
    getAllHoardings,
    getHoardingById,
    updateHoarding,
    deleteHoarding,
    updateHoardingStatus
};