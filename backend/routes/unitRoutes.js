const express = require("express");
const router = express.Router();
const {
    createUnit,
    getUnits,
    getUnit,
    updateUnit,
    deleteUnit,
} = require('../Controllers/unitController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, createUnit);
router.get("/", protect, getUnits);
router.get("/:id", protect, getUnit);
router.put("/:id", protect, updateUnit);
router.delete("/:id", protect, deleteUnit);

module.exports = router;