import { getDb } from "../config/db.js";
import {
  SIMULATION_HISTORY_COLLECTION,
  buildSimulationHistoryDocument,
} from "../models/SimulationHistory.js";
import {
  analyzeAdminCopilotWithLLM,
  analyzeSystemInsightsWithLLM,
  analyzeStrategyWithLLM,
  hasStrategyProviderConfigured,
} from "../services/llmService.js";
import {
  buildFallbackPrediction,
  buildSyntheticHistory,
  getSurgeMultiplier,
} from "../utils/densityFramework.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const getAreaQuery = (areaId) => {
  const normalized = String(areaId || "").trim();
  if (!normalized || normalized === "all") return {};

  return {
    $or: [
      { city: { $regex: new RegExp(normalized, "i") } },
      { address: { $regex: new RegExp(normalized, "i") } },
      { serviceName: { $regex: new RegExp(normalized, "i") } },
    ],
  };
};

const getHistoricalSignals = async (db, areaQuery, days = 14) => {
  const start = new Date(Date.now() - days * DAY_MS);
  const pipeline = [
    {
      $match: {
        ...areaQuery,
        createdAt: { $gte: start },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          dayOfWeek: { $dayOfWeek: "$createdAt" },
        },
        orders: { $sum: 1 },
        emergency_orders: {
          $sum: {
            $cond: [{ $eq: ["$bookingType", "emergency"] }, 1, 0],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ];

  const grouped = await db.collection("bookings").aggregate(pipeline).toArray();

  return grouped.map((row, index) => {
    const dayOfWeek = Math.max(0, (row._id.dayOfWeek || 1) - 1);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
    const marketingSpend = 500 + (index % 5) * 175 + row.orders * 20;

    return {
      orders: row.orders,
      marketing_spend: marketingSpend,
      active_workers: Math.max(1, Math.ceil(row.orders / 2)),
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      emergency_orders: row.emergency_orders || 0,
      actual_demand: row.orders + (row.emergency_orders || 0),
    };
  });
};

const toAuditTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const toAuditMillis = (value) => {
  const millis = new Date(value || 0).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const sortAuditTrailByTime = (entries = []) => (
  [...entries]
    .filter((entry) => entry && entry.message)
    .sort((left, right) => toAuditMillis(right.time) - toAuditMillis(left.time))
);

const buildBookingAuditTrail = async (db) => {
  const bookings = await db.collection("bookings").find(
    {},
    {
      projection: {
        serviceName: 1,
        service: 1,
        status: 1,
        paymentStatus: 1,
        amount: 1,
        total_price: 1,
        city: 1,
        address: 1,
        updatedAt: 1,
        createdAt: 1,
        statusHistory: 1,
      },
    },
  ).sort({ updatedAt: -1, createdAt: -1 }).limit(8).toArray();

  return bookings.flatMap((booking) => {
    const serviceLabel = booking.serviceName || booking.service || "Service";
    const locationLabel = booking.city || booking.address || "Unknown location";
    const latestStatus = Array.isArray(booking.statusHistory) && booking.statusHistory.length > 0
      ? booking.statusHistory[booking.statusHistory.length - 1]
      : null;
    const latestTime = latestStatus?.timestamp || booking.updatedAt || booking.createdAt;
    const entries = [
      {
        source: "booking",
        severity: booking.status === "cancelled" ? "critical" : booking.status === "pending" ? "watch" : "info",
        time: toAuditTimestamp(latestTime),
        message: `${serviceLabel} in ${locationLabel} is currently ${booking.status || "unknown"}${latestStatus?.actor ? ` via ${latestStatus.actor}` : ""}.`,
      },
    ];

    if (booking.paymentStatus !== "paid" && ["matched", "in_progress", "completed"].includes(String(booking.status || ""))) {
      const amount = Math.round(Number(booking.amount ?? booking.total_price ?? 0));
      entries.push({
        source: "payment",
        severity: booking.status === "completed" ? "critical" : "watch",
        time: toAuditTimestamp(booking.updatedAt || booking.createdAt),
        message: `Payment is still pending for ${serviceLabel} in ${locationLabel}${amount > 0 ? ` at INR ${amount.toLocaleString("en-IN")}` : ""}.`,
      });
    }

    return entries;
  });
};

const buildSimulationAuditTrail = async (db) => {
  const history = await db.collection(SIMULATION_HISTORY_COLLECTION).find(
    {},
    {
      projection: {
        zoneLabel: 1,
        city: 1,
        scenario: 1,
        analysisMode: 1,
        auditLog: 1,
        createdAt: 1,
        llmResponse: 1,
      },
    },
  ).sort({ createdAt: -1 }).limit(6).toArray();

  return history.map((entry) => ({
    source: "strategy",
    severity: "info",
    time: toAuditTimestamp(entry.createdAt),
    message: entry.auditLog
      || entry.llmResponse?.signal
      || `${entry.analysisMode || "strategy_brief"} completed for ${entry.zoneLabel || entry.city || "the active zone"} during ${entry.scenario || "baseline"} mode.`,
  }));
};

const buildPersistentAuditTrail = async (db) => {
  const [bookingTrail, simulationTrail] = await Promise.all([
    buildBookingAuditTrail(db).catch((error) => {
      console.warn("[admin-copilot] Booking audit trail unavailable:", error.message);
      return [];
    }),
    buildSimulationAuditTrail(db).catch((error) => {
      console.warn("[admin-copilot] Simulation audit trail unavailable:", error.message);
      return [];
    }),
  ]);

  return sortAuditTrailByTime([...bookingTrail, ...simulationTrail]).slice(0, 16);
};

export const analyzeAreaDensity = async (req, res) => {
  try {
    const { areaId = "all" } = req.params;
    let db;
    try {
      db = getDb();
    } catch (dbError) {
      const currentOrders = Number(req.query.currentOrders || 12);
      const currentWorkers = Math.max(1, Number(req.query.currentWorkers || 6));
      const emergencyOrders = Number(req.query.emergencyOrders || 1);
      const fallback = buildFallbackPrediction({
        areaId,
        currentOrders,
        currentWorkers,
      });

      return res.json({
        area: areaId,
        current_orders: currentOrders,
        current_workers: currentWorkers,
        emergency_orders: emergencyOrders,
        history_points: 0,
        service_warning: `Database offline: ${dbError.message}`,
        ...fallback,
      });
    }

    const areaQuery = getAreaQuery(areaId);
    const since24h = new Date(Date.now() - DAY_MS);

    const [currentOrders, emergencyOrders, activeWorkers, historicalSignals] = await Promise.all([
      db.collection("bookings").countDocuments({
        ...areaQuery,
        createdAt: { $gte: since24h },
      }),
      db.collection("bookings").countDocuments({
        ...areaQuery,
        bookingType: "emergency",
        createdAt: { $gte: since24h },
      }),
      db.collection("worker_profiles").countDocuments({
        $or: [{ status: "online" }, { isAvailable: true }],
      }),
      getHistoricalSignals(db, areaQuery),
    ]);

    const now = new Date();
    const currentWorkers = Math.max(1, activeWorkers);
    const currentSpend = Number(req.query.marketingSpend || 1000);
    const history = historicalSignals.length >= 8
      ? historicalSignals
      : buildSyntheticHistory({
        currentOrders,
        currentWorkers,
        emergencyOrders,
        currentSpend,
      });

    const payload = {
      area_id: areaId,
      current_orders: currentOrders,
      current_spend: currentSpend,
      current_workers: currentWorkers,
      day_of_week: now.getDay(),
      is_weekend: [0, 6].includes(now.getDay()) ? 1 : 0,
      emergency_orders: emergencyOrders,
      history,
    };

    const configuredAnalyticsUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";
    const analyticsUrl = /^https?:\/\//i.test(configuredAnalyticsUrl)
      ? configuredAnalyticsUrl
      : `http://${configuredAnalyticsUrl}`;

    try {
      const response = await fetch(`${analyticsUrl}/predict-density`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Analytics service returned ${response.status}`);
      }

      const prediction = await response.json();
      const densityScore = Number(prediction.density_score || 0);
      return res.json({
        area: areaId,
        current_orders: currentOrders,
        current_workers: currentWorkers,
        emergency_orders: emergencyOrders,
        history_points: history.length,
        source: "random_forest_service",
        price_multiplier: getSurgeMultiplier(densityScore),
        ...prediction,
      });
    } catch (serviceError) {
      const fallback = buildFallbackPrediction({
        areaId,
        currentOrders,
        currentWorkers,
      });

      return res.json({
        area: areaId,
        current_orders: currentOrders,
        current_workers: currentWorkers,
        emergency_orders: emergencyOrders,
        history_points: history.length,
        service_warning: serviceError.message,
        ...fallback,
      });
    }
  } catch (error) {
    console.error("analyzeAreaDensity Error:", error);
    res.status(500).json({ message: "Density analysis failed" });
  }
};

export const runSimulationBatch = async (req, res) => {
  try {
    const configuredAnalyticsUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";
    const analyticsUrl = /^https?:\/\//i.test(configuredAnalyticsUrl)
      ? configuredAnalyticsUrl
      : `http://${configuredAnalyticsUrl}`;

    const response = await fetch(`${analyticsUrl}/simulate-density-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        message: payload.detail || payload.message || "Simulation batch failed in analytics service",
      });
    }

    return res.json(payload);
  } catch (error) {
    console.error("runSimulationBatch Error:", error);
    return res.status(502).json({
      message: "Simulation analytics service is unavailable",
      detail: error instanceof Error ? error.message : "Unknown analytics error",
    });
  }
};

export const analyzeStrategyBrief = async (req, res) => {
  let db = null;

  try {
    try {
      db = getDb();
    } catch (dbError) {
      console.warn("[analyzeStrategyBrief] Database unavailable, continuing without persistence:", dbError.message);
    }

    const strategyResult = await analyzeStrategyWithLLM(req.body || {});

    let historyId = null;
    if (db) {
      const historyDoc = buildSimulationHistoryDocument({
        zoneId: req.body?.zoneId,
        zoneLabel: req.body?.zoneLabel,
        city: req.body?.city,
        deepDive: req.body?.deepDive,
        requestPayload: req.body || {},
        llmResponse: strategyResult.strategy,
        provider: strategyResult.provider,
        model: strategyResult.model,
        createdBy: req.user?.email || req.user?._id || null,
      });

      const insertResult = await db.collection(SIMULATION_HISTORY_COLLECTION).insertOne(historyDoc);
      historyId = insertResult?.insertedId?.toString?.() || null;
    }

    return res.json({
      ...strategyResult.strategy,
      provider: strategyResult.provider,
      model: strategyResult.model,
      historyId,
      saved: Boolean(historyId),
      fallback: !hasStrategyProviderConfigured() || strategyResult.provider === "rule_engine",
    });
  } catch (error) {
    console.error("analyzeStrategyBrief Error:", error);
    return res.status(500).json({
      message: "Strategy analysis failed",
      detail: error instanceof Error ? error.message : "Unknown strategy error",
    });
  }
};

export const askAdminCopilot = async (req, res) => {
  let db = null;

  try {
    try {
      db = getDb();
    } catch (dbError) {
      console.warn("[askAdminCopilot] Database unavailable, continuing without persistence:", dbError.message);
    }

    const persistentAuditTrail = db
      ? await buildPersistentAuditTrail(db)
      : [];

    const mergedAuditTrail = sortAuditTrailByTime([
      ...(Array.isArray(req.body?.auditTrail) ? req.body.auditTrail : []),
      ...persistentAuditTrail,
    ]).slice(0, 24);

    const copilotResult = await analyzeAdminCopilotWithLLM({
      ...(req.body || {}),
      auditTrail: mergedAuditTrail,
    });

    return res.json({
      ...copilotResult.copilot,
      provider: copilotResult.provider,
      model: copilotResult.model,
      fallback: !hasStrategyProviderConfigured() || copilotResult.provider === "rule_engine",
    });
  } catch (error) {
    console.error("askAdminCopilot Error:", error);
    return res.status(500).json({
      message: "Admin copilot request failed",
      detail: error instanceof Error ? error.message : "Unknown admin copilot error",
    });
  }
};

export const analyzeSystemInsights = async (req, res) => {
  try {
    const insightsResult = await analyzeSystemInsightsWithLLM(req.body || {});

    return res.json({
      ...insightsResult.insights,
      provider: insightsResult.provider,
      model: insightsResult.model,
      fallback: !hasStrategyProviderConfigured() || insightsResult.provider === "rule_engine",
    });
  } catch (error) {
    console.error("analyzeSystemInsights Error:", error);
    return res.status(500).json({
      message: "System insights generation failed",
      detail: error instanceof Error ? error.message : "Unknown system insights error",
    });
  }
};
