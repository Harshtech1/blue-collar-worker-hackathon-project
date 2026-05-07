export const SIMULATION_HISTORY_COLLECTION = "simulation_history";

export const buildSimulationHistoryDocument = ({
  zoneId,
  zoneLabel,
  city,
  deepDive = false,
  requestPayload,
  llmResponse,
  provider,
  model,
  createdBy,
}) => ({
  auditLog: llmResponse?.auditLog || null,
  competitorPressure: Boolean(requestPayload?.competitorPressure),
  competitorSignals: Array.isArray(requestPayload?.competitorSignals)
    ? requestPayload.competitorSignals.slice(0, 3)
    : [],
  counterPositioningMove: llmResponse?.counterPositioningMove || null,
  logicSignals: Array.isArray(requestPayload?.logicSignals)
    ? requestPayload.logicSignals.slice(0, 3)
    : [],
  scenario: requestPayload?.scenarioType || requestPayload?.scenario || "baseline",
  analysisMode: requestPayload?.analysisMode || "strategy_brief",
  zoneId: zoneId || "unknown-zone",
  zoneLabel: zoneLabel || zoneId || "Unknown Zone",
  city: city || "Unknown City",
  deepDive: Boolean(deepDive),
  provider: provider || "rule_engine",
  model: model || "density-rule-fallback",
  requestPayload,
  llmResponse,
  createdBy: createdBy || null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
