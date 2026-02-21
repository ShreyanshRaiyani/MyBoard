const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Hoarding = require("../models/Hoarding");
const User = require("../models/User");
const { sendNotification, notificationTemplates } = require("./notificationController");
const { uploadImageReturnUrl, deleteFromCloudinary } = require('./imageController');
// const { findNearbyPlaces } = require('../middleware/mapplsService');
const { findNearbyOverpass, findNearbyCounts } = require('../middleware/overpassService');

// Helper function to handle multiple image uploads with indexed tracking
const uploadHoardingImages = async (files, req) => {
    const uploadedImages = []; // Changed from {} to []
    const uploadedKeys = [];

    if (files && files.length > 0) {
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const uniqueName = `hoarding_images/${Date.now()}_${Math.random().toString(36).substring(7)}_${file.originalname}`;

            try {
                const uploadRes = await uploadImageReturnUrl(file, uniqueName, { req });

                if (uploadRes && uploadRes.filename) {
                    uploadedImages.push({
                        url: uploadRes.path,
                        publicId: uploadRes.publicId,
                        filename: uploadRes.filename,
                        uploadedAt: new Date()
                    });
                    uploadedKeys.push(uploadRes.publicId);
                }
            } catch (error) {
                console.error(`Error uploading image at index ${index}:`, error);
                // Cleanup previously uploaded images on error
                for (const key of uploadedKeys) {
                    try {
                        await deleteFromCloudinary(key);
                    } catch (delErr) {
                        console.error('Error cleaning up image:', delErr);
                    }
                }
                throw error;
            }
        }
    }

    return { uploadedImages, uploadedKeys };
};

// Helper function to cleanup uploaded images
const cleanupUploadedImages = async (uploadedKeys) => {
    for (const key of uploadedKeys) {
        try {
            await deleteFromCloudinary(key);
        } catch (delErr) {
            console.error('Failed to delete image from Cloudinary:', delErr);
        }
    }
};

// CREATE HOARDING
const createHoarding = asyncHandler(async (req, res) => {

    const uploadedKeys = [];

    try {
        const {
            hoardingName,
            description,
            location,
            dimensions,
            type,
            pricePerDay,
            images: imageUrls
        } = req.body;

        console.log("Received hoarding creation request with body:", req.body);

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                status: 0,
                message: "Authentication required"
            });
        }
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

        // Validate required fields
        if (!hoardingName) {
            return res.status(400).json({
                status: 0,
                message: "Hoarding name is required"
            });
        }

        // Validate location
        if (!location) {
            return res.status(400).json({
                status: 0,
                message: "Location is required"
            });
        }

        // Validate location coordinates or address
        const hasCoordinates = location.coordinates &&
            (location.coordinates.latitude || location.coordinates.longitude);
        const hasAddress = location.address;

        if (!hasCoordinates && !hasAddress) {
            return res.status(400).json({
                status: 0,
                message: "Either location coordinates or address is required"
            });
        }


        console.log("Request body validated successfully");

        // Generate unique hoarding code
        const generateHoardingCode = async () => {
            const prefix = "HOA-";
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
        const dimensionsWithArea = {
            width: Number(dimensions.width),
            height: Number(dimensions.height),
            unit: dimensions.unit,
            area: Number(dimensions.width) * Number(dimensions.height)
        };
        console.log("Calculated dimensions:", dimensionsWithArea);

        let images = [];

        try {
            const imageFiles = [];

            // Check for files from multer (attachImage middleware)
            if (req.uploadedFiles) {
                const fileKeys = Object.keys(req.uploadedFiles).filter(key => key.startsWith('images['));

                // Sort them to maintain order (images[0], images[1], etc.)
                fileKeys.sort((a, b) => {
                    const indexA = parseInt(a.match(/\[(\d+)\]/)[1]);
                    const indexB = parseInt(b.match(/\[(\d+)\]/)[1]);
                    return indexA - indexB;
                });

                // Collect files in order
                for (const key of fileKeys) {
                    const file = req.uploadedFiles[key];
                    if (Array.isArray(file)) {
                        imageFiles.push(...file);
                    } else if (file) {
                        imageFiles.push(file);
                    }
                }
            }

            if (imageFiles.length > 0) {
                console.log(`Found ${imageFiles.length} image files to upload`);
                const { uploadedImages, uploadedKeys: keys } = await uploadHoardingImages(imageFiles, req);

                // Map the uploaded images array to match your schema
                images = uploadedImages.map((img, index) => ({
                    url: img.url,
                    caption: `Hoarding Image ${index + 1}`,
                    publicId: img.publicId,
                    filename: img.filename,
                    uploadedAt: img.uploadedAt
                }));

                uploadedKeys.push(...keys);

            } else if (imageUrls) {
                // If images are provided as URLs (from frontend)
                if (Array.isArray(imageUrls)) {
                    images = imageUrls.map((url, index) => ({
                        url: url,
                        caption: `Hoarding Image ${index + 1}`
                    }));
                } else {
                    images = [{
                        url: imageUrls,
                        caption: "Hoarding Image"
                    }];
                }
            }

            console.log(`Processed ${images.length} images:`, images);

        } catch (uploadErr) {
            console.error('Failed to upload hoarding images:', uploadErr);
            // Cleanup any uploaded images
            await cleanupUploadedImages(uploadedKeys);
            return res.status(400).json({
                status: 0,
                message: "Failed to upload images"
            });
        }

        // Prepare hoarding data with proper location structure based on model
        const hoardingData = {
            owner: req.user.id,
            hoardingName,
            hoardingCode: await generateHoardingCode(),
            description,
            location: {
                address: location.address || null,
                area: location.area || null,
                city: location.city || null,
                state: location.state || null,
                country: location.country || null,
                pincode: location.pincode || null,
                coordinates: {
                    latitude: location.coordinates?.latitude || null,
                    longitude: location.coordinates?.longitude || null
                }
            },
            dimensions: dimensionsWithArea,
            type,
            images: images,
            pricePerDay: Number(pricePerDay),
            status: "Inactive",
            approvalStatus: "Pending",
            isActive: true,
            averageFeedback: 0,
            totalBookings: 0
        };

        console.log("Creating hoarding with data:", hoardingData);

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


        // Fetch the created hoarding with populated fields
        const populatedHoarding = await Hoarding.findById(hoarding._id)

        res.status(201).json({
            status: 1,
            message: "Hoarding created successfully. Waiting for admin approval.",
            hoarding: populatedHoarding
        });

    } catch (error) {
        // Cleanup uploaded images on error
        await cleanupUploadedImages(uploadedKeys);

        // Handle duplicate key error for hoardingCode
        if (error.code === 11000 && error.keyPattern && error.keyPattern.hoardingCode) {
            return res.status(400).json({
                status: 0,
                message: "Hoarding code already exists. Please try again."
            });
        }

        // Handle CastError for invalid ObjectIds
        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 0,
                message: `Invalid ${error.path}: ${error.value}`
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

        console.error("Hoarding creation error:", error);

        res.status(500).json({
            status: 0,
            message: "Server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET nearby POIs for a hoarding (radius in meters)
const getNearbyPOIs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const radius = parseInt(req.query.radius) || 1000;
    const categories = (req.query.categories && req.query.categories.split(',')) || ['hospital', 'traffic_signal', 'mall', 'busstand', 'landmark'];

    const hoarding = await Hoarding.findById(id);
    if (!hoarding) {
        return res.status(404).json({ status: 0, message: 'Hoarding not found' });
    }

    const lat = hoarding.location?.coordinates?.latitude;
    const lon = hoarding.location?.coordinates?.longitude;

    if (!lat || !lon) {
        return res.status(400).json({ status: 0, message: 'Hoarding does not have coordinates' });
    }

    try {

        // Final fallback: Overpass (OpenStreetMap)
        try {
            // Fast parallel counts
            const counts = await findNearbyCounts(lat, lon, radius, categories);

            // Only fetch detailed items for landmarks (if requested)
            let landmarkItems = [];
            if (categories.map(c => String(c).toLowerCase()).includes('landmark')) {
                // fetch detailed landmarks (limited)
                try {
                    const overpassLand = await findNearbyOverpass(lat, lon, radius, ['landmark']);
                    landmarkItems = (overpassLand.results && overpassLand.results.landmark) ? overpassLand.results.landmark.slice(0, 20) : overpassLand.suggestions || [];
                } catch (landErr) {
                    console.warn('Landmark detail fetch failed:', landErr.message || landErr);
                }
            }

            return res.status(200).json({
                status: 1,
                hoardingId: id,
                coordinates: { lat, lon },
                radius,
                counts,
                landmark: {
                    count: counts.landmark || landmarkItems.length || 0,
                    items: landmarkItems
                }
            });
        } catch (ovErr) {
            console.error('Overpass fallback failed:', ovErr);
            return res.status(500).json({ status: 0, message: 'Failed to fetch nearby places from any provider' });
        }
    } catch (err) {
        console.error('Nearby POI error:', err);
        res.status(500).json({ status: 0, message: 'Failed to fetch nearby places' });
    }
});

// UPDATE HOARDING (Includes approval status update for SuperAdmin and status update for owner)
const updateHoarding = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Track uploaded image keys for potential rollback
    const uploadedKeys = [];
    let oldImages = [];

    try {
        // Find the hoarding
        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        // Save old images for potential deletion after successful update
        oldImages = hoarding.images || [];

        // Check if user is the owner or SuperAdmin
        const isOwner = hoarding.owner._id.toString() === req.user.id;
        const isSuperAdmin = req.user.userType === "SuperAdmin";

        if (!isOwner && !isSuperAdmin) {
            return res.status(403).json({
                status: 0,
                message: "You don't have permission to update this hoarding"
            });
        }

        const updateData = {};

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

            // Check if hoarding status is Inactive for detail updates
            if (req.body.hoardingName || req.body.description || req.body.location ||
                req.body.dimensions || req.body.type || req.uploadedFiles || req.body.images || req.body.pricePerDay) {

                if (hoarding.status !== "Inactive") {
                    // Cleanup any uploaded images if status is not Inactive
                    await cleanupUploadedImages(uploadedKeys);

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
                    updateData.dimensions = req.body.dimensions;
                }

                // Handle image uploads
                try {
                    if (req.uploadedFiles) {
                        const fileKeys = Object.keys(req.uploadedFiles).filter(key => key.startsWith('images['));

                        if (fileKeys.length > 0) {
                            // Sort to maintain order
                            fileKeys.sort((a, b) => {
                                const indexA = parseInt(a.match(/\[(\d+)\]/)[1]);
                                const indexB = parseInt(b.match(/\[(\d+)\]/)[1]);
                                return indexA - indexB;
                            });

                            const files = fileKeys.map(key => req.uploadedFiles[key]).flat();
                            const { uploadedImages, uploadedKeys: keys } = await uploadHoardingImages(files, req);

                            updateData.images = uploadedImages.map((img, index) => ({
                                url: img.url,
                                caption: `Hoarding Image ${index + 1}`,
                                publicId: img.publicId,
                                filename: img.filename,
                                uploadedAt: img.uploadedAt
                            }));

                            uploadedKeys.push(...keys);
                        }
                    } else if (req.body.images !== undefined) {
                        // If images array is provided (could be empty array or new array of URLs)
                        const newImages = [];
                        if (Array.isArray(req.body.images)) {
                            const result = req.body.images.map((url, index) => ({
                                url: url,
                                caption: `Hoarding Image ${index + 1}`,
                                uploadedAt: new Date()
                            }));
                            updateData.images = result;
                        } else if (req.body.images) {
                            updateData.images = [{
                                url: req.body.images,
                                caption: "Hoarding Image",
                                uploadedAt: new Date()
                            }];
                        }
                    }
                } catch (uploadErr) {
                    console.error('Failed to upload hoarding images during update:', uploadErr);
                    // Cleanup any uploaded images
                    await cleanupUploadedImages(uploadedKeys);
                    return res.status(400).json({
                        status: 0,
                        message: "Failed to upload images"
                    });
                }

                // Copy other allowed fields to updateData
                const allowedFields = [
                    "hoardingName", "description", "location", "type", "pricePerDay"
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
            // Cleanup any uploaded images if no updates
            await cleanupUploadedImages(uploadedKeys);

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

        // After successful update, delete old images if they were replaced
        if (updateData.images && Array.isArray(oldImages) && oldImages.length > 0) {
            const oldImageUrls = oldImages.map(img => img.url);
            const newImageUrls = updateData.images.map(img => img.url);

            for (const oldImage of oldImages) {
                // Only delete if the old image is not in the new images
                if (!newImageUrls.includes(oldImage.url) && oldImage.publicId) {
                    try {
                        await deleteFromCloudinary(oldImage.publicId);
                    } catch (delErr) {
                        console.error('Failed to delete old image from Cloudinary after update:', delErr);
                    }
                }
            }
        }

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
        // Cleanup any uploaded images on error
        await cleanupUploadedImages(uploadedKeys);

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

// DELETE HOARDING (Soft delete with image cleanup)
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

// PERMANENT DELETE HOARDING (Admin only - with image cleanup)
const permanentDeleteHoarding = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Only SuperAdmin can permanently delete
        if (req.user.userType !== "SuperAdmin") {
            return res.status(403).json({
                status: 0,
                message: "Only SuperAdmin can permanently delete hoardings"
            });
        }

        const hoarding = await Hoarding.findById(id);

        if (!hoarding) {
            return res.status(404).json({
                status: 0,
                message: "Hoarding not found"
            });
        }

        // Delete images from Cloudinary before permanent deletion
        if (hoarding.images && Array.isArray(hoarding.images) && hoarding.images.length > 0) {
            for (const imageObj of hoarding.images) {
                try {
                    if (imageObj.publicId) {
                        await deleteFromCloudinary(imageObj.publicId);
                    }
                } catch (delErr) {
                    console.error('Failed to delete image from Cloudinary during permanent delete:', delErr);
                }
            }
        }

        // Permanently delete from database
        await Hoarding.findByIdAndDelete(id);

        res.status(200).json({
            status: 1,
            message: "Hoarding permanently deleted successfully"
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

// GET ALL HOARDINGS (unchanged)
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

// GET HOARDING BY ID (unchanged)
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

// GET HOARDINGS BY OWNER (unchanged)
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
    permanentDeleteHoarding,
    getHoardingsByOwner,
    getNearbyPOIs
};