const asyncHandler = require("express-async-handler");
const Plan = require("../models/Plan");
const mongoose = require("mongoose");

// Add Plan
const addPlan = asyncHandler(async (req, res) => {
    try {
        const { name, notes, currency, price, userCount, gstPercentage, discount, duration, default: isDefault, applicableUserTypes } = req.body;

        if (!name || price === undefined || duration === undefined) {
            return res.status(200).json({
                Status: 0,
                Message: "Please provide required fields: name, price, duration",
            });
        }

        if (price < 0 || duration < 0) {
            return res.status(200).json({
                Status: 0,
                Message: "Price and duration must be non-negative",
            });
        }

        if (gstPercentage !== undefined && (gstPercentage < 0 || gstPercentage > 100)) {
            return res.status(200).json({
                Status: 0,
                Message: "GST percentage must be between 0 and 100",
            });
        }

        if (discount !== undefined && (discount < 0 || discount > 100)) {
            return res.status(200).json({
                Status: 0,
                Message: "Discount must be between 0 and 100",
            });
        }

        const existingPlan = await Plan.findOne({ name: new RegExp(`^${name}$`, 'i') });
        if (existingPlan) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan with this name already exists",
            });
        }

        // If setting as default, unset other defaults for same user types
        if (isDefault && applicableUserTypes && applicableUserTypes.length > 0) {
            await Plan.updateMany(
                { 
                    applicableUserTypes: { $in: applicableUserTypes },
                    default: true 
                },
                { default: false }
            );
        }

        const planData = {
            name,
            notes: notes || null,
            currency: currency || "INR",
            price,
            userCount: userCount || 0,
            gstPercentage: gstPercentage || 0,
            discount: discount || 0,
            duration,
            default: isDefault || false,
            applicableUserTypes: applicableUserTypes || ["HoardingOwner", "BannerUser"],
        };

        const plan = await Plan.create(planData);

        res.status(201).json({
            Status: 1,
            Message: "Plan added successfully",
            data: plan,
        });

    } catch (error) {
        console.error("Add Plan Error:", error);
        if (error.code === 11000) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan name already exists",
            });
        }
        res.status(500).json({
            Status: 0,
            Message: "Internal Server Error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Get All Plans
const getAllPlans = asyncHandler(async (req, res) => {
    try {
        let { page = 1, limit = 10, search = "", applicableUserTypes } = req.query;
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);
        const skip = (page - 1) * limit;

        const filter = {};

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } },
            ];
        }

        if (applicableUserTypes) {
            filter.applicableUserTypes = applicableUserTypes;
        }

        const [plans, totalCount] = await Promise.all([
            Plan.find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            Plan.countDocuments(filter),
        ]);

        res.status(200).json({
            Status: 1,
            Message: "Plans fetched successfully",
            data: {
                totalPlans: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                plans,
            },
        });

    } catch (error) {
        console.error("Get All Plans Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Internal Server Error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Get Single Plan by ID
const getPlan = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(id);

        if (!plan) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan not found",
            });
        }

        res.status(200).json({
            Status: 1,
            Message: "Plan fetched successfully",
            data: plan,
        });

    } catch (error) {
        console.error("Get Plan Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Internal Server Error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Update Plan
const updatePlan = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(id);

        if (!plan) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan not found",
            });
        }

        // Validation
        if (updates.price !== undefined && updates.price < 0) {
            return res.status(200).json({
                Status: 0,
                Message: "Price must be non-negative",
            });
        }

        if (updates.duration !== undefined && updates.duration < 0) {
            return res.status(200).json({
                Status: 0,
                Message: "Duration must be non-negative",
            });
        }

        if (updates.gstPercentage !== undefined && (updates.gstPercentage < 0 || updates.gstPercentage > 100)) {
            return res.status(200).json({
                Status: 0,
                Message: "GST percentage must be between 0 and 100",
            });
        }

        if (updates.discount !== undefined && (updates.discount < 0 || updates.discount > 100)) {
            return res.status(200).json({
                Status: 0,
                Message: "Discount must be between 0 and 100",
            });
        }

        // If setting as default, unset other defaults for same user types
        if (updates.default === true) {
            const userTypesToUpdate = updates.applicableUserTypes || plan.applicableUserTypes;
            await Plan.updateMany(
                { 
                    _id: { $ne: id },
                    applicableUserTypes: { $in: userTypesToUpdate },
                },
                { default: false }
            );
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (key !== "_id") {
                plan[key] = updates[key];
            }
        });

        await plan.save();

        const updatedPlan = await Plan.findById(id);

        res.status(200).json({
            Status: 1,
            Message: "Plan updated successfully",
            data: updatedPlan,
        });

    } catch (error) {
        console.error("Update Plan Error:", error);
        if (error.code === 11000) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan name already exists",
            });
        }
        res.status(500).json({
            Status: 0,
            Message: "Internal Server Error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Delete Plan
const deletePlan = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(200).json({
                Status: 0,
                Message: "Invalid plan ID",
            });
        }

        const plan = await Plan.findById(id);

        if (!plan) {
            return res.status(200).json({
                Status: 0,
                Message: "Plan not found",
            });
        }

        // Prevent deletion of default plans
        if (plan.default) {
            return res.status(200).json({
                Status: 0,
                Message: "Cannot delete a default plan. Please set another plan as default first.",
            });
        }

        await Plan.findByIdAndDelete(id);

        res.status(200).json({
            Status: 1,
            Message: "Plan deleted successfully",
        });

    } catch (error) {
        console.error("Delete Plan Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Internal Server Error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// Run Plan Cron Job
const runPlanCron = asyncHandler(async (req, res) => {
    try {
        console.log('Plan Cron Job Triggered at:', new Date());

        // Get plan statistics
        const totalPlans = await Plan.countDocuments({});
        const defaultPlans = await Plan.countDocuments({ default: true });

        const planStats = await Plan.aggregate([
            {
                $group: {
                    _id: "$applicableUserTypes",
                    count: { $sum: 1 },
                    avgPrice: { $avg: "$price" },
                    totalRevenue: { $sum: "$price" },
                },
            },
        ]);

        const cronResult = {
            timestamp: new Date(),
            totalPlans,
            defaultPlans,
            planStats,
            message: "Plan cron job executed successfully",
        };

        console.log("Cron job result:", cronResult);

        res.status(200).json({
            Status: 1,
            Message: "Plan cron job executed successfully",
            data: cronResult,
        });

    } catch (error) {
        console.error("Plan Cron Job Error:", error);
        res.status(500).json({
            Status: 0,
            Message: "Plan cron job failed",
            error: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});



module.exports = {
    addPlan,
    getAllPlans,
    getPlan,
    updatePlan,
    deletePlan,
    runPlanCron
};