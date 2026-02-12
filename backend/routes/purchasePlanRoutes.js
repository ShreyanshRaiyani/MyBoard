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

router.post("/purchase", purchasePlan);
router.get("/user/:id", getUserPurchasedPlans);
router.get("/active/:id", getActivePlan);
router.put("/renew", renewPlan);
router.post("/check-expired", checkExpiredPlans);
router.get("/history", getPurchaseHistory);

module.exports = router;
