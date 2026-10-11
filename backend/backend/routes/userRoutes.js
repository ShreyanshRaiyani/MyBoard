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

const { protect } = require('../middleware/auth');
const {
  attachImage,
} = require('../middleware/uploadimage');


router.post("/signup", signUp);
router.post("/login", login);
router.post("/verifyOtp", verifyOTP);
router.get("/", protect, getAllUsers);
router.get("/:id", protect, getUserById);
router.put("/:id", protect, attachImage, updateUser);
router.delete("/logout", protect, logout);

router.delete("/:id", protect, deleteUser);

module.exports = router;
