const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  // Recipient
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  
  // Content
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: [
      "booking_request",
      "booking_approved",
      "booking_rejected",
      "worker_request",
      "worker_approved",
      "worker_rejected",
      "queue_joined",
      "payment",
      "system",
    ], 
    required: true 
  },
  
  // Related Entity
  relatedTo: {
    model: String, // 'Booking', 'WorkerRequest', 'Task', etc.
    id: mongoose.Schema.Types.ObjectId
  },
  
  // Status
  isRead: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  
  // Action
  actionUrl: String, 
  actionLabel: String,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
  expiresAt: Date
}, { timestamps: true });

// Index for faster queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", notificationSchema);