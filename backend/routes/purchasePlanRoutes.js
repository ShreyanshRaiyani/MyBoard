const express = require("express");
const router = express.Router();
const {
    purchasePlan,
    getUserPurchasedPlans,
    getActivePlan,
    renewPlan,
    checkExpiredPlans,
    getPurchaseHistory,
} = require("../Controllers/purchasePlanController");
const { protect } = require("../middleware/auth.js");

router.post("/purchase", protect, purchasePlan);
router.get("/user/:id", protect, getUserPurchasedPlans);
router.get("/active/:id", protect, getActivePlan);
router.put("/renew", protect, renewPlan);
router.post("/check-expired", protect, checkExpiredPlans);
router.get("/history", protect, getPurchaseHistory);

module.exports = router;
