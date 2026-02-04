const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: String,
      unique: true,
      required: true,
    },
    workAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerRequest",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    hoarding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hoarding",
      required: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: [
        "Assigned",
        "Accepted",
        "Rejected",
        "InProgress",
        "OnHold",
        "Completed",
        "Verified",
        "Cancelled",
      ],
      default: "Assigned",
    },
    estimatedDuration: {
      type: Number, // in hours
    },
    location: {
      address: { type: String },
      city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
    },
    materialsNeeded: [
      {
        materialName: { type: String },
        quantity: { type: Number },
        unit: { type: String },
      },
    ],
    toolsRequired: [{ type: String }],
    safetyRequirements: [{ type: String }],
    checklistItems: [
      {
        item: { type: String },
        completed: { type: Boolean, default: false },
        completedDate: { type: Date },
      },
    ],
    progress: {
      startTime: { type: Date },
      endTime: { type: Date },
      pausedDuration: { type: Number, default: 0 }, // in minutes
      actualDuration: { type: Number }, // in hours
      progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    },
    updates: [
      {
        updateText: { type: String },
        images: [{ type: String }],
        timestamp: { type: Date, default: Date.now },
      },
    ],
    completionDetails: {
      completedDate: { type: Date },
      completionNotes: { type: String },
      images: [{ type: String }],
      signature: { type: String },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      verifiedDate: { type: Date },
    },
    issues: [
      {
        issueDescription: { type: String },
        severity: {
          type: String,
          enum: ["Minor", "Moderate", "Major", "Critical"],
        },
        reportedDate: { type: Date, default: Date.now },
        resolvedDate: { type: Date },
        resolution: { type: String },
      },
    ],
    isUrgent: {
      type: Boolean,
      default: false,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    notes: { type: String },
  },
  { timestamps: true }
);

// Calculate total expense
taskSchema.pre("save", function (next) {
  if (this.expenses && this.expenses.length > 0) {
    this.totalExpense = this.expenses.reduce(
      (total, expense) => total + (expense.amount || 0),
      0
    );
  }
  next();
});

// Calculate actual duration
taskSchema.pre("save", function (next) {
  if (this.progress.startTime && this.progress.endTime) {
    const diffMs = this.progress.endTime - this.progress.startTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    const pausedHours = (this.progress.pausedDuration || 0) / 60;
    this.progress.actualDuration = diffHours - pausedHours;
  }
  next();
});

function autoPopulate(next) {
  this.populate("workRequest", "requestNumber description");
  this.populate("worker", "firstName lastName email mobileNumber workerType");
  this.populate("assignedBy", "firstName lastName email");
  this.populate("hoarding", "hoardingName location");
  this.populate("location.city");
  this.populate("completionDetails.verifiedBy", "firstName lastName");
  next();
}

taskSchema.pre("find", autoPopulate);
taskSchema.pre("findOne", autoPopulate);
taskSchema.pre("findById", autoPopulate);

// Index for efficient querying
taskSchema.index({ worker: 1, status: 1 });
taskSchema.index({ scheduledDate: 1 });
taskSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);