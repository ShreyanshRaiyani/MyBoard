/**
 * Secure Backend Functions & Tools for MyBoard AI Chatbot
 * Validates all inputs and enforces Role-Based Access Control (RBAC).
 */

const mongoose = require("mongoose");
const Hoarding = require("../models/Hoarding");
const Booking = require("../models/Booking");
const Queue = require("../models/Queue");
const City = require("../models/City");
const Area = require("../models/Area");
const User = require("../models/User");

/**
 * Helper: Find City ID by name regex
 */
async function findCityByName(cityName) {
  if (!cityName) return null;
  const cleanName = String(cityName).trim();
  const cityDoc = await City.findOne({
    name: { $regex: new RegExp(`^${cleanName}$`, "i") }
  });
  if (cityDoc) return cityDoc._id;
  // Try partial match
  const partialCity = await City.findOne({
    name: { $regex: new RegExp(cleanName, "i") }
  });
  return partialCity ? partialCity._id : null;
}

/**
 * Helper: Find Area ID by name regex
 */
async function findAreaByName(areaName) {
  if (!areaName) return null;
  const cleanName = String(areaName).trim();
  const areaDoc = await Area.findOne({
    name: { $regex: new RegExp(cleanName, "i") }
  });
  return areaDoc ? areaDoc._id : null;
}

/**
 * Tool: Search Hoardings from MongoDB
 * Filters by location, price, type, and availability.
 */
async function searchHoardings(params = {}) {
  try {
    const {
      city,
      area,
      state,
      type,
      minPrice,
      maxPrice,
      status, // "Active", "Booked"
      query: searchQuery,
      limit = 6
    } = params;

    const filter = {
      isDeleted: false,
      isActive: true,
      approvalStatus: "Approved" // Only show approved hoardings to users
    };

    // Filter by availability status if explicitly specified
    if (status) {
      filter.status = status;
    }

    // Type filter
    if (type) {
      const validTypes = ["Billboard", "Pole", "Digital", "Wall", "Transit", "Other"];
      const matchedType = validTypes.find(t => t.toLowerCase() === String(type).toLowerCase());
      if (matchedType) {
        filter.type = matchedType;
      }
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.pricePerDay = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        filter.pricePerDay.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        filter.pricePerDay.$lte = Number(maxPrice);
      }
    }

    // Location: City
    if (city) {
      let cityId = null;
      if (mongoose.Types.ObjectId.isValid(city)) {
        cityId = city;
      } else {
        cityId = await findCityByName(city);
      }
      if (cityId) {
        filter["location.city"] = cityId;
      }
    }

    // Location: Area
    if (area) {
      let areaId = null;
      if (mongoose.Types.ObjectId.isValid(area)) {
        areaId = area;
      } else {
        areaId = await findAreaByName(area);
      }
      if (areaId) {
        filter["location.area"] = areaId;
      }
    }

    // Free text search in name or description
    if (searchQuery && typeof searchQuery === "string" && searchQuery.trim().length > 1) {
      const q = searchQuery.trim();
      filter.$or = [
        { hoardingName: { $regex: new RegExp(q, "i") } },
        { hoardingCode: { $regex: new RegExp(q, "i") } },
        { description: { $regex: new RegExp(q, "i") } },
        { "location.address": { $regex: new RegExp(q, "i") } }
      ];
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 20);

    const hoardings = await Hoarding.find(filter)
      .populate("location.city", "name")
      .populate("location.area", "name")
      .populate("location.state", "name")
      .populate("dimensions.unit", "unitName")
      .populate("owner", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    return hoardings.map(h => ({
      _id: h._id,
      id: h._id,
      hoardingName: h.hoardingName,
      hoardingCode: h.hoardingCode,
      type: h.type,
      pricePerDay: h.pricePerDay,
      status: h.status,
      dimensions: {
        width: h.dimensions?.width,
        height: h.dimensions?.height,
        area: h.dimensions?.area,
        unit: h.dimensions?.unit?.unitName || "ft"
      },
      location: {
        address: h.location?.address || "",
        area: h.location?.area?.name || "",
        city: h.location?.city?.name || "",
        state: h.location?.state?.name || "",
        pincode: h.location?.pincode || "",
        coordinates: h.location?.coordinates || null
      },
      images: Array.isArray(h.images) && h.images.length > 0
        ? h.images.map(img => (typeof img === "string" ? img : img.url)).filter(Boolean)
        : [],
      owner: h.owner ? `${h.owner.firstName || ""} ${h.owner.lastName || ""}`.trim() : "Vendor"
    }));
  } catch (error) {
    console.error("Error in searchHoardings tool:", error);
    return [];
  }
}

/**
 * Tool: Get Bookings for Authenticated User (Strict RBAC)
 */
async function getUserBookings(userContext = {}, params = {}) {
  try {
    const { userId, userType } = userContext;

    if (!userId || !userType) {
      return {
        error: "AUTHENTICATION_REQUIRED",
        message: "You need to be logged in to view your bookings. Please log in or sign up."
      };
    }

    const { status, limit = 5 } = params;
    const query = {};

    // Role-based restrictions
    if (userType === "BannerUser" || userType === "bannerUser") {
      query.bannerUser = userId;
    } else if (userType === "HoardingOwner" || userType === "hoardingOwner") {
      query.hoardingOwner = userId;
    } else if (userType === "SuperAdmin") {
      // SuperAdmin can filter by specific user or view recent system bookings
      if (params.targetUserId) {
        query.bannerUser = params.targetUserId;
      }
    } else {
      return {
        error: "UNAUTHORIZED_ROLE",
        message: "Your role does not have personal booking records."
      };
    }

    if (status) {
      query["ownerResponse.status"] = status;
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 15);

    const bookings = await Booking.find(query)
      .populate("hoarding", "hoardingName hoardingCode location pricePerDay images")
      .populate("bannerUser", "firstName lastName email mobileNumber")
      .populate("hoardingOwner", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    // Check queue entries if user is a BannerUser
    let queueMap = {};
    if (userType === "BannerUser" || userType === "bannerUser") {
      const activeQueues = await Queue.find({
        "queue.bannerUser": userId,
        isActive: true
      }).lean();

      activeQueues.forEach(q => {
        const found = q.queue.find(item => item.bannerUser?.toString() === userId.toString());
        if (found) {
          queueMap[found.bookingRequest?.toString()] = {
            position: found.position,
            status: found.status,
            nextAvailableDate: q.nextAvailableDate
          };
        }
      });
    }

    return bookings.map(b => {
      const qInfo = queueMap[b._id?.toString()];
      return {
        _id: b._id,
        requestNumber: b.requestNumber,
        campaignName: b.campaignName,
        hoarding: {
          _id: b.hoarding?._id,
          hoardingName: b.hoarding?.hoardingName || "N/A",
          hoardingCode: b.hoarding?.hoardingCode || "N/A",
          city: b.hoarding?.location?.city?.name || "",
          address: b.hoarding?.location?.address || "",
          images: b.hoarding?.images?.map(i => (typeof i === "string" ? i : i.url)) || []
        },
        duration: {
          startDate: b.duration?.startDate,
          endDate: b.duration?.endDate,
          totalDays: b.duration?.totalDays
        },
        pricing: {
          totalAmount: b.pricing?.totalAmount || 0,
          basePrice: b.pricing?.basePrice || 0
        },
        status: b.ownerResponse?.status || "Pending",
        ownerRemarks: b.ownerResponse?.remarks || "",
        rejectionReason: b.ownerResponse?.rejectionReason || "",
        paymentStatus: b.paymentStatus || "Pending",
        inQueue: !!qInfo,
        queuePosition: qInfo ? qInfo.position : null,
        createdAt: b.createdAt
      };
    });
  } catch (error) {
    console.error("Error in getUserBookings tool:", error);
    return { error: "DB_ERROR", message: "Failed to fetch bookings from database." };
  }
}

/**
 * Tool: Get Booking Analytics & Insights (SuperAdmin & HoardingOwner only)
 */
async function getBookingAnalytics(userContext = {}) {
  try {
    const { userId, userType } = userContext;

    if (!userId || !userType) {
      return {
        error: "AUTHENTICATION_REQUIRED",
        message: "Admin or Hoarding Owner authentication is required to access analytics."
      };
    }

    if (userType !== "SuperAdmin" && userType !== "HoardingOwner") {
      return {
        error: "FORBIDDEN",
        message: "Access restricted: Booking analytics are only accessible by Platform Admins and Billboard Owners."
      };
    }

    const isSuperAdmin = userType === "SuperAdmin";
    const filter = {};
    if (!isSuperAdmin) {
      filter.hoardingOwner = new mongoose.Types.ObjectId(userId);
    }

    // Booking counts by status
    const totalBookings = await Booking.countDocuments(filter);
    const approvedBookings = await Booking.countDocuments({ ...filter, "ownerResponse.status": "Approved" });
    const pendingBookings = await Booking.countDocuments({ ...filter, "ownerResponse.status": "Pending" });
    const rejectedBookings = await Booking.countDocuments({ ...filter, "ownerResponse.status": "Rejected" });

    // Payment stats
    const paidBookings = await Booking.countDocuments({ ...filter, paymentStatus: "Paid" });
    const pendingPayments = await Booking.countDocuments({ ...filter, paymentStatus: "Pending" });

    // Revenue calculation
    const revenueAgg = await Booking.aggregate([
      { $match: { ...filter, paymentStatus: "Paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$pricing.totalAmount" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    // Hoarding counts
    const hoardingFilter = { isDeleted: false };
    if (!isSuperAdmin) {
      hoardingFilter.owner = new mongoose.Types.ObjectId(userId);
    }
    const totalHoardings = await Hoarding.countDocuments(hoardingFilter);
    const activeHoardings = await Hoarding.countDocuments({ ...hoardingFilter, status: "Active", isActive: true });
    const bookedHoardings = await Hoarding.countDocuments({ ...hoardingFilter, status: "Booked" });

    // Pending hoarding approvals (for SuperAdmin)
    let pendingApprovalHoardings = 0;
    if (isSuperAdmin) {
      pendingApprovalHoardings = await Hoarding.countDocuments({ approvalStatus: "Pending", isDeleted: false });
    }

    return {
      scope: isSuperAdmin ? "Platform-wide (SuperAdmin)" : "My Billboards (Owner)",
      totalBookings,
      approvedBookings,
      pendingBookings,
      rejectedBookings,
      paidBookings,
      pendingPayments,
      totalRevenue,
      totalHoardings,
      activeHoardings,
      bookedHoardings,
      pendingApprovalHoardings: isSuperAdmin ? pendingApprovalHoardings : undefined,
      occupancyRate: totalHoardings > 0 ? `${Math.round((bookedHoardings / totalHoardings) * 100)}%` : "0%"
    };
  } catch (error) {
    console.error("Error in getBookingAnalytics tool:", error);
    return { error: "AGGREGATION_ERROR", message: "Failed to compile business analytics." };
  }
}

/**
 * Tool: Check Hoarding Availability for dates
 */
async function checkHoardingAvailability(hoardingIdOrCode, startDate, endDate) {
  try {
    let hoarding = null;
    if (mongoose.Types.ObjectId.isValid(hoardingIdOrCode)) {
      hoarding = await Hoarding.findById(hoardingIdOrCode);
    } else {
      hoarding = await Hoarding.findOne({
        hoardingCode: { $regex: new RegExp(`^${hoardingIdOrCode}$`, "i") }
      });
    }

    if (!hoarding) {
      return { found: false, message: "Hoarding not found." };
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Look for conflicting approved bookings
    const conflicts = await Booking.find({
      hoarding: hoarding._id,
      "ownerResponse.status": "Approved",
      $or: [
        { "duration.startDate": { $lte: end }, "duration.endDate": { $gte: start } }
      ]
    }).lean();

    const queue = await Queue.findOne({ hoarding: hoarding._id, isActive: true }).lean();
    const queueLength = queue?.queue?.length || 0;

    const isAvailable = conflicts.length === 0 && hoarding.status === "Active";

    return {
      found: true,
      hoardingName: hoarding.hoardingName,
      hoardingCode: hoarding.hoardingCode,
      pricePerDay: hoarding.pricePerDay,
      status: hoarding.status,
      isAvailable,
      conflictsCount: conflicts.length,
      queueLength,
      nextAvailableDate: queue?.nextAvailableDate || null,
      message: isAvailable
        ? `Hoarding '${hoarding.hoardingName}' is available for these dates at ₹${hoarding.pricePerDay}/day.`
        : `Hoarding is currently booked or in queue. Current queue length: ${queueLength} advertisers waiting.`
    };
  } catch (error) {
    console.error("Error in checkHoardingAvailability:", error);
    return { found: false, message: "Error checking hoarding availability." };
  }
}

module.exports = {
  searchHoardings,
  getUserBookings,
  getBookingAnalytics,
  checkHoardingAvailability,
  findCityByName,
  findAreaByName
};

