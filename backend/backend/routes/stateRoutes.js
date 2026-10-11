const express = require("express");
const router = express.Router();
const {
    addState,
    getStates,
    getStateById,
    updateState,
    deleteState,
} = require('../Controllers/stateController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, addState);
router.get("/", protect, getStates);
router.get("/:id", protect, getStateById);
router.put("/:id", protect, updateState);
router.delete("/:id", protect, deleteState);

module.exports = router;