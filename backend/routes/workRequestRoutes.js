const express = require("express");
const router = express.Router();
const {
    createWorkRequest,
    getAllWorkRequests,
    getWorkRequestById,
    updateWorkRequest,
    deleteWorkRequest,
    reassignWorker
} = require('../Controllers/workRequestController.js');
const { protect } = require("../middleware/auth.js");
const { attachImage } = require("../middleware/uploadimage.js");

router.post("/", protect, attachImage, createWorkRequest);
router.get("/", protect, getAllWorkRequests);
router.get("/:id", protect, getWorkRequestById);
router.put("/:id", protect, updateWorkRequest);
router.delete("/:id", protect, deleteWorkRequest);
router.patch("/:id/reassign", protect, reassignWorker);

module.exports = router;