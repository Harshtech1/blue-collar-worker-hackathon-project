import { getDb } from "../config/db.js";
import {
  buildFallbackPrediction,
  buildSyntheticHistory,
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

    const analyticsUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";

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
      return res.json({
        area: areaId,
        current_orders: currentOrders,
        current_workers: currentWorkers,
        emergency_orders: emergencyOrders,
        history_points: history.length,
        source: "random_forest_service",
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
