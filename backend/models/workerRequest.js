const mongoose = require("mongoose");

const workRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      required: true,
    },
    bannerRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    bannerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hoarding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hoarding",
      required: true,
    },
    // workType: {
    //   type: String,
    //   enum: ["Installation", "Maintenance", "Removal", "Replacement"],
    //   required: true,
    // },
    // workDetails: {
    //   title: { type: String, required: true },
    //   description: { type: String },
    //   specialInstructions: { type: String },
    //   materialsRequired: [{ type: String }],
    // },
    scheduledDate: {
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      preferredTimeSlot: { type: String }, // "Morning", "Afternoon", "Evening"
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    RequestStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
    workerResponse: {
      // status: {
      //   type: String,
      //   enum: ["Pending", "Accepted", "Rejected"],
      //   default: "Pending",
      // },
      responseDate: { type: Date },
      // remarks: { type: String },
      rejectionReason: { type: String },
      // estimatedCompletionDate: { type: Date },
    },
    payment: {
      workerFee: { type: Number, required: true },
      paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
      },
      paymentDate: { type: Date },
      transactionId: { type: String },
    },
    workProgress: [
      {
        status: { type: String },
        description: { type: String },
        images: [{ type: String }],
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    completionDetails: {
      completedDate: { type: Date },
      completionNotes: { type: String },
      beforeImages: [{ type: String }],
      afterImages: [{ type: String }],
      // workerSignature: { type: String },
      // bannerUserSignature: { type: String },
    },
    rating: {
      ratingByBannerUser: {
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String },
        ratedDate: { type: Date },
      },
      ratingByWorker: {
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String },
        ratedDate: { type: Date },
      },
    },
    issues: [
      {
        issueType: { type: String },
        description: { type: String },
        reportedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reportedDate: { type: Date, default: Date.now },
        resolvedDate: { type: Date },
        resolution: { type: String },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true }
);

function autoPopulate(next) {
  this.populate("bannerRequest");
  this.populate("bannerUser", "firstName lastName email mobileNumber business");
  this.populate("worker", "firstName lastName email mobileNumber workerType");
  this.populate("hoarding", "hoardingName location");
  next();
}

workRequestSchema.pre("find", autoPopulate);
workRequestSchema.pre("findOne", autoPopulate);
workRequestSchema.pre("findById", autoPopulate);

module.exports = mongoose.model("WorkRequest", workRequestSchema);