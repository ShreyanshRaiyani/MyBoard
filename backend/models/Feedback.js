const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    workRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkRequest",
      required: true,
    },
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    givenTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
    feedbackDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
feedbackSchema.index({ givenTo: 1 });
feedbackSchema.index({ givenBy: 1 });
feedbackSchema.index({ workRequest: 1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
