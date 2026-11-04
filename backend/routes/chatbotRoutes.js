const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const {
  handleChatMessage,
  getChatHistory,
  clearChatHistory,
  getSuggestions,
  getChatStatus
} = require("../Controllers/chatbotController");

/**
 * Optional authentication middleware:
 * Attaches user to req.user if valid token provided; allows guest access otherwise.
 */
const optionalProtect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization) {
    try {
      if (req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      } else {
        token = req.headers.authorization;
      }

      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          req.userId = decoded.id;
          req.user = user;
        }
      }
    } catch (err) {
      // Token expired or invalid - proceed as guest
      req.user = null;
      req.userId = null;
    }
  }

  next();
};

router.post("/message", optionalProtect, handleChatMessage);
router.get("/history/:sessionId", optionalProtect, getChatHistory);
router.delete("/history/:sessionId", optionalProtect, clearChatHistory);
router.get("/suggestions", optionalProtect, getSuggestions);
router.get("/status", getChatStatus);

module.exports = router;

