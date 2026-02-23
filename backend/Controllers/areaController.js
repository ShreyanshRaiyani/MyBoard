const asyncHandler = require("express-async-handler");
const Area = require('../models/Area');
const User = require('../models/User');

const isSuperAdminUser = async (userId) => {
    const user = await User.findById(userId);
    return user && user.userType === "SuperAdmin";
};

// Add Area
const addArea = asyncHandler(async (req, res) => {
    const { name, country, state , city } = req.body;

    if (!name || !country || !state || !city) {
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

    const existing = await Area.findOne({ name: new RegExp(`^${name}$`, 'i'), country, state, city });
    if (existing) {
        return res.status(200).json({
            Status: 0,
            Message: "Area already exists",
        });
    }

    // Create & Populate
    const created = await Area.create({ name, country, state, city });
    const populated = await Area.findById(created._id).populate("country" , "name").populate("state", "name").populate("city", "name");

    if (populated) {
        return res.status(200).json({
            Status: 1,
            Message: "Area added Successfully",
            area: populated,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Something went wrong",
        });
    }
});

// Get All Areas
const getAreas = asyncHandler(async (req, res) => {
    const { page, limit, search = "", countryId, stateId, cityId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    if (countryId) {
        filter.country = (countryId);
    }
    if(stateId){
        filter.state = (stateId);
    }
    if(cityId){
        filter.city = (cityId);
    }

    const list = await Area.find(filter)
        .populate("country")
        .sort({ name: 1 })
        .collation({ locale: 'en', strength: 1 })
        .limit(limit)
        .skip(skip);

    const count = await Area.countDocuments(filter);

    res.status(200).json({
        Status: 1,
        Message: list.length > 0 ? "Areas fetched successfully" : "No Areas found",
        totalCount: count,
        areas: list,
    });
});

// Get Single Area by ID
const getAreaById = asyncHandler(async (req, res) => {
    const area = await Area.findById(req.params.id);

    if (area) {
        res.status(200).json({
            Status: 1,
            Message: "Area fetched successfully",
            area,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Area not found",
        });
    }
});

// Update Area
const updateArea = asyncHandler(async (req, res) => {
    const { name, country,state, city } = req.body;

    if (!name || !country || !state || !city) {
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

    const area = await Area.findById(req.params.id);

    if (area) {
        area.name = name || area.name;
        area.country = country || area.country;
        area.state = state || area.state;
        area.city = city || area.city;
        await area.save();

        const populatedArea = await Area.findById(area._id).populate("country");

        res.status(200).json({
            Status: 1,
            Message: "Area updated successfully",
            area: populatedArea,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Area not found",
        });
    }
});

// Delete Area
const deleteArea = asyncHandler(async (req, res) => {
    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);   

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to delete states",
        });
    }

    const area = await Area.findById(req.params.id);

    if (area) {
        await area.deleteOne();
        res.status(200).json({
            Status: 1,
            Message: "Area deleted successfully",
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Area not found",
        });
    }
});

module.exports = {
    addArea,
    getAreas,
    getAreaById,
    updateArea,
    deleteArea,
};