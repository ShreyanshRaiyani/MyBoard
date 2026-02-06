const express = require("express");
const router = express.Router();
const {
    getAllQueues,
    getQueueById,
    getMyQueuePositions,
    removeFromQueue,
    forceProcessNext,
    updateQueueEntry,
    toggleQueueStatus
} = require('../Controllers/queueController.js');
const { protect } = require("../middleware/auth.js");

router.get("/", protect, getAllQueues);
router.get("/:id", protect, getQueueById);
router.get("/my-positions", protect, getMyQueuePositions);
router.delete("/:id", protect, removeFromQueue);
router.put("/:id", protect, updateQueueEntry);
router.post("/:id/force", protect, forceProcessNext);
router.patch("/:id/status", protect, toggleQueueStatus);


module.exports = router;