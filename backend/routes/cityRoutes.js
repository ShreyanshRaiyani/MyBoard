const express = require("express");
const router = express.Router();
const {
    addCity,
    getCities,
    getCityById,
    updateCity,
    deleteCity,
} = require('../Controllers/cityController.js');
const { protect } = require("../middelware/auth.js");

router.post("/", addCity);
router.get("/", protect, getCities);
router.get("/:id", protect, getCityById);
router.put("/:id", protect, updateCity);
router.delete("/:id", protect, deleteCity);

module.exports = router;