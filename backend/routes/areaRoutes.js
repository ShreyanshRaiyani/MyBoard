const express = require("express");
const router = express.Router();
const {
    addArea,
    getAreas,
    getAreaById,
    updateArea,
    deleteArea,
} = require('../Controllers/areaController.js');
const { protect } = require("../middelware/auth.js");

router.post("/", addArea);
router.get("/", protect, getAreas);
router.get("/:id", protect, getAreaById);
router.put("/:id", protect, updateArea);
router.delete("/:id", protect, deleteArea);

module.exports = router;