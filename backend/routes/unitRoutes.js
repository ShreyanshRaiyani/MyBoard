const express = require("express");
const router = express.Router();
const {
    createUnit,
    getUnits,
    getUnit,
    updateUnit,
    deleteUnit,
} = require('../Controllers/unitController.js');
const { protect } = require("../middelware/auth.js");

router.post("/", createUnit);
router.get("/", protect, getUnits);
router.get("/:id", protect, getUnit);
router.put("/:id", protect, updateUnit);
router.delete("/:id", protect, deleteUnit);

module.exports = router;