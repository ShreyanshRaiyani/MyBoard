// models/Queue.js
const mongoose = require("mongoose");

const queueSchema = new mongoose.Schema(
  {
    hoarding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hoarding",
      required: true,
      unique: true,
    },
    hoardingOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    queue: [
      {
        bannerUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        bookingRequest: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Booking",
          required: true,
        },
        position: { type: Number, required: true },
        joinDate: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["Waiting", "Approved", "Rejected"],
          default: "Waiting",
        },
        // estimatedStartDate: { type: Date },
        // estimatedEndDate: { type: Date },
      },
    ],
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    nextAvailableDate: { type: Date },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Queue", queueSchema);