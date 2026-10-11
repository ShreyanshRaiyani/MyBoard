const cron = require("node-cron");
const PurchasePlan = require("../models/purchasePlan");
const User = require("../models/User");

const PLAN_EXPIRY_SCHEDULE = "0 * * * *"; // hourly

const runPlanExpiryJob = async () => {
  const now = new Date();

  const expiredPlans = await PurchasePlan.updateMany(
    {
      endDate: { $lte: now },
      isExpired: false,
    },
    {
      isExpired: true,
      expiredAt: now,
    }
  );

  const expiredUserIds = await PurchasePlan.distinct("user", {
    endDate: { $lte: now },
  });
  if (expiredUserIds.length === 0) {
    return { expiredPlanCount: expiredPlans.modifiedCount, inactivatedUsers: 0 };
  }

  const activeUserIds = await PurchasePlan.distinct("user", {
    endDate: { $gt: now },
    isExpired: false,
  });

  const activeIdSet = new Set(activeUserIds.map((id) => id.toString()));
  const inactiveUserIds = expiredUserIds.filter(
    (id) => !activeIdSet.has(id.toString())
  );

  if (inactiveUserIds.length === 0) {
    return { expiredPlanCount: expiredPlans.modifiedCount, inactivatedUsers: 0 };
  }

  const updatedUsers = await User.updateMany(
    { _id: { $in: inactiveUserIds }, userStatus: { $ne: "Inactive" } },
    { userStatus: "Inactive" }
  );

  return {
    expiredPlanCount: expiredPlans.modifiedCount,
    inactivatedUsers: updatedUsers.modifiedCount,
  };
};

const startPlanExpiryCron = () => {
  cron.schedule(PLAN_EXPIRY_SCHEDULE, async () => {
    try {
      const result = await runPlanExpiryJob();
      console.log("Plan expiry cron completed:", result);
    } catch (error) {
      console.error("Plan expiry cron failed:", error);
    }
  });
};

module.exports = {
  startPlanExpiryCron,
  runPlanExpiryJob,
};
