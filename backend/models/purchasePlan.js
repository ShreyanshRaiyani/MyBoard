const mongoose = require("mongoose");

const purchasePlanSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        plan: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Plan",
            },
        ],

        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },

        isExpired: { type: Boolean, default: false },
        expiredAt: { type: Date },

        // fees: { type: String },
        // joiningDate: { type: Date },
        price: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("PurchasePlan", purchasePlanSchema);