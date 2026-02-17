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
router.get("/my-positions", protect, getMyQueuePositions);
router.get("/:id", protect, getQueueById);
router.delete("/:queueId", protect, removeFromQueue);
router.put("/:queueId/entries/:entryId", protect, updateQueueEntry);
router.post("/:queueId/force", protect, forceProcessNext);
router.patch("/:queueId/status", protect, toggleQueueStatus);


module.exports = router;