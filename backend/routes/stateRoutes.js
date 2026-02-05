const express = require("express");
const router = express.Router();
const {
    addState,
    getStates,
    getStateById,
    updateState,
    deleteState,
} = require('../Controllers/stateController.js');
const { protect } = require("../middelware/auth.js");

router.post("/", addState);
router.get("/", protect, getStates);
router.get("/:id", protect, getStateById);
router.put("/:id", protect, updateState);
router.delete("/:id", protect, deleteState);

module.exports = router;