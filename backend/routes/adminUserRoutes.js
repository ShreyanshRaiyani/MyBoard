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
const { protect } = require("../middelware/auth.js");
const { uploadProfileImage } = require('../middelware/uploadimage.js');

router.post("/", createSuperUser);
router.post("/login", loginUser);
router.post("/verify-Otp", verifyOtp);
router.get("/", protect, getUser);
router.put("/", protect, uploadProfileImage, updateUser);

module.exports = router;
