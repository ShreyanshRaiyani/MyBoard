/**
 * MyBoard AI Chatbot Service
 * Orchestrates LangChain.js, Google Gemini API / OpenAI API, RAG Knowledge Retrieval,
 * and Secure MongoDB Tool Execution with Strict RBAC.
 */

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

const {
  searchHoardings,
  getUserBookings,
  getBookingAnalytics,
  checkHoardingAvailability
} = require("./chatbotTools");

const { retrieveRelevantKnowledge } = require("../knowledge/myboardKnowledge");
const ChatMessage = require("../models/ChatMessage");

/**
 * Determine active AI provider and initialize LangChain model
 */
function getLanguageModel() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      return {
        provider: "gemini",
        model: new ChatGoogleGenerativeAI({
          apiKey: geminiKey,
          model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
          temperature: 0.3,
          maxRetries: 2
        })
      };
    } catch (err) {
      console.warn("Failed to initialize ChatGoogleGenerativeAI:", err.message);
    }
  }

  if (openaiKey) {
    try {
      return {
        provider: "openai",
        model: new ChatOpenAI({
          openAIApiKey: openaiKey,
          modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.3,
          maxRetries: 2
        })
      };
    } catch (err) {
      console.warn("Failed to initialize ChatOpenAI:", err.message);
    }
  }

  return { provider: "none", model: null };
}

/**
 * Generate role-appropriate suggested follow-up questions
 */
function generateSuggestedQuestions(userType, lastIntent = null) {
  const normalizedType = userType || "Guest";

  if (lastIntent === "search_hoardings") {
    return [
      "Show hoardings in Ahmedabad",
      "Find digital billboards",
      "Hoardings under ₹5,000/day",
      "How do I submit a booking request?"
    ];
  }

  if (lastIntent === "bookings") {
    return [
      "Check my booking status",
      "How does the waiting list queue work?",
      "What are the payment options?",
      "Can I cancel a pending booking?"
    ];
  }

  if (lastIntent === "analytics") {
    return [
      "Show platform revenue summary",
      "Total active vs booked hoardings",
      "Pending hoarding approvals",
      "Top booking locations"
    ];
  }

  // Default suggestions per role
  switch (normalizedType) {
    case "SuperAdmin":
      return [
        "Show platform booking analytics",
        "Total revenue & active billboards",
        "List pending hoarding approvals",
        "How do worker assignments work?"
      ];
    case "HoardingOwner":
      return [
        "Show my hoardings performance",
        "How do I approve or reject bookings?",
        "What are the subscription plans?",
        "How does the queue notify me?"
      ];
    case "BannerUser":
      return [
        "Find available hoardings in Ahmedabad",
        "Check my booking status",
        "Hoardings under ₹10,000/day",
        "How does the queue system work?"
      ];
    default:
      return [
        "How do I book a hoarding on MyBoard?",
        "Find available billboards in Ahmedabad",
        "What are the pricing & payment policies?",
        "What are the different user roles?"
      ];
  }
}

/**
 * Fallback intent classifier & handler when API key is missing or external call fails
 */
async function processFallbackResponse({ message, userContext, history = [] }) {
  const clean = message.toLowerCase().trim();
  const metadata = {
    toolCalled: null,
    hoardings: [],
    bookings: [],
    analytics: null,
    suggestedQuestions: []
  };

  // 1. Check for Hoarding Search intent
  const isSearch =
    clean.includes("find") ||
    clean.includes("search") ||
    clean.includes("hoarding") ||
    clean.includes("billboard") ||
    clean.includes("available") ||
    clean.includes("show me") ||
    clean.includes("under") ||
    clean.includes("price") ||
    clean.includes("cost") ||
    clean.includes("ahmedabad") ||
    clean.includes("digital");

  if (isSearch && !clean.includes("booking") && !clean.includes("analytics")) {
    // Extract potential city
    let city = null;
    if (clean.includes("ahmedabad")) city = "Ahmedabad";
    else if (clean.includes("surat")) city = "Surat";
    else if (clean.includes("vadodara")) city = "Vadodara";
    else if (clean.includes("rajkot")) city = "Rajkot";

    // Extract potential max price
    let maxPrice = undefined;
    const priceMatch = clean.match(/(?:under|below|less than|max)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = Number(priceMatch[1]);
    }

    // Extract type
    let type = undefined;
    if (clean.includes("digital")) type = "Digital";
    else if (clean.includes("pole")) type = "Pole";
    else if (clean.includes("wall")) type = "Wall";
    else if (clean.includes("transit")) type = "Transit";
    else if (clean.includes("billboard")) type = "Billboard";

    const results = await searchHoardings({
      city,
      type,
      maxPrice,
      limit: 5
    });

    metadata.toolCalled = "searchHoardings";
    metadata.hoardings = results;
    metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType, "search_hoardings");

    if (results.length > 0) {
      let reply = `Here are **${results.length} available hoardings** matching your inquiry:\n\n`;
      results.forEach((h, idx) => {
        const cityStr = h.location?.city ? ` in ${h.location.city}` : "";
        reply += `${idx + 1}. **${h.hoardingName}** (${h.hoardingCode})\n`;
        reply += `   - **Type:** ${h.type} | **Rate:** ₹${h.pricePerDay?.toLocaleString() || "N/A"}/day\n`;
        reply += `   - **Location:** ${h.location?.address || "Prime Location"}${cityStr}\n`;
        reply += `   - **Status:** ${h.status}\n\n`;
      });
      reply += `You can book any of these hoardings by navigating to the Hoardings catalog or clicking on a card below.`;
      return { reply, metadata };
    } else {
      return {
        reply: `I searched the database for active hoardings${city ? ` in ${city}` : ""}, but couldn't find an exact match for those specific filters. Try searching for **"Ahmedabad"** or browse all hoardings in the catalog.`,
        metadata
      };
    }
  }

  // 2. Check for Bookings intent
  const isBookingQuery =
    clean.includes("my booking") ||
    clean.includes("booking status") ||
    clean.includes("check booking") ||
    clean.includes("my orders") ||
    clean.includes("my reservations");

  if (isBookingQuery) {
    if (!userContext.userId) {
      metadata.suggestedQuestions = ["How do I book a hoarding?", "Login to MyBoard"];
      return {
        reply: `To check your active bookings and queue status, please **log in** to your MyBoard account. Once logged in, I will retrieve your real-time booking history directly from the database!`,
        metadata
      };
    }

    const bookings = await getUserBookings(userContext, { limit: 5 });
    metadata.toolCalled = "getUserBookings";

    if (Array.isArray(bookings) && bookings.length > 0) {
      metadata.bookings = bookings;
      metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType, "bookings");
      let reply = `Here are your recent booking details:\n\n`;
      bookings.forEach((b, idx) => {
        reply += `${idx + 1}. **Request #${b.requestNumber}** — *${b.campaignName}*\n`;
        reply += `   - **Hoarding:** ${b.hoarding?.hoardingName} (${b.hoarding?.hoardingCode})\n`;
        reply += `   - **Status:** **${b.status}** | **Payment:** ${b.paymentStatus}\n`;
        reply += `   - **Total:** ₹${b.pricing?.totalAmount?.toLocaleString() || 0}\n`;
        if (b.inQueue) {
          reply += `   - ⏳ **Queue Position:** Position #${b.queuePosition} in waitlist\n`;
        }
        reply += `\n`;
      });
      return { reply, metadata };
    } else {
      metadata.suggestedQuestions = ["Find hoardings in Ahmedabad", "How does booking work?"];
      return {
        reply: `You currently do not have any active booking requests. You can browse available hoardings and submit a new booking request anytime!`,
        metadata
      };
    }
  }

  // 3. Check for Analytics intent (SuperAdmin & HoardingOwner)
  const isAnalyticsQuery =
    clean.includes("analytic") ||
    clean.includes("revenue") ||
    clean.includes("occupancy") ||
    clean.includes("statistics") ||
    clean.includes("metric") ||
    clean.includes("performance") ||
    clean.includes("dashboard stats");

  if (isAnalyticsQuery) {
    if (userContext.userType !== "SuperAdmin" && userContext.userType !== "HoardingOwner") {
      metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType);
      return {
        reply: `Booking analytics and business metrics are only accessible to authorized **SuperAdmins** and **Hoarding Owners**. If you have an admin account, please sign in to view analytics.`,
        metadata
      };
    }

    const analytics = await getBookingAnalytics(userContext);
    metadata.toolCalled = "getBookingAnalytics";
    metadata.analytics = analytics;
    metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType, "analytics");

    let reply = `### 📊 ${analytics.scope} Overview\n\n`;
    reply += `- **Total Bookings:** ${analytics.totalBookings}\n`;
    reply += `- **Approved Bookings:** ${analytics.approvedBookings}\n`;
    reply += `- **Pending Approvals:** ${analytics.pendingBookings}\n`;
    reply += `- **Confirmed Paid Revenue:** ₹${analytics.totalRevenue?.toLocaleString() || 0}\n`;
    reply += `- **Total Hoardings:** ${analytics.totalHoardings} (Active: ${analytics.activeHoardings}, Booked: ${analytics.bookedHoardings})\n`;
    reply += `- **Occupancy Rate:** ${analytics.occupancyRate}\n`;
    if (analytics.pendingApprovalHoardings !== undefined) {
      reply += `- **Pending Hoarding Submissions for Admin Review:** ${analytics.pendingApprovalHoardings}\n`;
    }

    return { reply, metadata };
  }

  // 4. RAG Knowledge Base Retrieval for FAQs, Policies, and General Questions
  const relevantArticles = retrieveRelevantKnowledge(message, 2);
  if (relevantArticles.length > 0) {
    metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType);
    let reply = "";
    relevantArticles.forEach((art, idx) => {
      reply += `### ${art.title}\n${art.content}\n\n`;
    });
    return { reply: reply.trim(), metadata };
  }

  // 5. Default Friendly Welcome / Help
  metadata.suggestedQuestions = generateSuggestedQuestions(userContext.userType);
  const userName = userContext.firstName ? ` ${userContext.firstName}` : "";
  const reply = `Hello${userName}! I am **MyBoard Assistant**, your outdoor media and hoarding management companion.\n\nI can assist you with:
- 🔍 **Searching Available Hoardings:** Filter by city, type, and budget.
- 📋 **Booking & Queue Tracking:** Check your reservations and queue status.
- 📜 **Platform Policies:** Learn about booking, payment, and cancellation rules.
- 📊 **Business Analytics:** Provide revenue, occupancy, and booking insights for Admins and Owners.

How can I help you today?`;

  return { reply, metadata };
}

/**
 * Main Chat Processing Function with LangChain.js & LLM Tool Calling
 */
async function processChatMessage({ message, sessionId, userContext = {} }) {
  if (!message || typeof message !== "string") {
    throw new Error("Message text is required");
  }

  const { provider, model } = getLanguageModel();

  // If no AI key configured or provider is 'none', use robust RAG & intent fallback
  if (provider === "none" || !model) {
    return processFallbackResponse({ message, userContext });
  }

  try {
    // 1. Retrieve RAG Knowledge context
    const knowledgeArticles = retrieveRelevantKnowledge(message, 3);
    const knowledgeContext = knowledgeArticles
      .map((a) => `[DOCUMENT: ${a.title}]\n${a.content}`)
      .join("\n\n");

    // 2. Build system instructions
    const userRole = userContext.userType || "Guest";
    const userName = userContext.firstName ? `${userContext.firstName} ${userContext.lastName || ""}`.trim() : "Guest User";
    const userId = userContext.userId || null;

    const systemPrompt = `You are the intelligent AI Assistant for "MyBoard – Hoarding Management System".
Your mission is to assist users in discovering hoardings, checking bookings, explaining policies, and providing authorized analytics.

CURRENT USER CONTEXT:
- Name: ${userName}
- User Type / Role: ${userRole}
- User ID: ${userId || "Unauthenticated Guest"}

RELEVANT KNOWLEDGE BASE CONTEXT (RAG):
${knowledgeContext || "No specific document matched. Use general platform knowledge."}

SECURITY & ACCESS CONTROL RULES (STRICTLY ENFORCED):
1. 'BannerUser' can only access their own bookings.
2. 'HoardingOwner' can view their own hoardings, requests, and earnings.
3. 'SuperAdmin' has platform-wide access to all hoardings, bookings, and analytics.
4. 'Guest' (not logged in) cannot see private booking details or admin analytics. Direct them to log in when requested.
5. Never invent fake database IDs or false booking numbers. When users ask to search hoardings, check bookings, or get analytics, ALWAYS use the provided tools.

FORMATTING:
- Use clean Markdown with bullet points, bold key phrases, and clear headings.
- Keep responses friendly, professional, concise, and helpful.`;

    // 3. Define LangChain tools bound with current user context
    let capturedToolData = {
      toolCalled: null,
      hoardings: [],
      bookings: [],
      analytics: null
    };

    const searchHoardingsTool = tool(
      async (input) => {
        capturedToolData.toolCalled = "searchHoardings";
        const results = await searchHoardings(input);
        capturedToolData.hoardings = results;
        return JSON.stringify(results.slice(0, 6));
      },
      {
        name: "search_hoardings",
        description: "Search available hoardings from MongoDB by city, area, type (Billboard, Digital, Pole, Wall, Transit), and price range.",
        schema: z.object({
          city: z.string().optional().describe("City name e.g. Ahmedabad, Surat"),
          area: z.string().optional().describe("Area name"),
          type: z.string().optional().describe("Type: Billboard, Pole, Digital, Wall, Transit"),
          minPrice: z.number().optional().describe("Minimum price per day"),
          maxPrice: z.number().optional().describe("Maximum price per day"),
          status: z.string().optional().describe("Active or Booked")
        })
      }
    );

    const getUserBookingsTool = tool(
      async (input) => {
        capturedToolData.toolCalled = "getUserBookings";
        const results = await getUserBookings(userContext, input);
        if (Array.isArray(results)) {
          capturedToolData.bookings = results;
        }
        return JSON.stringify(results);
      },
      {
        name: "get_user_bookings",
        description: "Fetch booking requests and queue status for the currently authenticated user with role-based access control.",
        schema: z.object({
          status: z.string().optional().describe("Optional filter: Pending, Approved, Rejected"),
          limit: z.number().optional().describe("Max bookings to return (default 5)")
        })
      }
    );

    const getBookingAnalyticsTool = tool(
      async () => {
        capturedToolData.toolCalled = "getBookingAnalytics";
        const results = await getBookingAnalytics(userContext);
        if (!results.error) {
          capturedToolData.analytics = results;
        }
        return JSON.stringify(results);
      },
      {
        name: "get_booking_analytics",
        description: "Fetch booking revenue, occupancy, and platform performance analytics. Only accessible to SuperAdmin and HoardingOwner.",
        schema: z.object({})
      }
    );

    const checkAvailabilityTool = tool(
      async (input) => {
        capturedToolData.toolCalled = "checkHoardingAvailability";
        const results = await checkHoardingAvailability(input.hoardingCodeOrId, input.startDate, input.endDate);
        return JSON.stringify(results);
      },
      {
        name: "check_hoarding_availability",
        description: "Check if a specific hoarding code is available for specific dates and retrieve queue details.",
        schema: z.object({
          hoardingCodeOrId: z.string().describe("Hoarding code or MongoDB ID"),
          startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
          endDate: z.string().optional().describe("End date (YYYY-MM-DD)")
        })
      }
    );

    const tools = [
      searchHoardingsTool,
      getUserBookingsTool,
      getBookingAnalyticsTool,
      checkAvailabilityTool
    ];

    // 4. Fetch recent conversation history from MongoDB for multi-turn context
    const recentMessages = await ChatMessage.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const formattedHistory = [];
    recentMessages.reverse().forEach((msg) => {
      if (msg.role === "user") {
        formattedHistory.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        formattedHistory.push(new AIMessage(msg.content));
      }
    });

    // 5. Bind tools to model and invoke
    const modelWithTools = model.bindTools ? model.bindTools(tools) : model;

    const messages = [
      new SystemMessage(systemPrompt),
      ...formattedHistory,
      new HumanMessage(message)
    ];

    const response = await modelWithTools.invoke(messages);

    let finalReply = "";

    // If the model called tools, execute tool calls and generate final synthesis
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolMessages = [...messages, response];

      for (const call of response.tool_calls) {
        const selectedTool = tools.find((t) => t.name === call.name);
        if (selectedTool) {
          const toolResult = await selectedTool.invoke(call.args);
          toolMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: toolResult
          });
        }
      }

      // Final pass to summarize tool results
      const finalSynthesis = await model.invoke(toolMessages);
      finalReply = typeof finalSynthesis.content === "string"
        ? finalSynthesis.content
        : JSON.stringify(finalSynthesis.content);
    } else {
      finalReply = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    }

    const metadata = {
      toolCalled: capturedToolData.toolCalled,
      hoardings: capturedToolData.hoardings,
      bookings: capturedToolData.bookings,
      analytics: capturedToolData.analytics,
      suggestedQuestions: generateSuggestedQuestions(userRole, capturedToolData.toolCalled)
    };

    return {
      reply: finalReply,
      metadata
    };
  } catch (err) {
    console.error("LangChain execution error, falling back to local engine:", err);
    // Graceful fallback to local RAG and DB engine so user is never stranded
    return processFallbackResponse({ message, userContext });
  }
}

module.exports = {
  processChatMessage,
  generateSuggestedQuestions,
  getLanguageModel
};

