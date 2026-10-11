const asyncHandler = require("express-async-handler");
const City = require('../models/City');
const User = require('../models/User');

const isSuperAdminUser = async (userId) => {
    const user = await User.findById(userId);
    return user && user.userType === "SuperAdmin";
};

// Add City
const addCity = asyncHandler(async (req, res) => {
    const { name, country, state } = req.body;

    if (!name || !country || !state) {
        return res.status(200).json({
            Status: 0,
            Message: "Please fill all the fields",
        });
    }

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to add cities",
        });
    }

    const existing = await City.findOne({ name: new RegExp(`^${name}$`, 'i'), country, state });
    if (existing) {
        return res.status(200).json({
            Status: 0,
            Message: "City already exists",
        });
    }

    const created = await City.create({ name, country, state });
    if (created) {
        const populatedCity = await City.findById(created._id)
            .populate({ path: 'country' })
            .populate({
                path: 'state',
                populate: { path: 'country' }
            });

        res.status(200).json({
            Status: 1,
            Message: "City added Successfully",
            city: populatedCity,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Something went wrong",
        });
    }
});

// Get All Cities with Pagination
const getCities = asyncHandler(async (req, res) => {
    const { page, limit, search = "", countryId, stateId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    if (countryId) {
        filter.country = (countryId);
    }

    if (stateId) {
        filter.state = (stateId);
    }

    const list = await City.find(filter)
        .populate({ path: 'country' })
        .populate({
            path: 'state',
            populate: { path: 'country' }
        })
        // Sort alphabetically by name (case-insensitive)
        .sort({ name: 1 })
        .collation({ locale: 'en', strength: 1 })
        .limit(limit)
        .skip(skip);

    const count = await City.countDocuments(filter);

    res.status(200).json({
        Status: 1,
        Message: list.length > 0 ? "Cities fetched successfully" : "No cities found",
        totalCount: count,
        cities: list,
    });
});

// Get Single City by ID
const getCityById = asyncHandler(async (req, res) => {
    const city = await City.findById(req.params.id)
        .populate({ path: 'country' })
        .populate({
            path: 'state',
            populate: { path: 'country' }
        })


    if (city) {
        res.status(200).json({
            Status: 1,
            Message: "City fetched successfully",
            city,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "City not found",
        });
    }
});

// Update City
const updateCity = asyncHandler(async (req, res) => {
    const { name, country, state } = req.body;

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to update cities",
        });
    }

    const city = await City.findById(req.params.id);

    if (city) {
        city.name = name || city.name;
        city.country = country || city.country;
        city.state = state || city.state;
        await city.save();

        const populatedCity = await City.findById(city._id)
            .populate({ path: 'country' })
            .populate({
                path: 'state',
                populate: { path: 'country' }
            })


        res.status(200).json({
            Status: 1,
            Message: "City updated successfully",
            city: populatedCity,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "City not found",
        });
    }
});

// Delete City
const deleteCity = asyncHandler(async (req, res) => {
    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to delete cities",
        });
    }

    const city = await City.findById(req.params.id);

    if (city) {
        await city.deleteOne();
        res.status(200).json({
            Status: 1,
            Message: "City deleted successfully",
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "City not found",
        });
    }
});

module.exports = {
    addCity,
    getCities,
    getCityById,
    updateCity,
    deleteCity,
};