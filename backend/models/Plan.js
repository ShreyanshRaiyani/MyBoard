const mongoose = require("mongoose");

const planSchema = new mongoose.Schema({
    name: {
        type: String
    },
    notes: {
        type: String
    },
    currency: {
        type: String
    },
    price: {
        type: Number
    },
    userCount: {
        type: Number
    },
    gstPercentage: {
        type: Number,
        default: 0,
    },
    discount: {
        type: Number,
        default: 0,
    },
    duration: {
        type: Number,
    },
    default: {
        type: Boolean,
        default: false,
    },
    applicableUserTypes: [{
        type: String,
        enum: ["SuperAdmin", "HoardingOwner", "BannerUser", "Worker"],
        default: ["HoardingOwner", "BannerUser"] // Default to these two user types
    }],
}, {
    timestamps: true,
});



module.exports = mongoose.model("Plan", planSchema);