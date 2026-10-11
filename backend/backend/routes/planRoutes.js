const express = require("express");
const router = express.Router();
const {
  addPlan,
  getAllPlans,
  getPlan,
  updatePlan,
  deletePlan,
  runPlanCron,
} = require("../Controllers/planController");
const { protect } = require("../middleware/auth.js");

// Public route to get all plans
router.get("/", protect, getAllPlans);

// Routes for add, update, delete
router.post("/", protect, addPlan);
router.get("/:id", protect, getPlan);
router.put("/:id", protect, updatePlan);
router.delete("/:id", protect, deletePlan);

// Cron job route
router.post("/cron", protect, runPlanCron);

module.exports = router;
