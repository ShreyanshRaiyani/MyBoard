const asyncHandler = require("express-async-handler");
const State = require('../models/State');
const User = require('../models/User');

const isSuperAdminUser = async (userId) => {
    const user = await User.findById(userId);
    return user && user.userType === "SuperAdmin";
};

// Add State
const addState = asyncHandler(async (req, res) => {
    const { name, country } = req.body;

    if (!name || !country) {
        return res.status(200).json({
            Status: 0,
            Message: "Please fill all the fields",
        });
    }

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to add states",
        });
    }

    const existing = await State.findOne({ name: new RegExp(`^${name}$`, 'i'), country });
    if (existing) {
        return res.status(200).json({
            Status: 0,
            Message: "State already exists",
        });
    }

    // Create & Populate
    const created = await State.create({ name, country });
    const populated = await State.findById(created._id).populate("country");

    if (populated) {
        return res.status(200).json({
            Status: 1,
            Message: "State added Successfully",
            state: populated,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Something went wrong",
        });
    }
});

// Get All States
const getStates = asyncHandler(async (req, res) => {
    const { page, limit, search = "", countryId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    if (countryId) {
        filter.country = (countryId);
    }

    const list = await State.find(filter)
        .populate("country")
        .sort({ name: 1 })
        .collation({ locale: 'en', strength: 1 })
        .limit(limit)
        .skip(skip);

    const count = await State.countDocuments(filter);

    res.status(200).json({
        Status: 1,
        Message: list.length > 0 ? "States fetched successfully" : "No States found",
        totalCount: count,
        states: list,
    });
});

// Get Single State by ID
const getStateById = asyncHandler(async (req, res) => {
    const state = await State.findById(req.params.id).populate("country");

    if (state) {
        res.status(200).json({
            Status: 1,
            Message: "State fetched successfully",
            state,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "State not found",
        });
    }
});

// Update State
const updateState = asyncHandler(async (req, res) => {
    const { name, country } = req.body;

    if (!name || !country) {
        return res.status(200).json({
            Status: 0,
            Message: "Please fill all the fields",
        });
    }

   const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to update states",
        });
    }

    const state = await State.findById(req.params.id);

    if (state) {
        state.name = name || state.name;
        state.country = country || state.country;
        await state.save();

        const populatedState = await State.findById(state._id).populate("country");

        res.status(200).json({
            Status: 1,
            Message: "State updated successfully",
            state: populatedState,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "State not found",
        });
    }
});

// Delete State
const deleteState = asyncHandler(async (req, res) => {
    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);   

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to delete states",
        });
    }

    const state = await State.findById(req.params.id);

    if (state) {
        await state.deleteOne();
        res.status(200).json({
            Status: 1,
            Message: "State deleted successfully",
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "State not found",
        });
    }
});

module.exports = {
    addState,
    getStates,
    getStateById,
    updateState,
    deleteState,
};