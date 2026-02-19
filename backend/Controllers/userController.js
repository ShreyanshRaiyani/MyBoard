const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const generateToken = require('../middleware/generatetoken');
const { uploadImageReturnUrl, deleteFromS3 } = require("./imageController");
const path = require("path");
const Device = require("../models/Device");
const Plan = require("../models/Plan");
const { sendResetPasswordEmail } = require('../middleware/sendmail');

/**
 * User Registration Controller
 * Handles registration for different user types with appropriate validations
 */
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
            businessEmail,
            phone_code,
            iso_code,
            memberId,
            address,
            area,
            city,
            state,
            country,
            hoardingLicense,
            business,
            gstNumber,
            workerType,
            experience,
            skills,
            plan,
            password,
        } = req.body;

        // ========== VALIDATION ==========
        if (!firstName || !email || !mobileNumber || !userType) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide all required fields: firstName, email, mobileNumber, userType",
            });
        }

        const validUserTypes = ["SuperAdmin", "HoardingOwner", "BannerUser", "Worker"];
        if (!validUserTypes.includes(userType)) {
            return res.status(200).json({
                Status: 0,
                Message: `Invalid userType. Must be one of: ${validUserTypes.join(", ")}`,
            });
        }

        // ========== CHECK EXISTING USER ==========
        const existingUser = await User.findOne({
            $or: [{ email }, { mobileNumber }],
        });

        if (existingUser) {
            return res.status(200).json({
                Status: 0,
                Message: "User with this email or mobile number already exists",
            });
        }

        // ========== HANDLE PASSWORD/OTP ==========
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
            otp = Math.floor(1000 + Math.random() * 9000);
            console.log(`OTP for ${mobileNumber}: ${otp}`);
        }

        // ========== HANDLE PLAN LOGIC ==========
        let planId = null;

        if (userType === "HoardingOwner" || userType === "BannerUser") {
            const defaultPlan = await Plan.findOne({
                isDefault: true,
                userType: userType
            });

            if (defaultPlan) {
                planId = defaultPlan._id;
                console.log(`Default plan assigned for ${userType}:`, defaultPlan.name);
            } else {
                console.log(`No default plan found for ${userType}`);
            }
        } else if (plan) {
            planId = mongoose.Types.ObjectId(plan);
        }

        // ========== PREPARE USER DATA ==========
        const userData = {
            firstName,
            lastName,
            email,
            mobileNumber,
            userType,
            birthDate: birthDate ? new Date(birthDate) : undefined,
            alternateMobileNumber,
            businessEmail,
            phone_code: phone_code || "+91",
            iso_code: iso_code || "IN",
            memberId,
            address: address || {
                country: country || undefined,
                state: state || undefined,
                city: city || undefined,
                area: area || undefined,
            },
            hoardingLicense: hoardingLicense || undefined,
            business,
            gstNumber,
            workerType,
            experience,
            skills: skills || [],
            plan: planId,
            accountStatus: userType === "SuperAdmin" ? "Verified" : "Pending",
            emailverified: userType === "SuperAdmin" ? true : false,
        };

        // Add password or OTP based on user type
        if (userType === "SuperAdmin") {
            userData.password = hashedPassword;
        } else {
            userData.otp = otp;
        }

        // ========== CREATE USER ==========
        const user = await User.create(userData);

        // Generate JWT token for SuperAdmin
        let token = null;
        if (userType === "SuperAdmin") {
            token = generateToken(user._id, user.userType);
        }

        // Remove sensitive data from response
        const userResponse = user.toJSON();

        // ========== SEND RESPONSE ==========
        res.status(201).json({
            Status: 1,
            Message: userType === "SuperAdmin"
                ? "SuperAdmin registered successfully"
                : userType === "HoardingOwner" || userType === "BannerUser"
                    ? `${userType} registered successfully with default plan. OTP sent for verification.`
                    : "User registered successfully. OTP sent for verification.",

            user: userResponse,
            token: token || undefined,
            defaultPlanAssigned: (userType === "HoardingOwner" || userType === "BannerUser") && planId ? true : false,
        });
    } catch (error) {
        console.error("SignUp error:", error);

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

/**
 * User Login Controller
 * Handles both password-based and OTP-based login
 */
const login = asyncHandler(async (req, res) => {
    try {
        console.log("Login request body:", req.body);

        const { email, password, otp } = req.body;

        // ========== VALIDATION ==========
        if (!email) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide email",
            });
        }

        // ========== FIND USER ==========
        const user = await User.findOne({ email }).select("+password");

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // ========== CHECK USER STATUS ==========
        if (user.userStatus === "Inactive") {
            return res.status(200).json({
                Status: 0,
                Message: "Account is inactive. Please contact support.",
            });
        }

        // ========== OTP BASED LOGIN ==========
        if (email && !password) {
            const otp = Math.floor(1000 + Math.random() * 9000);
            const verification = "confirm your email";
            await sendResetPasswordEmail(email, otp, verification, user, req);
            user.otp = otp;
            user.emailverified = false;
            await user.save();
        }

        // ========== PASSWORD BASED LOGIN ==========
        if (email && password) {
            const isPasswordCorrect = await bcrypt.compare(password, user.password);
            if (!isPasswordCorrect) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Your password is incorrect",
                });
            }
        }

        // ========== FETCH UPDATED USER ==========
        const populateuser = await User.findById(user.id).select("-emailverified");

        // Remove null/undefined fields
        Object.keys(populateuser).forEach((key) => {
            if (populateuser[key] === null || populateuser[key] == undefined) {
                delete populateuser[key];
            }
        });

        // ========== SEND RESPONSE ==========
        res.status(200).json({
            Status: 1,
            Message: "Login successful",

            user: populateuser,
            token: generateToken(user._id, user.userType),
            userType: user.userType,
            accountStatus: user.accountStatus,

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

/**
 * OTP Verification Controller
 * Verifies user's email using OTP
 */
const verifyOTP = asyncHandler(async (req, res) => {
    try {
        const { email, otp } = req.body;

        // ========== VALIDATION ==========
        if (!email || !otp) {
            return res.status(200).json({
                Status: 0,
                Message: "Email and OTP are required"
            });
        }

        // ========== FIND USER ==========
        const user = await User.findOne({ email }).select('+otp');

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found"
            });
        }

        // ========== VERIFY OTP ==========
        console.log("Verifying OTP:", { providedOtp: otp, userOtp: user.otp });
        if (user.otp !== otp) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid OTP"
            });
        }

        // ========== UPDATE USER ==========
        user.emailverified = true;
        user.otp = null;
        await user.save();

        // ========== GENERATE TOKEN ==========
        const userToken = generateToken(user._id);

        // ========== FETCH UPDATED USER ==========
        const populatedUser = await User.findById(user._id)
            .select('-password -otp -resettoken -resettokentime')
            .exec();

        // ========== SEND RESPONSE ==========
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

/**
 * Resend OTP Controller
 * Generates and sends new OTP to user
 */
const resendOTP = asyncHandler(async (req, res) => {
    try {
        const { email, mobileNumber } = req.body;

        // ========== BUILD QUERY ==========
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

        // ========== FIND USER ==========
        const user = await User.findOne(query);

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // ========== CHECK USER TYPE ==========
        if (user.userType === "SuperAdmin") {
            return res.status(200).json({
                Status: 0,
                Message: "SuperAdmin does not use OTP verification",
            });
        }

        // ========== GENERATE NEW OTP ==========
        const generateOTP = () => Math.floor(1000 + Math.random() * 9000);
        const otp = generateOTP();
        user.otp = otp;
        await user.save();

        console.log(`New OTP for ${mobileNumber || email}: ${otp}`);

        // ========== SEND RESPONSE ==========
        res.status(200).json({
            Status: 1,
            Message: "OTP sent successfully",
            otp, // TODO: Remove in production
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

/**
 * Get All Users Controller
 * Retrieves users with pagination, filtering, and search
 */
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

        // ========== BUILD FILTER ==========
        const filter = {};

        if (userType) filter.userType = userType;
        if (userStatus) filter.userStatus = userStatus;
        if (accountStatus) filter.accountStatus = accountStatus;

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

        // ========== FETCH USERS ==========
        if (User.paginate) {
            const users = await User.paginate(filter, options);

            res.status(200).json({
                Status: 1,

                totalUsers: users.totalDocs,
                totalPages: users.totalPages,
                currentPage: users.page,
                users: users.docs,

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

                totalUsers,
                totalPages: Math.ceil(totalUsers / parseInt(limit)),
                currentPage: parseInt(page),
                users: users,

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

        // ========== FETCH USER ==========
        const user = await User.findById(id)

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // ========== SEND RESPONSE ==========
        res.status(200).json({
            Status: 1,
            user: user,
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

/**
 * Update User Controller
 * Handles user updates with role-based permissions
 */
const updateUser = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // ========== FIND USER TO UPDATE ==========
        const user = await User.findById(id);
        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // ========== GET CURRENT USER ==========
        const currentUserId = req.userId || (req.user && req.user._id);
        const currentUser = currentUserId ? await User.findById(currentUserId) : null;
        console.log("Current user:", currentUser);

        if (!currentUser) {
            return res.status(200).json({
                Status: 0,
                Message: "Authentication required",
            });
        }

        const isSuperAdmin = currentUser.userType === "SuperAdmin";
        const isWorker = currentUser.userType === "Worker";
        const isUpdatingSelf = currentUser._id.toString() === id;

        // ========== RESTRICT SENSITIVE FIELDS ==========
        delete updates.email;
        delete updates.otp;
        delete updates.resettoken;
        delete updates.resettokentime;
        delete updates.userType;

        if (!isSuperAdmin) {
            delete updates.accountStatus;
        }

        const canUpdateWorkerFields = isSuperAdmin || (isWorker && isUpdatingSelf);
        if (!canUpdateWorkerFields) {
            delete updates.workerType;
            delete updates.experience;
            delete updates.skills;
            delete updates.availability;
            delete updates.averageFeedback;
            delete updates.totalFeedbacks;
        }

        if (!isSuperAdmin) {
            delete updates.averageFeedback;
            delete updates.totalFeedbacks;
        }

        // ========== HANDLE DEFAULT PLAN ==========
        if (user.accountStatus === 'Verified') {
            if (user.userType === 'HoardingOwner' || user.userType === 'BannerUser') {
                const defaultPlan = await Plan.findOne({
                    default: true,
                    applicableUserTypes: user.userType
                });

                if (defaultPlan) {
                    user.plan = defaultPlan._id;
                    console.log(`Assigned ${defaultPlan.name} to ${user.userType} user`);
                }
            }
        }

        // ========== HANDLE IMAGE UPLOADS ==========
        const uploadedFiles = req.uploadedFiles || {};
        const toUpload = [];
        const filesToDelete = [];

        // Profile Picture
        if (uploadedFiles.profilepic) {
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
            if (user.profilepic && user.profilepic !== "generaluserpic.png") {
                filesToDelete.push(user.profilepic);
            }
        }

        // GST Certificate
        if (uploadedFiles.gstCertificate) {
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

        // Aadhar Front & Back
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

        // PAN Card
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

        // ========== PERFORM UPLOADS ==========
        if (toUpload.length > 0) {
            const uploadedResults = {};

            for (const entry of toUpload) {
                if (!entry || !entry.file) continue;

                try {
                    const originalName = entry.file.originalname || `${entry.prefix}_${Date.now()}`;
                    const folder = "users";
                    const s3name = `${folder}/${Date.now()}_${originalName}`;

                    const uploadResult = await uploadImageReturnUrl(entry.file, s3name, { req });

                    if (uploadResult && uploadResult.path) {
                        uploadedResults[entry.key] = uploadResult.path;
                    }
                } catch (uploadError) {
                    console.error(`Upload failed for ${entry.key}:`, uploadError);
                }
            }

            if (uploadedResults.profilepic) updates.profilepic = uploadedResults.profilepic;
            if (uploadedResults.gst_certificate) updates.gst_certificate = uploadedResults.gst_certificate;
            if (uploadedResults.aadharFront) updates.aadharFront = uploadedResults.aadharFront;
            if (uploadedResults.aadharBack) updates.aadharBack = uploadedResults.aadharBack;
            if (uploadedResults.panimage) updates.panimage = uploadedResults.panimage;
        }

        // ========== DATA PROCESSING ==========
        if (updates.birthDate) {
            updates.birthDate = new Date(updates.birthDate);
        }

        // Handle address updates
        if (updates.address && typeof updates.address === "object") {
            user.address = user.address || {};

            if (updates.address.country) {
                user.address.country = mongoose.Types.ObjectId(updates.address.country);
            }
            if (updates.address.state) {
                user.address.state = mongoose.Types.ObjectId(updates.address.state);
            }
            if (updates.address.city) {
                user.address.city = mongoose.Types.ObjectId(updates.address.city);
            }
            if (updates.address.area) {
                user.address.area = mongoose.Types.ObjectId(updates.address.area);
            }
            if (updates.address.street !== undefined) {
                user.address.street = updates.address.street;
            }
            if (updates.address.pincode !== undefined) {
                user.address.pincode = updates.address.pincode;
            }

            delete updates.address;
        }

        // Handle skills array
        if (updates.skills !== undefined && canUpdateWorkerFields) {
            if (typeof updates.skills === "string") {
                updates.skills = updates.skills
                    .split(",")
                    .map(skill => skill.trim())
                    .filter(skill => skill);
            } else if (Array.isArray(updates.skills)) {
                updates.skills = updates.skills
                    .map(skill => String(skill).trim())
                    .filter(skill => skill);
            }
        }

        if (updates.plan) {
            updates.plan = mongoose.Types.ObjectId(updates.plan);
        }

        // ========== VALIDATE ENUM FIELDS ==========
        if (updates.workerType !== undefined && canUpdateWorkerFields) {
            const validWorkerTypes = ["Installation", "Maintenance", "Removal", "All"];
            if (!validWorkerTypes.includes(updates.workerType)) {
                return res.status(200).json({
                    Status: 0,
                    Message: `Invalid workerType. Must be one of: ${validWorkerTypes.join(", ")}`,
                });
            }
        }

        if (updates.availability !== undefined && canUpdateWorkerFields) {
            const validAvailability = ["Available", "Busy", "Unavailable"];
            if (!validAvailability.includes(updates.availability)) {
                return res.status(200).json({
                    Status: 0,
                    Message: `Invalid availability. Must be one of: ${validAvailability.join(", ")}`,
                });
            }
        }

        if (updates.accountStatus !== undefined && isSuperAdmin) {
            const validAccountStatus = ["Active", "Inactive", "Suspended", "Pending"];
            if (!validAccountStatus.includes(updates.accountStatus)) {
                return res.status(200).json({
                    Status: 0,
                    Message: `Invalid accountStatus. Must be one of: ${validAccountStatus.join(", ")}`,
                });
            }
        }

        if (updates.userStatus !== undefined && isSuperAdmin) {
            const validUserStatus = ["Active", "Inactive"];
            if (!validUserStatus.includes(updates.userStatus)) {
                return res.status(200).json({
                    Status: 0,
                    Message: `Invalid userStatus. Must be one of: ${validUserStatus.join(", ")}`,
                });
            }
        }

        // ========== VALIDATE NUMERIC FIELDS ==========
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

        if (updates.averageFeedback !== undefined && isSuperAdmin) {
            const feedback = parseFloat(updates.averageFeedback);
            if (isNaN(feedback) || feedback < 0 || feedback > 5) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Average feedback must be between 0 and 5",
                });
            }
            updates.averageFeedback = feedback;
        }

        if (updates.totalFeedbacks !== undefined && isSuperAdmin) {
            const total = parseInt(updates.totalFeedbacks);
            if (isNaN(total) || total < 0) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Total feedbacks must be a positive number",
                });
            }
            updates.totalFeedbacks = total;
        }

        // ========== CHECK FOR DUPLICATES ==========
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

        if (updates.alternateMobileNumber && updates.alternateMobileNumber !== user.alternateMobileNumber) {
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

        // ========== APPLY UPDATES ==========
        Object.keys(updates).forEach((key) => {
            if (key !== "address") {
                user[key] = updates[key];
            }
        });

        const updatedUser = await user.save();

        // ========== DELETE OLD FILES ==========
        if (filesToDelete.length > 0) {
            try {
                await Promise.all(
                    filesToDelete.map((filePath) =>
                        deleteFromS3(filePath).catch((err) =>
                            console.error(`Failed to delete file ${filePath}:`, err)
                        )
                    )
                );
            } catch (deleteError) {
                console.error("Error deleting old files:", deleteError);
            }
        }

        // ========== FETCH UPDATED USER ==========
        const populatedUser = await User.findById(updatedUser._id)
            .populate("address.city")
            .populate("address.state")
            .populate("address.country")
            .populate("address.area")
            .populate("plan");

        // ========== SEND RESPONSE ==========
        res.status(200).json({
            Status: 1,
            Message: "User updated successfully",
            user: populatedUser,
        });
    } catch (error) {
        console.error("Update user error:", error);

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(200).json({
                Status: 0,
                Message: `${field} already exists`,
            });
        }

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

/**
 * Delete User Controller
 * Soft deletes user by setting status to Inactive
 */
const deleteUser = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // ========== FIND USER ==========
        const user = await User.findById(id);

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // ========== SOFT DELETE ==========
        user.userStatus = "Inactive";
        await user.save();

        // ========== SEND RESPONSE ==========
        res.status(200).json({
            Status: 1,
            Message: "User deactivated successfully",
            user: user,
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

/**
 * Logout Controller
 * Handles user logout and device cleanup
 */
const logout = asyncHandler(async (req, res) => {
    try {
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

        return res.status(200).json({
            Status: 0,
            Message: "Logout successful",
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
            Status: 0,
            Message: "Logout failed",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
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