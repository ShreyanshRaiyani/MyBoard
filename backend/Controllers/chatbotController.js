const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const ChatMessage = require("../models/ChatMessage");
const {
  processChatMessage,
  generateSuggestedQuestions,
  getLanguageModel
} = require("../services/chatbotService");

/**
 * 1. Process Chat Message
 * POST /api/chat/message
 */
const handleChatMessage = asyncHandler(async (req, res) => {
  const { message, sessionId: clientSessionId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      status: 0,
      error: "Message is required and must not be empty"
    });
  }

  // Ensure persistent session ID
  const sessionId = clientSessionId && clientSessionId.trim()
    ? clientSessionId.trim()
    : `session_${crypto.randomUUID()}`;

  // Build authenticated user context
  const userContext = {
    userId: req.user ? (req.user._id || req.user.id) : null,
    userType: req.user ? req.user.userType : "Guest",
    firstName: req.user ? req.user.firstName : null,
    lastName: req.user ? req.user.lastName : null,
    email: req.user ? req.user.email : null
  };

  // 1. Save User Message to MongoDB
  try {
    await ChatMessage.create({
      sessionId,
      user: userContext.userId,
      userType: userContext.userType,
      role: "user",
      content: message.trim()
    });
  } catch (err) {
    console.warn("Failed to persist user chat message:", err.message);
  }

  // 2. Process message through AI Chatbot Service
  const result = await processChatMessage({
    message: message.trim(),
    sessionId,
    userContext
  });

  // 3. Save Assistant Reply to MongoDB
  try {
    await ChatMessage.create({
      sessionId,
      user: userContext.userId,
      userType: userContext.userType,
      role: "assistant",
      content: result.reply,
      metadata: {
        toolCalled: result.metadata?.toolCalled || null,
        hoardingsCount: result.metadata?.hoardings?.length || 0,
        hoardings: result.metadata?.hoardings || [],
        bookings: result.metadata?.bookings || [],
        analytics: result.metadata?.analytics || null,
        suggestedQuestions: result.metadata?.suggestedQuestions || []
      }
    });
  } catch (err) {
    console.warn("Failed to persist assistant chat message:", err.message);
  }

  res.status(200).json({
    status: 1,
    sessionId,
    reply: result.reply,
    metadata: result.metadata
  });
});

/**
 * 2. Get Chat History for a Session
 * GET /api/chat/history/:sessionId
 */
const getChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      status: 0,
      error: "Session ID is required"
    });
  }

  const messages = await ChatMessage.find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  res.status(200).json({
    status: 1,
    sessionId,
    messages: messages.map((m) => ({
      _id: m._id,
      role: m.role,
      content: m.content,
      metadata: m.metadata || {},
      createdAt: m.createdAt
    }))
  });
});

/**
 * 3. Clear Chat History
 * DELETE /api/chat/history/:sessionId
 */
const clearChatHistory = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({
      status: 0,
      error: "Session ID is required"
    });
  }

  await ChatMessage.deleteMany({ sessionId });

  res.status(200).json({
    status: 1,
    message: "Conversation history cleared successfully",
    sessionId
  });
});

/**
 * 4. Get Role-Tailored Suggestions
 * GET /api/chat/suggestions
 */
const getSuggestions = asyncHandler(async (req, res) => {
  const userType = req.user ? req.user.userType : "Guest";
  const suggestions = generateSuggestedQuestions(userType);

  res.status(200).json({
    status: 1,
    userType,
    suggestions
  });
});

/**
 * 5. Get AI Service Status
 * GET /api/chat/status
 */
const getChatStatus = asyncHandler(async (req, res) => {
  const { provider } = getLanguageModel();
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  res.status(200).json({
    status: 1,
    aiProvider: provider,
    hasGeminiKey,
    hasOpenAIKey,
    ragEnabled: true,
    dbToolsConnected: true
  });
});

module.exports = {
  handleChatMessage,
  getChatHistory,
  clearChatHistory,
  getSuggestions,
  getChatStatus
};

