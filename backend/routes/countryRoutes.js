const express = require("express");
const router = express.Router();
const {
    addCountry,
    getCountries,
    getCountryById,
    updateCountry,
    deleteCountry,
} = require('../Controllers/countryController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, addCountry);
router.get("/", protect, getCountries);
router.get("/:id", protect, getCountryById);
router.put("/:id", protect, updateCountry);
router.delete("/:id", protect, deleteCountry);

module.exports = router;