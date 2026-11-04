const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userType: {
      type: String,
      enum: ["SuperAdmin", "HoardingOwner", "BannerUser", "Worker", "Guest"],
      default: "Guest",
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      toolCalled: { type: String, default: null },
      hoardingsCount: { type: Number, default: 0 },
      hoardings: [{ type: mongoose.Schema.Types.Mixed }],
      bookings: [{ type: mongoose.Schema.Types.Mixed }],
      analytics: { type: mongoose.Schema.Types.Mixed, default: null },
      suggestedQuestions: [{ type: String }],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);

