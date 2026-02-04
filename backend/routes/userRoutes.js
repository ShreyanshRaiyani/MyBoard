const express = require("express");
const router = express.Router();
const {
  signUp,
  login,
  getAllUsers,
  getUserById,
  deleteUser,
  updateUser,
  verifyOTP,
  resendOTP,
  logout,
} = require("../Controllers/userController");

const { protect } = require('../middelware/auth');
const {
  attachImage,
} = require('../middelware/uploadimage');


router.post("/signup", signUp);
router.put("/:id", protect, attachImage, updateUser);
router.post("/login", login);
router.post("/verifyOtp", verifyOTP);
router.get("/", protect, getAllUsers);
router.get("/:id", protect, getUserById);
router.delete("/logout", protect, logout);

router.delete("/:id", protect, deleteUser);

module.exports = router;
