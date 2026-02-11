const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      required: true,
    },
    bannerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hoarding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hoarding",
      required: true,
    },
    hoardingOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    campaignName: {
      type: String,
      required: true,
    },
    duration: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      totalDays: { type: Number },
    },
    pricing: {
      basePrice: { type: Number },
      discount: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },
    ownerResponse: {
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      responseDate: { type: Date },
      remarks: { type: String },
      rejectionReason: { type: String },
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "PartiallyPaid", "Paid", "Refunded"],
      default: "Pending",
    },
    paymentDetails: {
      paymentId: { type: String },
      transactionId: { type: String },
      paymentDate: { type: Date },
      paymentMethod: { type: String },
      amount: { type: Number },
    },
    notes: {
      type: String,
    },
    // Link to work assignment once approved
    workRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkRequest",
    },
  },
  { timestamps: true }
);

// Calculate total days before saving
bookingSchema.pre("save", function (next) {
  if (this.duration.startDate && this.duration.endDate) {
    const diffTime = Math.abs(this.duration.endDate - this.duration.startDate);
    this.duration.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  next();
});

function autoPopulate(next) {
  this.populate("bannerUser", "firstName lastName email mobileNumber business");
  this.populate("hoarding");
  this.populate("hoardingOwner", "firstName lastName email mobileNumber business");
  this.populate("workRequest");
  next();
}

bookingSchema.pre("find", autoPopulate);
bookingSchema.pre("findOne", autoPopulate);
bookingSchema.pre("findById", autoPopulate);

module.exports = mongoose.model("Booking", bookingSchema);