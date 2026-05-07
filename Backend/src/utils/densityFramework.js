const DEFAULT_HISTORY_POINTS = 14;

export const getDensityStrategy = (densityScore) => {
  if (densityScore >= 1.8) {
    return {
      allocation_strategy: "salaried_core",
      salaried_ratio: 0.8,
      freelancer_ratio: 0.2,
      reasoning: "High demand per active worker. Keep salaried core staff ready to protect fulfillment quality.",
    };
  }

  if (densityScore >= 1.2) {
    return {
      allocation_strategy: "hybrid",
      salaried_ratio: 0.45,
      freelancer_ratio: 0.55,
      reasoning: "Moderate density. Use a salaried base for reliability and freelancers for demand spikes.",
    };
  }

  return {
    allocation_strategy: "freelancer_pool",
    salaried_ratio: 0.15,
    freelancer_ratio: 0.85,
    reasoning: "Low density. Keep fixed salary burn low and rely mostly on verified freelancers.",
  };
};

export const buildSyntheticHistory = ({ currentOrders, currentWorkers, emergencyOrders, currentSpend }) => {
  const baseOrders = Math.max(4, currentOrders || 8);
  const baseWorkers = Math.max(2, currentWorkers || 4);

  return Array.from({ length: DEFAULT_HISTORY_POINTS }).map((_, index) => {
    const dayOfWeek = index % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
    const weekendBoost = isWeekend ? 1.25 : 1;
    const marketingBoost = 1 + ((index % 5) * 0.04);
    const orders = Math.round(baseOrders * weekendBoost * (0.75 + (index % 6) * 0.08));
    const activeWorkers = Math.max(1, Math.round(baseWorkers * (0.85 + (index % 4) * 0.08)));
    const syntheticEmergencyOrders = Math.max(0, Math.round((emergencyOrders || 1) * (isWeekend ? 1.2 : 0.8)));
    const marketingSpend = Math.round((currentSpend || 750) * marketingBoost);
    const actualDemand = Math.round(orders + syntheticEmergencyOrders + marketingSpend / 500);

    return {
      orders,
      marketing_spend: marketingSpend,
      active_workers: activeWorkers,
      day_of_week: dayOfWeek,
      is_weekend: isWeekend,
      emergency_orders: syntheticEmergencyOrders,
      actual_demand: actualDemand,
    };
  });
};

export const getSurgeMultiplier = (densityScore) => {
  const rawMultiplier = 1 + (0.25 * (Number(densityScore || 0) - 1.2));
  return Number(Math.min(1.5, Math.max(0.85, rawMultiplier)).toFixed(2));
};

export const buildFallbackPrediction = ({ areaId, currentOrders, currentWorkers }) => {
  const predictedDemand = Math.max(0, currentOrders);
  const densityScore = currentWorkers > 0 ? predictedDemand / currentWorkers : predictedDemand;
  const strategy = getDensityStrategy(densityScore);

  return {
    area_id: areaId,
    predicted_demand: Number(predictedDemand.toFixed(2)),
    density_score: Number(densityScore.toFixed(2)),
    price_multiplier: getSurgeMultiplier(densityScore),
    confidence_score: 0.6,
    generated_at: new Date().toISOString(),
    source: "node_fallback",
    ...strategy,
  };
};
