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

// Public route to get all plans
router.get("/", getAllPlans);

// Routes for add, update, delete
router.post("/", addPlan);
router.get("/:id", getPlan);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

// Cron job route
router.post("/cron", runPlanCron);

module.exports = router;
