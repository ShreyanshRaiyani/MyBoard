const asyncHandler = require("express-async-handler");
const Country = require("../models/Country");
const User = require("../models/User");

const isSuperAdminUser = async (userId) => {
    const user = await User.findById(userId);
    return user && user.userType === "SuperAdmin";
};

// Create Country
const addCountry = asyncHandler(async (req, res) => {
    const { name } = req.body;

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to add countries",
        });
    }

    const existingCountry = await Country.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existingCountry) {
        return res.status(200).json({
            Status: 0,
            Message: "Country already exists",
        });
    }

    const country = await Country.create({ name });

    if (country) {
        res.status(200).json({
            Status: 1,
            Message: "Country added Successfully",
            country,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Something Went Wrong",
        });
    }
});

// Get All Countries
const getCountries = asyncHandler(async (req, res) => {
    const { page, limit, search = "" } = req.query;
    const skip = (page - 1) * limit;

    const filter = search
        ? { name: { $regex: search, $options: 'i' } }
        : {};

    const countries = await Country.find(filter)
            .sort({ name: 1 })
        .collation({ locale: 'en', strength: 1 })
        .limit(parseInt(limit))
        .skip(skip);

    const count = await Country.countDocuments(filter);

    if (countries.length > 0) {
        res.status(200).json({
            Status: 1,
            Message: "Country fetched Successfully",
            totalCount: count,
            countries,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "No countries found",
            totalCount: count,
            countries: [],
        });
    }
});

// Get Single Country by ID
const getCountryById = asyncHandler(async (req, res) => {
    const country = await Country.findById(req.params.id);

    if (country) {
        res.status(200).json({
            Status: 1,
            Message: "Country fetched successfully",
            country,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Country not found",
        });
    }
});

// Update Country
const updateCountry = asyncHandler(async (req, res) => {
    const { name } = req.body;

    // if (!name) {
    //     return res.status(200).json({
    //         Status: 0,
    //         Message: "Please fill all the fields",
    //     });
    // }

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to update countries",
        });
    }

    const country = await Country.findById(req.params.id);

    if (country) {
        country.name = name || country.name;
        await country.save();
        res.status(200).json({
            Status: 1,
            Message: "Country Updated Successfully",
            country,
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Country Not Found",
        });
    }
});

// Delete Country
const deleteCountry = asyncHandler(async (req, res) => {

    const isSuperAdmin = await isSuperAdminUser(req.user._id || req.user.userId);

    if (!isSuperAdmin) {
        return res.status(200).json({
            Status: 0,
            Message: "You are not authorized to delete countries",
        });
    }

    const country = await Country.findById(req.params.id);

    if (country) {
        await country.deleteOne();
        res.status(200).json({
            Status: 1,
            Message: "Country Deleted Successfully",
        });
    } else {
        res.status(200).json({
            Status: 0,
            Message: "Country Not Found",
        });
    }
});

module.exports = {
    addCountry,
    getCountries,
    getCountryById,
    updateCountry,
    deleteCountry,
};