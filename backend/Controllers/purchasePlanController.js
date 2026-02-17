const asyncHandler = require("express-async-handler");
const PurchasePlan = require("../models/purchasePlan");
const Plan = require("../models/Plan");
const User = require("../models/User");
const mongoose = require("mongoose");
const { runPlanExpiryJob } = require("../middleware/planExpiryCron");

// Purchase a plan
const purchasePlan = asyncHandler(async (req, res) => {
    try {
        const { planId, duration } = req.body;
        const userId = req.user._id || req.body.userId;

        if (!planId || !duration) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide planId and duration",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid plan ID",
            });
        }

        // Check if plan exists
        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan not found",
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // Calculate dates and pricing
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000); // duration in days

        const basePrice = plan.price * (duration / 30); // Assuming plan.price is for 30 days
        const gstAmount = (basePrice * plan.gstPercentage) / 100;
        const discountAmount = (basePrice * plan.discount) / 100;
        const totalPrice = basePrice + gstAmount - discountAmount;

        // Create purchase record
        const purchaseRecord = await PurchasePlan.create({
            user: userId,
            plan: [planId],
            startDate,
            endDate,
            isExpired: false,
            expiredAt: null,
            price: basePrice,
            gst: gstAmount,
            totalPrice,
        });

        // Update user's current plan
        user.plan = planId;
        await user.save();

        // Populate the response
        const populatedPurchase = await PurchasePlan.findById(purchaseRecord._id)
            .populate("user", "-password -otp -resettoken")
            .populate("plan");

        res.status(201).json({
            Status: 1,
            Message: "Plan purchased successfully",
            data: populatedPurchase,
        });

    } catch (error) {
        console.error("Purchase Plan Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to purchase plan",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Get user's purchased plans
const getUserPurchasedPlans = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid user ID",
            });
        }

        const purchasedPlans = await PurchasePlan.find({ user: userId })
            .populate("user", "-password -otp -resettoken")
            .populate("plan")
            .sort({ createdAt: -1 });

        res.status(200).json({
            Status: 1,
            Message: "Purchased plans fetched successfully",
            data: {
                totalPurchases: purchasedPlans.length,
                plans: purchasedPlans,
            },
        });

    } catch (error) {
        console.error("Get Purchased Plans Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to fetch purchased plans",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Get user's active/current plan
const getActivePlan = asyncHandler(async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid user ID",
            });
        }

        const user = await User.findById(userId).populate("plan");

        if (!user) {
            return res.status(200).json({
                Status: 0,
                Message: "User not found",
            });
        }

        // Get active purchase plan
        const activePurchase = await PurchasePlan.findOne({
            user: userId,
            endDate: { $gte: new Date() },
        })
            .populate("user", "-password -otp -resettoken")
            .populate("plan")
            .sort({ endDate: -1 });

        res.status(200).json({
            Status: 1,
            Message: "Active plan fetched successfully",
            data: {
                currentPlan: user.plan,
                activePurchase: activePurchase || null,
                isExpired: !activePurchase,
            },
        });

    } catch (error) {
        console.error("Get Active Plan Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to fetch active plan",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Renew/Extend plan
const renewPlan = asyncHandler(async (req, res) => {
    try {
        const { purchasePlanId, duration } = req.body;

        if (!purchasePlanId || !duration) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide purchasePlanId and duration",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(purchasePlanId)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid purchase plan ID",
            });
        }

        const purchaseRecord = await PurchasePlan.findById(purchasePlanId)
            .populate("plan");

        if (!purchaseRecord) {
            return res.status(200).json({
                Status: 0,
                Message: "Purchase record not found",
            });
        }

        const plan = purchaseRecord.plan[0];

        // Calculate new end date
        const currentEndDate = new Date(purchaseRecord.endDate);
        const newEndDate = new Date(currentEndDate.getTime() + duration * 24 * 60 * 60 * 1000);

        // Calculate pricing for extension
        const basePrice = plan.price * (duration / 30);
        const gstAmount = (basePrice * plan.gstPercentage) / 100;
        const discountAmount = (basePrice * plan.discount) / 100;
        const extensionPrice = basePrice + gstAmount - discountAmount;

        // Update purchase record
        purchaseRecord.endDate = newEndDate;
        purchaseRecord.isExpired = false;
        purchaseRecord.expiredAt = null;
        purchaseRecord.price = purchaseRecord.price + basePrice;
        purchaseRecord.gst = purchaseRecord.gst + gstAmount;
        purchaseRecord.totalPrice = purchaseRecord.totalPrice + extensionPrice;

        await purchaseRecord.save();

        const populatedPurchase = await PurchasePlan.findById(purchaseRecord._id)
            .populate("user", "-password -otp -resettoken")
            .populate("plan");

        res.status(200).json({
            Status: 1,
            Message: "Plan renewed successfully",
            data: populatedPurchase,
        });

    } catch (error) {
        console.error("Renew Plan Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to renew plan",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Check and mark expired plans
const checkExpiredPlans = asyncHandler(async (req, res) => {
    try {
        const result = await runPlanExpiryJob();
        res.status(200).json({
            Status: 1,
            Message: "Expired plans checked and updated",
            data: result,
        });

    } catch (error) {
        console.error("Check Expired Plans Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to check expired plans",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Get purchase history with pagination
const getPurchaseHistory = asyncHandler(async (req, res) => {
    try {
        let { page = 1, limit = 10, userId } = req.query;
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);
        const skip = (page - 1) * limit;

        const filter = {};

        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(200).json({
                    Status: 0,
                    Message: "Invalid user ID",
                });
            }
            filter.user = userId;
        }

        const [purchases, totalCount] = await Promise.all([
            PurchasePlan.find(filter)
                .populate("user", "-password -otp -resettoken")
                .populate("plan")
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            PurchasePlan.countDocuments(filter),
        ]);

        res.status(200).json({
            Status: 1,
            Message: "Purchase history fetched successfully",
            data: {
                totalPurchases: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                purchases,
            },
        });

    } catch (error) {
        console.error("Get Purchase History Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Failed to fetch purchase history",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

module.exports = {
    purchasePlan,
    getUserPurchasedPlans,
    getActivePlan,
    renewPlan,
    checkExpiredPlans,
    getPurchaseHistory,
};
