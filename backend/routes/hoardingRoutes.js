const express = require("express");
const router = express.Router();
const {
    createHoarding,
    getAllHoardings,
    getHoardingById,
    updateHoarding,
    deleteHoarding,
    updateHoardingStatus
} = require('../Controllers/hoardingController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, createHoarding);
router.get("/", protect, getAllHoardings);
router.get("/:id", protect, getHoardingById);
router.put("/:id", protect, updateHoarding);
router.delete("/:id", protect, deleteHoarding);
router.patch("/status/:id", protect, updateHoardingStatus);

module.exports = router;