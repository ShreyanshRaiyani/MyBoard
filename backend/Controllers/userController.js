const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const generateToken = require('../middleware/generatetoken');
const { uploadImageReturnUrl, deleteFromS3 } = require("./imageController");
const path = require("path");
const Device = require("../models/Device");
const {sendResetPasswordEmail} = require('../middleware/sendmail')

const signUp = asyncHandler(async (req, res) => {
    try {
        console.log("SignUp request body:", req.body);

        const {
            firstName,
            lastName,
            email,
            mobileNumber,
            userType,
            birthDate,
            alternateMobileNumber,
            whatsappNumber,
            phone_code,
            iso_code,
            memberId,
            address,
            business,
            gstNumber,
            // Worker specific fields
            workerType,
            experience,
            skills,
            // Plan
            plan,
            password,
        } = req.body;

        // 1. Validation
        if (!firstName || !email || !mobileNumber || !userType) {
            return res.status(200).json({
                Status: 0,
                Message:
                    "Please provide all required fields: firstName, email, mobileNumber, userType",
            });
        }

        // Validate userType
        const validUserTypes = [
            "SuperAdmin",
            "HoardingOwner",
            "BannerUser",
            "Worker",
        ];
        if (!validUserTypes.includes(userType)) {
            return res.status(200).json({
                Status: 0,
                Message: `Invalid userType. Must be one of: ${validUserTypes.join(", ")}`,
            });
        }

        // Check for existing user
        const existingUser = await User.findOne({
            $or: [{ email }, { mobileNumber }],
        });

        if (existingUser) {
            return res.status(200).json({
                Status: 0,
                Message: "User with this email or mobile number already exists",
            });
        }

        // 3. Handle password for SuperAdmin
        let hashedPassword = null;
        let otp = null;

        if (userType === "SuperAdmin") {
            if (!password) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Password is required for SuperAdmin",
                });
            }

            if (password.length < 6) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Password must be at least 6 characters long",
                });
            }

            hashedPassword = await bcrypt.hash(password, 10);
        } else {
            // Generate OTP for non-SuperAdmin users
            otp = Math.floor(1000 + Math.random() * 9000);
            console.log("OTP", otp)
            console.log(`OTP for ${mobileNumber}: ${otp}`);
            // In production: send OTP via SMS/Email
        }

        // 4. Prepare user data
        const userData = {
            firstName,
            lastName,
            email,
            mobileNumber,
            userType,
            birthDate: birthDate ? new Date(birthDate) : undefined,
            alternateMobileNumber,
            whatsappNumber,
            phone_code: phone_code || "+91",
            iso_code: iso_code || "IN",
            memberId,
            address,
            business,
            gstNumber,
            workerType,
            experience,
            skills,
            plan: plan ? mongoose.Types.ObjectId(plan) : undefined,
            accountStatus: userType === "SuperAdmin" ? "Verified" : "Pending",
            emailverified: userType === "SuperAdmin" ? true : false,
        };

        // Add password or OTP based on user type
        if (userType === "SuperAdmin") {
            userData.password = hashedPassword;
        } else {
            userData.otp = otp;
        }

        // Create user
        const user = await User.create(userData);

        // Generate JWT token
        let token = null;
        if (userType === "SuperAdmin") {
            token = generateToken(user._id, user.userType);
        }

        // Remove sensitive data from response
        const userResponse = user.toJSON();

        // Send response
        res.status(201).json({
            Status: 1,
            Message:
                userType === "SuperAdmin"
                    ? "SuperAdmin registered successfully"
                    : "User registered successfully. OTP sent for verification.",
            data: {
                user: userResponse,
                token: token || undefined,
            },
        });
    } catch (error) {
        console.error("SignUp error:", error);

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(200).json({
                Status: 0,
                Message: `${field} already exists`,
            });
        }

        res.status(500).json({
            Status: 0,
            Message: "Server error during signup",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const login = asyncHandler(async (req, res) => {
    try {
        console.log("Login request body:", req.body);

        const { email, mobileNumber, password, otp } = req.body;


        // Validate input
        if (!email) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide email",
            });
        }

        // Find user
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // Check user status
        if (user.userStatus === "Inactive") {
            return res.status(200).json({
                Status: 0,
                Message: "Account is inactive. Please contact support.",
            });
        }

        if (email && !password) {
            const otp = Math.floor(1000 + Math.random() * 9000);
            const verification = "confirm your email";
            await sendResetPasswordEmail(email, otp, verification, user, req);
            user.otp = otp;
            user.emailverified = false;
            await user.save();
        }

        if (email && password) {
            const isPasswordCorrect = await bcrypt.compare(password, user.password)
            if (!isPasswordCorrect) {
                return res.status.json({
                    Status: 0,
                    Message: "Your PassWord is Worng"
                })
            }
        }

        const populateuser = await User.findById(user.id).select("-emailverified")


        // Remove sensitive data
        Object.keys(populateuser).forEach((key) => {
            if (populateuser[key] === null || populateuser[key] == undefined)
                delete populateuser[key]
        })

        res.status(200).json({
            Status: 1,
            Message: "Login successful",
            data: {
                user: populateuser,
                token: generateToken(user._id, user.userType),
                userType: user.userType,
                accountStatus: user.accountStatus,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Server error during login",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const verifyOTP = asyncHandler(async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(200).json({
                Status: 0,
                Message: "Email and OTP are required"
            });
        }

        const user = await User.findOne({ email }).select('+otp');

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found"
            });
        }

        console.log("Verifying OTP:", { providedOtp: otp, userOtp: user.otp });
        if (user.otp !== otp) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid OTP"
            });
        }

        // Update user
        user.emailverified = true;
        user.otp = null; // Clear OTP after successful verification
        await user.save();

        // Generate new token
        const userToken = generateToken(user._id);

        // Fetch user without sensitive data
        const populatedUser = await User.findById(user._id)
            .select('-password -otp -resettoken -resettokentime')
            .exec();

        return res.status(200).json({
            Status: 1,
            Message: "Email verified successfully",
            user: populatedUser,
            UserToken: userToken
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({
            Status: 0,
            Message: "Server error during OTP verification"
        });
    }
});

const resendOTP = asyncHandler(async (req, res) => {
    try {
        const { email, mobileNumber } = req.body;

        // Find user by email or mobile number
        let query = {};
        if (email) {
            query.email = email;
        } else if (mobileNumber) {
            query.mobileNumber = mobileNumber;
        } else {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide email or mobile number",
            });
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // SuperAdmin doesn't use OTP
        if (user.userType === "SuperAdmin") {
            return res.status(200).json({
                Status: 0,
                Message: "SuperAdmin does not use OTP verification",
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        user.otp = otp;
        await user.save();

        console.log(`New OTP for ${mobileNumber || email}: ${otp}`);
        // In production: Send OTP via SMS/Email

        res.status(200).json({
            Status: 1,
            Message: "OTP sent successfully",
            otp, // For testing only - remove in production
        });
    } catch (error) {
        console.error("Resend OTP error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to resend OTP",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const getAllUsers = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            userType,
            userStatus,
            accountStatus,
            search,
        } = req.query;

        const filter = {};

        // Apply filters
        if (userType) filter.userType = userType;
        if (userStatus) filter.userStatus = userStatus;
        if (accountStatus) filter.accountStatus = accountStatus;

        // Search functionality
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { mobileNumber: { $regex: search, $options: "i" } },
                { memberId: { $regex: search, $options: "i" } },
            ];
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
        };

        // Using paginate if plugin is installed, otherwise use find
        if (User.paginate) {
            const users = await User.paginate(filter, options);

            res.status(200).json({
                Status: 1,
                data: {
                    totalUsers: users.totalDocs,
                    totalPages: users.totalPages,
                    currentPage: users.page,
                    users: users.docs,
                },
            });
        } else {
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const users = await User.find(filter)
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 });

            const totalUsers = await User.countDocuments(filter);

            res.status(200).json({
                Status: 1,
                data: {
                    totalUsers,
                    totalPages: Math.ceil(totalUsers / parseInt(limit)),
                    currentPage: parseInt(page),
                    users,
                },
            });
        }
    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to fetch users",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const getUserById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .populate("address.city")
            .populate("address.state")
            .populate("address.country")
            .populate("plan");

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        res.status(200).json({
            Status: 1,
            data: user,
        });
    } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to fetch user",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const updateUser = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Find user to update
        const user = await User.findById(id);
        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // Find current user making the request
        const currentUser = await User.findById(req.user.userId);
        if (!currentUser) {
            return res.status(200).json({
                Status: 0,
                Message: "Authentication required",
            });
        }

        const isSuperAdmin = currentUser.userType === "SuperAdmin";
        const isWorker = currentUser.userType === "Worker";
        const isUpdatingSelf = currentUser._id.toString() === id;

        // Restrict sensitive fields based on user type
        delete updates.email;
        delete updates.otp;
        delete updates.resettoken;
        delete updates.resettokentime;
        delete updates.userType; // Only SuperAdmin should be able to change this

        // Allow accountStatus update only for SuperAdmin
        if (!isSuperAdmin) {
            delete updates.accountStatus;
        }

        // Check permissions for worker-specific fields
        const canUpdateWorkerFields = isSuperAdmin || (isWorker && isUpdatingSelf);

        // If non-SuperAdmin/Worker is trying to update worker fields, remove them
        if (!canUpdateWorkerFields) {
            delete updates.workerType;
            delete updates.experience;
            delete updates.skills;
            delete updates.availability;
            delete updates.averageRating;
            delete updates.totalRatings;
        }

        // Only SuperAdmin can update these sensitive fields
        if (!isSuperAdmin) {
            delete updates.averageRating;
            delete updates.totalRatings;
        }

        // Only assign default plan if user is verified
        if (user.accountStatus === 'Verified') {
            if (user.userType === 'HoardingOwner' || user.userType === 'BannerUser') {
                const defaultPlan = await Plan.findOne({
                    default: true,
                    applicableUserTypes: user.userType // Plan must be applicable to this user type
                });

                if (defaultPlan) {
                    user.plan = defaultPlan._id;
                    console.log(`Assigned ${defaultPlan.name} to ${user.userType} user`);
                }
            }
        }
        // Handle image uploads
        const uploadedFiles = req.uploadedFiles || {};
        const toUpload = [];
        const filesToDelete = [];

        // Profile Picture 
        if (uploadedFiles.profilepic) {
            // User must be updating their own profile or be SuperAdmin
            if (!isUpdatingSelf && !isSuperAdmin) {
                return res.status(200).json({
                    Status: 0,
                    Message: "You can only update your own profile picture",
                });
            }

            toUpload.push({
                key: "profilepic",
                file: uploadedFiles.profilepic,
                prefix: "profile",
            });
            // Store old file for deletion
            if (user.profilepic && user.profilepic !== "generaluserpic.png") {
                filesToDelete.push(user.profilepic);
            }
        }

        // GST Certificate
        if (uploadedFiles.gstCertificate) {

            // User must be updating their own documents or be SuperAdmin
            if (!isUpdatingSelf && !isSuperAdmin) {
                return res.status(200).json({
                    Status: 0,
                    Message: "You can only update your own documents",
                });
            }

            toUpload.push({
                key: "gst_certificate",
                file: uploadedFiles.gstCertificate,
                prefix: "gst",
            });
            if (user.gst_certificate) {
                filesToDelete.push(user.gst_certificate);
            }
        }

        // Aadhar Front & Back (for HoardingOwner - only HoardingOwner can update their own)
        if (uploadedFiles.aadharFront) {
            if (!isUpdatingSelf && !isSuperAdmin) {
                return res.status(200).json({
                    Status: 0,
                    Message: "You can only update your own documents",
                });
            }

            toUpload.push({
                key: "aadharFront",
                file: uploadedFiles.aadharFront,
                prefix: "aadhar_front",
            });
            if (user.aadharFront) {
                filesToDelete.push(user.aadharFront);
            }
        }

        if (uploadedFiles.aadharBack) {

            if (!isUpdatingSelf && !isSuperAdmin) {
                return res.status(200).json({
                    Status: 0,
                    Message: "You can only update your own documents",
                });
            }

            toUpload.push({
                key: "aadharBack",
                file: uploadedFiles.aadharBack,
                prefix: "aadhar_back",
            });
            if (user.aadharBack) {
                filesToDelete.push(user.aadharBack);
            }
        }

        // PAN Card (for HoardingOwner - only HoardingOwner can update their own)
        if (uploadedFiles.panCard) {

            if (!isUpdatingSelf && !isSuperAdmin) {
                return res.status(200).json({
                    Status: 0,
                    Message: "You can only update your own documents",
                });
            }

            toUpload.push({
                key: "panimage",
                file: uploadedFiles.panCard,
                prefix: "pan",
            });
            if (user.panimage) {
                filesToDelete.push(user.panimage);
            }
        }

        // Perform uploads
        if (toUpload.length > 0) {
            const uploadedResults = {};

            for (const entry of toUpload) {
                if (!entry || !entry.file) continue;

                try {
                    const originalName =
                        entry.file.originalname || `${entry.prefix}_${Date.now()}`;
                    const folder = "users";
                    const s3name = `${folder}/${Date.now()}_${originalName}`;

                    const uploadResult = await uploadImageReturnUrl(entry.file, s3name, {
                        req,
                    });

                    if (uploadResult && uploadResult.path) {
                        uploadedResults[entry.key] = uploadResult.path;
                    }
                } catch (uploadError) {
                    console.error(`Upload failed for ${entry.key}:`, uploadError);
                }
            }

            // Apply uploaded paths to updates
            if (uploadedResults.profilepic) {
                updates.profilepic = uploadedResults.profilepic;
            }
            if (uploadedResults.gst_certificate) {
                updates.gst_certificate = uploadedResults.gst_certificate;
            }
            if (uploadedResults.aadharFront) {
                updates.aadharFront = uploadedResults.aadharFront;
            }
            if (uploadedResults.aadharBack) {
                updates.aadharBack = uploadedResults.aadharBack;
            }
            if (uploadedResults.panimage) {
                updates.panimage = uploadedResults.panimage;
            }
        }

        // Convert date strings
        if (updates.birthDate) {
            updates.birthDate = new Date(updates.birthDate);
        }

        // Handle address updates
        if (updates.address) {
            // If address is an object with nested fields
            if (typeof updates.address === "object") {
                // Create or update address object
                user.address = user.address || {};

                // Update individual address fields
                if (updates.address.country) {
                    user.address.country = mongoose.Types.ObjectId(
                        updates.address.country,
                    );
                }
                if (updates.address.state) {
                    user.address.state = mongoose.Types.ObjectId(updates.address.state);
                }
                if (updates.address.city) {
                    user.address.city = mongoose.Types.ObjectId(updates.address.city);
                }
                if (updates.address.street !== undefined) {
                    user.address.street = updates.address.street;
                }
                if (updates.address.pincode !== undefined) {
                    user.address.pincode = updates.address.pincode;
                }

                // Remove address from updates since we're handling it separately
                delete updates.address;
            }
        }

        // Handle skills array (if provided as comma-separated string or array)
        if (updates.skills !== undefined && canUpdateWorkerFields) {
            if (typeof updates.skills === "string") {
                // Convert comma-separated string to array
                updates.skills = updates.skills
                    .split(",")
                    .map((skill) => skill.trim())
                    .filter((skill) => skill);
            } else if (Array.isArray(updates.skills)) {
                // Ensure all skills are strings
                updates.skills = updates.skills
                    .map((skill) => String(skill).trim())
                    .filter((skill) => skill);
            }
        }

        // Handle plan ObjectId conversion
        if (updates.plan) {
            updates.plan = mongoose.Types.ObjectId(updates.plan);
        }

        // Handle validation for enum fields (only if being updated by authorized user)
        if (updates.workerType !== undefined && canUpdateWorkerFields) {
            if (
                !["Installation", "Maintenance", "Removal", "All"].includes(
                    updates.workerType,
                )
            ) {
                return res.status(200).json({
                    Status: 0,
                    Message:
                        "Invalid workerType. Must be one of: Installation, Maintenance, Removal, All",
                });
            }
        }

        if (updates.availability !== undefined && canUpdateWorkerFields) {
            if (
                !["Available", "Busy", "Unavailable"].includes(updates.availability)
            ) {
                return res.status(200).json({
                    Status: 0,
                    Message:
                        "Invalid availability. Must be one of: Available, Busy, Unavailable",
                });
            }
        }

        // Add validation for accountStatus (only if SuperAdmin is updating it)
        if (updates.accountStatus !== undefined && isSuperAdmin) {
            if (!["Active", "Inactive", "Suspended", "Pending"].includes(updates.accountStatus)) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Invalid accountStatus. Must be one of: Active, Inactive, Suspended, Pending",
                });
            }
        }

        if (updates.userStatus !== undefined && isSuperAdmin) {
            if (!["Active", "Inactive"].includes(updates.userStatus)) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Invalid userStatus. Must be one of: Active, Inactive",
                });
            }
        }

        // Validate experience if provided and authorized
        if (updates.experience !== undefined && canUpdateWorkerFields) {
            const experienceNum = parseInt(updates.experience);
            if (isNaN(experienceNum) || experienceNum < 0) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Experience must be a positive number",
                });
            }
            updates.experience = experienceNum;
        }

        // Validate rating fields if being updated (only by SuperAdmin)
        if (updates.averageRating !== undefined && isSuperAdmin) {
            const rating = parseFloat(updates.averageRating);
            if (isNaN(rating) || rating < 0 || rating > 5) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Average rating must be between 0 and 5",
                });
            }
            updates.averageRating = rating;
        }

        if (updates.totalRatings !== undefined && isSuperAdmin) {
            const total = parseInt(updates.totalRatings);
            if (isNaN(total) || total < 0) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Total ratings must be a positive number",
                });
            }
            updates.totalRatings = total;
        }

        // Check for duplicate mobileNumber if being updated
        if (updates.mobileNumber && updates.mobileNumber !== user.mobileNumber) {
            const existingUser = await User.findOne({
                mobileNumber: updates.mobileNumber,
                _id: { $ne: id },
            });

            if (existingUser) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Mobile number already in use by another user",
                });
            }
        }

        // Check for duplicate alternateMobileNumber if being updated
        if (
            updates.alternateMobileNumber &&
            updates.alternateMobileNumber !== user.alternateMobileNumber
        ) {
            const existingUser = await User.findOne({
                $or: [
                    { mobileNumber: updates.alternateMobileNumber },
                    { alternateMobileNumber: updates.alternateMobileNumber },
                ],
                _id: { $ne: id },
            });

            if (existingUser) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Alternate mobile number already in use",
                });
            }
        }

        // Update all other fields
        Object.keys(updates).forEach((key) => {
            // Skip address since we handled it separately
            if (key !== "address") {
                user[key] = updates[key];
            }
        });

        const updatedUser = await user.save();

        // Delete old files from S3 after successful update
        if (filesToDelete.length > 0) {
            try {
                await Promise.all(
                    filesToDelete.map((filePath) =>
                        deleteFromS3(filePath).catch((err) =>
                            console.error(`Failed to delete file ${filePath}:`, err),
                        ),
                    ),
                );
            } catch (deleteError) {
                console.error("Error deleting old files:", deleteError);
            }
        }

        // Populate references
        const populatedUser = await User.findById(updatedUser._id)
            .populate("address.city")
            .populate("address.state")
            .populate("address.country")
            .populate("plan");

        res.status(200).json({
            Status: 1,
            Message: "User updated successfully",
            data: populatedUser,
        });
    } catch (error) {
        console.error("Update user error:", error);

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(200).json({
                Status: 0,
                Message: `${field} already exists`,
            });
        }
        // Handle validation errors
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((err) => err.message);
            return res.status(200).json({
                Status: 0,
                Message: "Validation error",
                errors: messages,
            });
        }

        res.status(500).json({
            Status: 0,
            Message: "Failed to update user",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

const deleteUser = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // Mark as inactive instead of deleting
        user.userStatus = "Inactive";
        await user.save();

        res.status(200).json({
            Status: 1,
            Message: "User deactivated successfully",
            data: user,
        });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to delete user",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// logout
const logout = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    console.log(user);

    if (user) {
        const device = await Device.findById(user.deviceid);
        if (device) {
            console.log(device);
            await Device.deleteOne({ _id: device._id });

            return res.status(200).json({
                Status: 1,
                Message: "Logout successful",
            });
        } else {
            return res.status(200).json({
                Status: 1,
                Message: "Logout successful",
            });
        }
    }

    // If user not found, still send logout successful with Status 0
    return res.status(200).json({
        Status: 0,
        Message: "Logout successful",
    });
});

module.exports = {
    signUp,
    login,
    getAllUsers,
    getUserById,
    deleteUser,
    updateUser,
    verifyOTP,
    resendOTP,
    logout,
};
