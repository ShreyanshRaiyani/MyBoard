const express = require("express");
const router = express.Router();
const {
     createHoarding,
    getAllHoardings,
    getHoardingById,
    updateHoarding,
    deleteHoarding,
    getHoardingsByOwner
} = require('../Controllers/hoardingController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, createHoarding);
router.get("/", protect, getAllHoardings);
router.get("/:id", protect, getHoardingById);
router.put("/:id", protect, updateHoarding);
router.delete("/:id", protect, deleteHoarding);
router.get("/owner/:id", protect, getHoardingsByOwner);

module.exports = router;