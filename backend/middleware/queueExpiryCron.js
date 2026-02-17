const cron = require("node-cron");
const Queue = require("../models/Queue");
const Hoarding = require("../models/Hoarding");
const Booking = require("../models/Booking");

const QUEUE_EXPIRY_SCHEDULE = "0 * * * *"; // hourly

const runQueueExpiryJob = async () => {
  const now = new Date();

  const queues = await Queue.find({ currentBooking: { $ne: null } }).populate(
    "currentBooking",
    "duration"
  );

  let processed = 0;
  let promoted = 0;
  let cleared = 0;

  for (const queue of queues) {
    const currentBooking = queue.currentBooking;
    const endDate = currentBooking?.duration?.endDate;

    if (!endDate || endDate > now) {
      continue;
    }

    processed += 1;

    const previousEndDate = new Date(endDate);

    if (queue.queue && queue.queue.length > 0) {
      const nextBookingRequest = queue.queue[0].bookingRequest;

      queue.currentBooking = nextBookingRequest;
      queue.nextAvailableDate = new Date(previousEndDate);
      queue.nextAvailableDate.setDate(queue.nextAvailableDate.getDate() + 1);

      queue.queue.shift();
      queue.queue.forEach((entry, index) => {
        entry.position = index + 1;
      });

      await queue.save();

      await Promise.all([
        Hoarding.findByIdAndUpdate(queue.hoarding, { status: "Booked" }),
        Booking.findByIdAndUpdate(nextBookingRequest, {
          "ownerResponse.status": "Approved",
          "ownerResponse.responseDate": new Date(),
        }),
      ]);

      promoted += 1;
      continue;
    }

    queue.currentBooking = null;
    queue.nextAvailableDate = null;
    queue.isActive = false;
    await queue.save();

    await Hoarding.findByIdAndUpdate(queue.hoarding, { status: "Active" });

    cleared += 1;
  }

  return { processed, promoted, cleared };
};

const startQueueExpiryCron = () => {
  cron.schedule(QUEUE_EXPIRY_SCHEDULE, async () => {
    try {
      const result = await runQueueExpiryJob();
      console.log("Queue expiry cron completed:", result);
    } catch (error) {
      console.error("Queue expiry cron failed:", error);
    }
  });
};

module.exports = {
  startQueueExpiryCron,
  runQueueExpiryJob,
};
