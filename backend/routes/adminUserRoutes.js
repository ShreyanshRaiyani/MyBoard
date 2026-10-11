const express = require("express");
const router = express.Router();
const {
  createSuperUser,
  loginUser,
  verifyOtp,
  logout,
  getUser,
  updateUser,
} = require('../Controllers/adminController.js');
const { protect } = require("../middleware/auth.js");
const { uploadProfileImage } = require('../middleware/uploadimage.js');

router.post("/", createSuperUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.get("/:id", protect, getUser);
router.put("/:id", protect, uploadProfileImage, updateUser);
router.delete("/:id", protect, logout);

module.exports = router;
