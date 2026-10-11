const mongoose = require("mongoose");

const compnayHaordingSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    hoardingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hoarding',
        required: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: false
        }
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'In Queue', 'Expired'], default: 'In Queue' },
}, { timestamps: true });

module.exports = mongoose.model("CompanyHoarding", compnayHaordingSchema);