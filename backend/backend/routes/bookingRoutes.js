const express = require("express");
const router = express.Router();
const {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    respondToWorkRequest,
    getQueueStatus
} = require('../Controllers/bookingController.js');
const { protect } = require("../middleware/auth.js");

router.post("/",protect, createBooking);
router.get("/", protect, getAllBookings);
router.get("/:id", protect, getBookingById);
router.put("/:id", protect, updateBooking);
router.delete("/:id", protect, deleteBooking);
router.post("/respond",protect, respondToWorkRequest);
router.get("/queue/:hoardingId", protect, getQueueStatus);

module.exports = router;