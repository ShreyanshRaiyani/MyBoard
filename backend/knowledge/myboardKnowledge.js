/**
 * MyBoard Knowledge Base & RAG Retrieval Engine
 * Provides detailed platform documentation, policies, FAQs, and semantic context matching.
 */

const KNOWLEDGE_ARTICLES = [
  {
    id: "about_myboard",
    category: "general",
    title: "About MyBoard Platform",
    keywords: ["what is myboard", "about", "overview", "platform", "features", "how it works", "introduction"],
    content: `MyBoard is an end-to-end Hoarding & Billboard Management System designed for outdoor media advertising (OOH - Out Of Home).
It connects advertisers (Banner Users) who want high-visibility outdoor advertising with Billboard Owners (Hoarding Owners) who own and operate physical and digital hoarding assets.
The platform features automated booking workflows, real-time availability checks, a FIFO queuing system for booked hoardings, field worker assignment for banner installation, and executive analytics for platform administrators.`
  },
  {
    id: "user_roles",
    category: "roles",
    title: "User Roles in MyBoard",
    keywords: ["roles", "superadmin", "hoarding owner", "banner user", "worker", "user types", "permissions", "who can use"],
    content: `MyBoard supports 4 distinct user roles:
1. SuperAdmin: Full platform authority. Approves hoarding owners and listings, manages master data (countries, states, cities, areas), oversees all bookings and revenue analytics, resolves disputes, and assigns field tasks.
2. HoardingOwner: Media asset owners and outdoor advertising agencies. They register with business documents (GST, PAN, Aadhar, Hoarding License), list billboard spaces with pricing and dimensions, manage booking approvals/rejections, and view earnings.
3. BannerUser: Advertisers, brands, and agencies looking to book hoarding spaces. They search available hoardings by city/area/budget, submit booking requests, enter waitlist queues, track approval status, make payments, and view proof of installation.
4. Worker: Field operations personnel responsible for physically installing, maintaining, or taking down banners. They receive work orders and submit photo proof upon completion.`
  },
  {
    id: "hoarding_types_dimensions",
    category: "hoardings",
    title: "Hoarding Types, Dimensions, and Pricing",
    keywords: ["types", "billboard", "pole", "digital", "wall", "transit", "dimensions", "pricing", "cost", "rates", "size"],
    content: `Hoarding Specifications:
- Supported Types: Billboard (standard highway/city hoardings), Pole Kiosks, Digital Billboards (DOOH with dynamic playback), Wall Paintings/Wraps, and Transit Media.
- Dimensions: Width and Height are recorded with designated units (Feet, Meters, Inches), and the surface area is automatically computed.
- Pricing: Hoarding rates are configured as 'Price Per Day'. Total booking price = (Price Per Day * Total Number of Days) - Discounts + Taxes (GST).
- Location: Every hoarding is tagged with Address, Area, City, State, Country, Pincode, and GPS Coordinates (Latitude/Longitude) for map display and nearby points of interest (POI) discovery.`
  },
  {
    id: "booking_workflow",
    category: "bookings",
    title: "Booking Process & Step-by-Step Guide",
    keywords: ["how to book", "booking process", "reserve", "campaign", "booking steps", "rent hoarding", "book now"],
    content: `How to Book a Hoarding on MyBoard:
1. Search & Discover: Browse active, approved hoardings filtered by City, Area, Type, and Budget.
2. Select Dates & Campaign: Specify your campaign title, desired Start Date, and End Date.
3. Immediate Booking vs Queue:
   - If the hoarding is active and free for those dates, a Booking Request is immediately submitted to the Hoarding Owner.
   - If the hoarding is currently booked or has conflicting dates, you will be placed into the Hoarding's Queue with a defined Queue Position and estimated availability dates.
4. Owner Review: The Hoarding Owner reviews the request and can either 'Approve' or 'Reject' it with remarks.
5. Payment & Work Request: Once approved, the Banner User pays the invoice. A Work Request is automatically initiated for workers to carry out installation.`
  },
  {
    id: "queue_system",
    category: "queue",
    title: "How the Booking Queue System Works",
    keywords: ["queue", "waitlist", "waiting list", "position", "already booked", "conflict", "queue status", "next in line"],
    content: `The MyBoard Queue System:
When a desired hoarding is already booked by another advertiser for overlapping dates, you don't lose the opportunity:
- Your booking request is automatically added to a FIFO (First-In, First-Out) waitlist queue for that specific hoarding.
- You are assigned a Queue Position (e.g., Position 1, Position 2).
- The system computes an 'Estimated Start Date' based on the duration of active bookings ahead of you.
- When an earlier booking finishes or is cancelled, the queue advances automatically.
- Both the advertiser and owner receive notifications whenever queue positions update.`
  },
  {
    id: "payment_policies",
    category: "payment",
    title: "Payment Methods and Billing Policies",
    keywords: ["payment", "pay", "billing", "invoice", "gst", "pricing policy", "methods", "tax", "partial payment"],
    content: `Payment & Billing Policies:
- Payment is requested after the Hoarding Owner approves your booking request.
- Supported methods include UPI, Net Banking, Credit/Debit Cards, and Bank Transfer.
- Payment Statuses: 'Pending' (awaiting payment), 'PartiallyPaid' (advance deposit paid), 'Paid' (fully cleared), and 'Refunded' (if cancelled under eligible terms).
- Invoices detail Base Price, applicable Discounts, Tax/GST amounts, and the Final Total Amount with Request Reference Number.`
  },
  {
    id: "cancellation_refund",
    category: "policies",
    title: "Cancellation and Refund Policies",
    keywords: ["cancel", "cancellation", "refund", "return", "money back", "reject booking", "policy"],
    content: `Cancellation & Refund Terms:
- Pre-Approval Cancellation: Advertisers can withdraw booking requests at any time before owner approval with 0% penalty and full release of pre-authorization.
- Owner Rejection: If a hoarding owner rejects a booking request, no fee is charged, and any temporary hold is immediately cancelled.
- Post-Approval Cancellation: Cancellations made after approval but before printing/mounting work commences are eligible for refunds as per vendor terms (typically subject to a nominal administrative handling fee).
- Force Majeure / Weather Delays: In case of severe weather or structural maintenance delays, dates are rescheduled or prorated credits are issued.`
  },
  {
    id: "subscription_plans",
    category: "plans",
    title: "Subscription Plans for Hoarding Owners & Advertisers",
    keywords: ["plans", "subscription", "plan a", "plan b", "plan c", "pricing plan", "membership"],
    content: `MyBoard Membership Plans:
- Plan A (Starter): Free 1-month duration plan with up to 5 user allocations. Great for trying out the platform.
- Plan B (Standard): ₹99 for 3 months (90 days). Includes 10 user accounts, 10% booking discount benefits, and standard GST invoicing.
- Plan C (Enterprise/Premium): Annual premium plan with maximum user limits, priority hoarding placement, dedicated support, and fee discounts.`
  },
  {
    id: "worker_tasks",
    category: "operations",
    title: "Field Operations & Work Requests",
    keywords: ["worker", "installation", "mounting", "maintenance", "removal", "work request", "proof of work"],
    content: `Field Operations (Worker Role):
- Once a booking is confirmed and paid, a Work Request is created.
- Types of Work: Installation (putting up fresh flex/vinyl banner), Maintenance (lighting checks, structural repairs), and Removal (takedown after campaign expiry).
- Workers update the live status (Pending -> In Progress -> Completed) and upload geo-tagged completion photos as proof of performance for the advertiser.`
  },
  {
    id: "admin_analytics",
    category: "analytics",
    title: "Admin Analytics & Reporting",
    keywords: ["analytics", "insights", "metrics", "reports", "dashboard", "revenue", "occupancy", "admin"],
    content: `Admin Analytics & Insights:
SuperAdmins and Hoarding Owners can query the AI chatbot for instant business metrics:
- SuperAdmin insights include: Total system bookings, breakdown of bookings by status (Approved, Pending, Rejected), total revenue collected, active hoardings, and top performing locations.
- HoardingOwner insights include: Total booking requests received, revenue earned on their hoardings, and occupancy/queue metrics for their billboards.`
  }
];

/**
 * Perform semantic/keyword RAG retrieval on knowledge base
 * Returns top matching knowledge snippets relevant to user query.
 */
function retrieveRelevantKnowledge(query, topK = 3) {
  if (!query || typeof query !== "string") return [];

  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const queryTokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);

  if (queryTokens.length === 0) return [];

  const scoredArticles = KNOWLEDGE_ARTICLES.map((article) => {
    let score = 0;

    // Check title match
    const titleLower = article.title.toLowerCase();
    queryTokens.forEach((token) => {
      if (titleLower.includes(token)) score += 3;
    });

    // Check keywords match
    article.keywords.forEach((kw) => {
      if (cleanQuery.includes(kw)) score += 5;
      queryTokens.forEach((token) => {
        if (kw.includes(token)) score += 2;
      });
    });

    // Check content match
    const contentLower = article.content.toLowerCase();
    queryTokens.forEach((token) => {
      const occurrences = (contentLower.match(new RegExp(token, "g")) || []).length;
      score += Math.min(occurrences, 4);
    });

    return { article, score };
  });

  scoredArticles.sort((a, b) => b.score - a.score);

  return scoredArticles
    .filter((item) => item.score > 2)
    .slice(0, topK)
    .map((item) => item.article);
}

module.exports = {
  KNOWLEDGE_ARTICLES,
  retrieveRelevantKnowledge,
};

