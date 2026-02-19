const express = require("express");
const router = express.Router();
const {
     createHoarding,
    getAllHoardings,
    getHoardingById,
    updateHoarding,
    deleteHoarding,
    getHoardingsByOwner,
    getNearbyPOIs
} = require('../Controllers/hoardingController.js');
const { attachImage}= require('../middleware/uploadimage.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect,attachImage, createHoarding);
router.get("/owner/:id", protect, getHoardingsByOwner);
router.get("/", protect, getAllHoardings);
router.get("/:id", protect, getHoardingById);
router.put("/:id", protect, attachImage, updateHoarding);
router.delete("/:id", protect, deleteHoarding);
router.get("/:id/nearby", protect, getNearbyPOIs);

module.exports = router;