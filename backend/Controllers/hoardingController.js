const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const { sendNotification, notificationTemplates } = require("./notificationController");

// CREATE HOARDING
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
                return generateHoardingCode();
            }
            return code;
        };

        // Calculate area if dimensions are provided
        const dimensions = { ...req.body.dimensions };
        if (dimensions.width && dimensions.height) {
            dimensions.area = dimensions.width * dimensions.height;
        }

        // Prepare hoarding data
        const hoardingData = {
            owner: req.user.id,
            hoardingName: req.body.hoardingName,
            hoardingCode: await generateHoardingCode(),
            description: req.body.description,
            location: {
                address: req.body.location.address,
                city: req.body.location.city,
                state: req.body.location.state,
                country: req.body.location.country,
                pincode: req.body.location.pincode,
                coordinates: {
                    latitude: req.body.location.coordinates?.latitude,
                    longitude: req.body.location.coordinates?.longitude
                }
            },
            dimensions: dimensions,
            type: req.body.type,
            images: req.body.images || [],
            pricePerDay: req.body.pricePerDay,
            status: "Inactive",
            approvalStatus: "Pending",
            isActive: true,
            averageRating: 0,
            totalBookings: 0
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

        res.status(201).json({
            status: 1,
            message: "Hoarding created successfully. Waiting for admin approval.",
            hoarding: hoarding
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

// GET ALL HOARDINGS
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
            isActive,
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
        if (isActive !== undefined) query.isActive = isActive === 'true';

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
            hoardings: hoardings
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET HOARDING BY ID
const getHoardingById = asyncHandler(async (req, res) => {
    try {
        const hoarding = await Hoarding.findById(req.params.id);

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

// UPDATE HOARDING (Includes approval status update for SuperAdmin and status update for owner)
const updateHoarding = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

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
                message: "You don't have permission to update this hoarding"
            });
        }

        // --- SUPERADMIN UPDATES (Approval Status) ---
        if (isSuperAdmin && req.body.approvalStatus) {
            const { approvalStatus } = req.body;

            // Validate approval status value
            if (!["Pending", "Approved", "Rejected"].includes(approvalStatus)) {
                return res.status(400).json({
                    status: 0,
                    message: "Invalid approval status. Must be Pending, Approved, or Rejected"
                });
            }

            updateData.approvalStatus = approvalStatus;
            
            // If approving, set status to Active
            if (approvalStatus === "Approved") {
                updateData.status = "Active";
            }

            // Send notification to hoarding owner
            await sendNotification({
                userId: hoarding.owner,
                title: `Hoarding ${approvalStatus}`,
                message: `Your hoarding "${hoarding.hoardingName}" has been ${approvalStatus.toLowerCase()}.`,
                type: `hoarding_${approvalStatus.toLowerCase()}`,
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

            // Notify other SuperAdmins
            const otherAdmins = await User.find({
                userType: "SuperAdmin",
                isActive: true,
                _id: { $ne: req.user.id }
            });

            for (const admin of otherAdmins) {
                await sendNotification({
                    userId: admin._id,
                    title: `Hoarding ${approvalStatus} by Admin`,
                    message: `Hoarding "${hoarding.hoardingName}" has been ${approvalStatus.toLowerCase()} by ${req.user.firstName || 'Admin'}.`,
                    type: "system",
                    relatedModel: "Hoarding",
                    relatedId: hoarding._id
                });
            }
        }

        // --- OWNER UPDATES (Hoarding Details & Status) ---
        if (isOwner) {
            // Check if hoarding is approved before allowing updates
            if (hoarding.approvalStatus !== "Approved") {
                return res.status(400).json({
                    status: 0,
                    message: "Cannot update hoarding that is not approved"
                });
            }

            // Handle STATUS update (Active/Inactive/Booked)
            if (req.body.status) {
                const { status } = req.body;
                
                // Validate status
                if (!["Active", "Inactive", "Booked"].includes(status)) {
                    return res.status(400).json({
                        status: 0,
                        message: "Invalid status. Must be Active, Inactive, or Booked"
                    });
                }

                updateData.status = status;
            }

            // Handle HOARDING DETAILS update
            // Check if hoarding status is Inactive for detail updates
            if (req.body.hoardingName || req.body.description || req.body.location || 
                req.body.dimensions || req.body.type || req.body.images || req.body.pricePerDay) {
                
                if (hoarding.status !== "Inactive") {
                    return res.status(400).json({
                        status: 0,
                        message: "Can only update hoarding details when status is Inactive"
                    });
                }

                // Calculate area if dimensions are being updated
                if (req.body.dimensions) {
                    const { width, height } = req.body.dimensions;
                    if (width && height) {
                        req.body.dimensions.area = width * height;
                    }
                }

                // Copy allowed fields to updateData
                const allowedFields = [
                    "hoardingName", "description", "location", "dimensions", 
                    "type", "images", "pricePerDay"
                ];

                allowedFields.forEach(field => {
                    if (req.body[field] !== undefined) {
                        updateData[field] = req.body[field];
                    }
                });

                // Notify SuperAdmins about detail updates
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

        // If no updates to perform
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                status: 0,
                message: "No valid fields to update"
            });
        }

        // Perform the update
        const updatedHoarding = await Hoarding.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        // Send notification to owner about successful update (if not already sent for approval)
        if (isOwner && !req.body.approvalStatus) {
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
        }

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

// DELETE HOARDING (Soft delete)
const deleteHoarding = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }
        
        if (hoarding.isDeleted) {
            return res.status(400).json({
                status: 0,
                message: "Hoarding is already deleted"
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

        // Perform proper soft deletion using the dedicated fields
        const deletedHoarding = await Hoarding.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: true,           
                    deletedAt: new Date(),      
                    deletedBy: req.user.id,     
                    isActive: false,           
                    status: "Inactive"      
                }
            },
            { new: true }
        ).populate("owner", "firstName lastName email mobileNumber")
         .populate("location.city")
         .populate("location.state")
         .populate("location.country");

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

// GET HOARDINGS BY OWNER
const getHoardingsByOwner = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 20, status, approvalStatus } = req.query;
        
        const query = { owner: req.user.id };
        
        if (status) query.status = status;
        if (approvalStatus) query.approvalStatus = approvalStatus;
        
        const skip = (page - 1) * limit;
        
        const hoardings = await Hoarding.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
            
        const total = await Hoarding.countDocuments(query);
        
        res.status(200).json({
            status: 1,
            count: hoardings.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            hoardings: hoardings
        });
    } catch (error) {
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
    getHoardingsByOwner
};