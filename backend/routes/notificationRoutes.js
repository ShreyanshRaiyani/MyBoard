const express = require("express");
const router = express.Router();
const {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getNotificationById,
    createBulkNotifications,
    getNotificationStats,
    updateNotification
} = require('../Controllers/notificationController.js');
const { protect } = require("../middleware/auth.js");

router.get("/", protect, getUserNotifications);
router.get("/unread", protect, getUnreadCount);
router.patch("/:id/read", protect, markAsRead);
router.patch("/read", protect, markAllAsRead);
router.delete("/:id", protect, deleteNotification);
router.delete("/", protect, deleteAllNotifications);

router.post("/bulk", protect, createBulkNotifications);
router.get("/admin/stats", protect, getNotificationStats);
router.patch("/admin/:id", protect, updateNotification);
router.get("/:id", protect, getNotificationById);

module.exports = router;