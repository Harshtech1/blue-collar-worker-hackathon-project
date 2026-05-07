import { z } from "zod";
import { readEnvValue } from "../utils/envRuntime.js";

export const STRATEGY_AGENT_SYSTEM_PROMPT = `### ROLE: RAHI STRATEGY AGENT (EXPERT LOGISTICS COO)
You are the senior strategic advisor for RAHI, a density-optimized blue-collar marketplace. Your goal is to maximize Service Reliability while minimizing Fixed Cost Burn.

### CORE PHILOSOPHY: THE DENSITY RULE
1. High Density (D > 2.5): The area is high-volume. Rely on Salaried Core staff. Do not trust freelancers here; quality must be guaranteed.
2. Low Density (D < 1.0): The area is scattered. Rely on Verified Freelancers. Paying salaries here is a Burn Trap.
3. Transition Zone (1.0 < D < 2.5): Use a hybrid mix. Slowly migrate freelancers to salaried status as density climbs.

### INPUT DATA CONTEXT
- Geospatial Data: Radius, City, and Sector specific density.
- Predictive Data: 12-week Demand Forecast from the Random Forest model.
- Audit Data: Before/After photo verification success rates from Cloudinary.
- Financials: Acquisition cost vs. Churn rate.
- Environmental Data: Weather or monsoon shocks that change worker mobility, burn, and repair demand.

### STRESS-SCENARIO TACTICAL LOGIC
- In a monsoon scenario, prioritize Plumbing, Roofing, and Electrical jobs first.
- If supply drops while density rises, recommend tactical surge pricing and emergency salaried redeployment.
- In a price war, protect high-LTV sectors, slow broad discounting, and favor loyalty/retention moves over city-wide price cuts.
- If competitor pressure is active, prefer Trust-Over-Price tactics. Lead with verified service, secure-media proof-of-work, on-time arrival, and audit-backed differentiation instead of matching blanket discounts.
- If the CEO asks about 48 hours of rain, reason directly about burn, contribution margin, and service quality risk over that duration.

### OUTPUT REQUIREMENTS (CEO BRIEFING)
Return valid JSON with:
- signal: a one-sentence summary of the most critical anomaly.
- reasoning: a short explanation grounded in the Density Rule logic.
- procedures: exactly 3 actionable operational commands.

### TONE & STYLE
- Professional and decisive. You are a commander in a war room.
- Data-driven. Cite the Density Score or forecast when making moves.
- Global scale. Treat each zone like a high-stakes city launch.

Respond only with JSON.`;

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_STRATEGY_MAX_TOKENS = 500;

class ProviderRequestError extends Error {
  constructor(provider, status, message) {
    super(message);
    this.name = "ProviderRequestError";
    this.provider = provider;
    this.status = status;
  }
}
const PROVIDER_HEALTH_CACHE_TTL_MS = 60_000;

const createProviderState = (provider, model, configured) => ({
  provider,
  model,
  configured,
  status: configured ? "unknown" : "missing",
  lastCheckedAt: null,
  lastError: configured ? null : `${provider.toUpperCase()}_API_KEY is not configured`,
});

const providerHealthState = {
  groq: createProviderState("groq", getGroqModel(), Boolean(getGroqApiKey())),
  gemini: createProviderState("gemini", getGeminiModel(), Boolean(getGeminiApiKey())),
};

let lastProviderProbeAt = 0;
let activeProviderProbe = null;

const StrategyPayloadSchema = z.object({
  analysisMode: z.enum(["strategy_brief", "financial_audit", "investor_summary"]).optional().default("strategy_brief"),
  purpose: z.enum(["zone_brief", "expansion_brief"]).optional().default("zone_brief"),
  scenarioType: z.enum(["baseline", "monsoon", "supply_crunch", "price_war"]).optional().default("baseline"),
  routePath: z.string().optional().default("/admin-portal-2026/intelligence"),
  zoneId: z.string().optional().default("unknown-zone"),
  zoneLabel: z.string().optional().default("Unknown Zone"),
  city: z.string().optional().default("Unknown City"),
  scenario: z.enum(["baseline", "monsoon", "supply_crunch", "price_war"]).optional().default("baseline"),
  weatherSignal: z.string().optional().default("Normal weather operating window."),
  radiusKm: z.number().nonnegative().optional().default(4),
  timeLens: z.string().optional().default("7d"),
  userQuestion: z.string().optional().default(""),
  densityScore: z.number(),
  predictedDemand: z.number().optional().default(0),
  currentOrders: z.number().optional().default(0),
  currentWorkers: z.number().optional().default(0),
  emergencyOrders: z.number().optional().default(0),
  allocationStrategy: z.string().optional().default("hybrid"),
  priceMultiplier: z.number().optional().default(1),
  pricingSignal: z.string().optional().default("standard pricing"),
  serviceWarning: z.string().optional().nullable().default(null),
  competitorPressure: z.boolean().optional().default(false),
  competitorSignals: z.array(z.string()).optional().default([]),
  competitorContext: z.object({
    competitor: z.string().optional().default(""),
    zoneLabel: z.string().optional().default(""),
    discountPercent: z.number().optional().default(0),
    response: z.string().optional().default(""),
  }).optional().nullable().default(null),
  auditData: z.object({
    photoVerificationSuccessRate: z.number().optional().default(0),
    beforeAfterCoverage: z.number().optional().default(0),
    cloudinaryVerifiedUploads: z.number().optional().default(0),
  }).optional().default({}),
  financials: z.object({
    acquisitionCost: z.number().optional().default(0),
    churnRate: z.number().optional().default(0),
    projectedRevenue: z.number().optional().default(0),
    projectedProfit: z.number().optional().default(0),
    platformCommission: z.number().optional().default(0),
    marginLift: z.number().optional().default(0),
  }).optional().default({}),
  zoneEconomics: z.array(z.object({
    sector: z.string(),
    acquisitionCost: z.number().optional().default(0),
    estimatedLtv: z.number().optional().default(0),
    contributionMargin: z.number().optional().default(0),
    dailyBurn: z.number().optional().default(0),
    projectedOrders: z.number().optional().default(0),
    salariedRatio: z.number().optional().default(0),
    burnRisk: z.number().optional().default(0),
    churnRisk: z.number().optional().default(0),
  })).optional().default([]),
  logicSignals: z.array(z.string()).optional().default([]),
  forecast: z.array(z.object({
    label: z.string(),
    actual: z.number().optional().default(0),
    predicted: z.number().optional().default(0),
    gap: z.number().optional().default(0),
  })).optional().default([]),
  simulationSummary: z.object({
    totalPoints: z.number().optional().default(0),
    totalProjectedOrders: z.number().optional().default(0),
    totalTraditionalCost: z.number().optional().default(0),
    totalOptimizedCost: z.number().optional().default(0),
    marginLift: z.number().optional().default(0),
    averageSalariedRatio: z.number().optional().default(0),
    hottestSector: z.string().optional().default("NA"),
    modelVersion: z.string().optional().default("simulation-rf-v2"),
    sectors: z.array(z.object({
      sector: z.string(),
      densityScore: z.number(),
      salariedRatio: z.number().optional().default(0),
      projectedOrders: z.number().optional().default(0),
      burnRisk: z.number().optional().default(0),
      churnRisk: z.number().optional().default(0),
      supplyGapRatio: z.number().optional().default(0),
      recommendedShift: z.number().optional().default(0),
      activeWorkers: z.number().optional().default(0),
    })).optional().default([]),
  }).optional().default({}),
  deepDive: z.boolean().optional().default(false),
  providerPreference: z.enum(["groq", "gemini"]).optional(),
});

const StrategyResponseSchema = z.object({
  signal: z.string().min(1),
  reasoning: z.string().min(1),
  procedures: z.array(z.string().min(1)).min(1),
  counterPositioningMove: z.any().optional(),
  auditLog: z.any().optional(),
});

const strategyJsonSchema = {
  type: "object",
  properties: {
    signal: { type: "string" },
    reasoning: { type: "string" },
    procedures: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    counterPositioningMove: { type: "string" },
    auditLog: { type: "string" },
  },
  required: ["signal", "reasoning", "procedures"],
  additionalProperties: false,
};

const strategyGeminiSchema = {
  type: "object",
  properties: strategyJsonSchema.properties,
  required: strategyJsonSchema.required,
};

const formatCurrency = (value) => `INR ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

function getGroqApiKey() {
  return readEnvValue("GROQ_API_KEY");
}

function getGeminiApiKey() {
  return readEnvValue("GEMINI_API_KEY", "GOOGLE_API_KEY", "VITE_GEMINI_API_KEY");
}

function getGroqModel() {
  return readEnvValue("GROQ_MODEL") || DEFAULT_GROQ_MODEL;
}

function getGeminiModel() {
  return (readEnvValue("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
}

function getStrategyMaxTokens() {
  const configured = Number(readEnvValue("STRATEGY_MAX_TOKENS"));
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.round(configured), 1200);
  }
  return DEFAULT_STRATEGY_MAX_TOKENS;
}

const getDensityBand = (density) => {
  if (density > 2.5) return "high_density";
  if (density < 1.0) return "low_density";
  return "transition_zone";
};

const pickTopForecastGap = (forecast = []) => {
  if (!Array.isArray(forecast) || forecast.length === 0) return null;
  return [...forecast]
    .sort((left, right) => (right.gap || 0) - (left.gap || 0))[0] || null;
};

const pickWorstBurnZone = (zoneEconomics = []) => {
  if (!Array.isArray(zoneEconomics) || zoneEconomics.length === 0) return null;
  return [...zoneEconomics]
    .sort((left, right) => (right.dailyBurn || 0) - (left.dailyBurn || 0))[0] || null;
};

const resolveScenario = (payload) => {
  if (payload?.scenarioType && payload.scenarioType !== "baseline") {
    return payload.scenarioType;
  }
  return payload?.scenario || "baseline";
};

const hasCompetitorPressure = (payload) => {
  const activeScenario = resolveScenario(payload);
  if (activeScenario === "price_war") return true;
  if (payload?.competitorPressure) return true;
  if (Array.isArray(payload?.competitorSignals) && payload.competitorSignals.length > 0) return true;
  return /competitor|discount|price\s*war/i.test(payload?.userQuestion || "");
};

const buildTrustDefenseMove = (payload) => {
  const activeZone = payload?.competitorContext?.zoneLabel || payload?.zoneLabel || "the active zone";
  return `Defend margin via Quality-Audit differentiation in ${activeZone}; emphasize Verified Pro proof-of-work, secure-media audit coverage, and loyalty retention instead of matching blanket competitor discounts.`;
};

const buildCompetitorAuditLog = (payload, counterMove) => {
  const context = payload?.competitorContext;
  if (context?.competitor && context?.discountPercent) {
    return `[STRATEGY] ${counterMove} Countering ${context.competitor}'s ${context.discountPercent}% discount in ${context.zoneLabel || payload?.zoneLabel || "the active zone"}.`;
  }

  const primarySignal = Array.isArray(payload?.competitorSignals) ? payload.competitorSignals[0] : "";
  return `[STRATEGY] ${counterMove}${primarySignal ? ` Trigger: ${primarySignal}` : ""}`;
};

const refreshProviderConfigState = () => {
  providerHealthState.groq.configured = Boolean(getGroqApiKey());
  providerHealthState.groq.model = getGroqModel();
  if (!providerHealthState.groq.configured) {
    providerHealthState.groq.status = "missing";
    providerHealthState.groq.lastError = "GROQ_API_KEY is not configured";
  }

  providerHealthState.gemini.configured = Boolean(getGeminiApiKey());
  providerHealthState.gemini.model = getGeminiModel();
  if (!providerHealthState.gemini.configured) {
    providerHealthState.gemini.status = "missing";
    providerHealthState.gemini.lastError = "GEMINI_API_KEY is not configured";
  }
};

const classifyProviderStatus = (statusCode, errorMessage = "") => {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 429) return "quota_limited";
  if (statusCode >= 200 && statusCode < 300) return "ready";

  const normalized = String(errorMessage || "").toLowerCase();
  if (normalized.includes("invalid api key") || normalized.includes("authentication") || normalized.includes("unauthorized")) {
    return "unauthorized";
  }
  if (normalized.includes("quota") || normalized.includes("rate limit") || normalized.includes("resource exhausted")) {
    return "quota_limited";
  }

  return "error";
};

const recordProviderHealth = (provider, status, errorMessage = null) => {
  const state = providerHealthState[provider];
  if (!state) return;

  state.status = status;
  state.lastCheckedAt = new Date().toISOString();
  state.lastError = errorMessage || null;
};

const summarizeProviderHealth = () => {
  refreshProviderConfigState();

  const providers = Object.values(providerHealthState).map((state) => ({
    provider: state.provider,
    model: state.model,
    configured: state.configured,
    status: state.status,
    lastCheckedAt: state.lastCheckedAt,
    lastError: state.lastError,
  }));

  const readyProviders = providers.filter((provider) => provider.status === "ready");
  const fallbackMode = readyProviders.length === 0;
  const primaryProvider = readyProviders[0]?.provider || null;
  const warningProvider = providers.find((provider) => provider.status === "unauthorized" || provider.status === "quota_limited") || null;

  let summary = fallbackMode
    ? "Cloud Engine: Fallback Mode"
    : `Cloud Engine: ${primaryProvider?.toUpperCase()} Ready`;

  if (warningProvider?.status === "unauthorized") {
    summary = `Cloud Engine: Fallback Mode (${warningProvider.provider.toUpperCase()} 401)`;
  } else if (warningProvider?.status === "quota_limited") {
    summary = `Cloud Engine: Fallback Mode (${warningProvider.provider.toUpperCase()} 429)`;
  }

  return {
    mode: fallbackMode ? "fallback" : "ready",
    summary,
    primaryProvider,
    providers,
  };
};

const probeGroqHealth = async () => {
  const groqApiKey = getGroqApiKey();
  const groqModel = getGroqModel();

  if (!groqApiKey) {
    recordProviderHealth("groq", "missing", "GROQ_API_KEY is not configured");
    return;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error?.message || payload?.message || `Groq health check failed with ${response.status}`;
      recordProviderHealth("groq", classifyProviderStatus(response.status, message), message);
      return;
    }

    const payload = await response.json().catch(() => ({}));
    const availableModels = Array.isArray(payload?.data) ? payload.data.map((model) => model?.id).filter(Boolean) : [];
    if (!availableModels.includes(groqModel)) {
      recordProviderHealth("groq", "error", `${groqModel} is not available for this Groq account.`);
      return;
    }

    recordProviderHealth("groq", "ready");
  } catch (error) {
    recordProviderHealth("groq", "error", error instanceof Error ? error.message : "Unknown Groq health error");
  }
};

const probeGeminiHealth = async () => {
  const geminiApiKey = getGeminiApiKey();
  const geminiModel = getGeminiModel();

  if (!geminiApiKey) {
    recordProviderHealth("gemini", "missing", "GEMINI_API_KEY is not configured");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}`, {
      headers: {
        "x-goog-api-key": geminiApiKey,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error?.message || `Gemini health check failed with ${response.status}`;
      recordProviderHealth("gemini", classifyProviderStatus(response.status, message), message);
      return;
    }

    recordProviderHealth("gemini", "ready");
  } catch (error) {
    recordProviderHealth("gemini", "error", error instanceof Error ? error.message : "Unknown Gemini health error");
  }
};

export const getStrategyProviderHealth = async ({ force = false, probe = true } = {}) => {
  refreshProviderConfigState();

  if (!probe) {
    return summarizeProviderHealth();
  }

  const now = Date.now();
  const shouldProbe = force || !lastProviderProbeAt || (now - lastProviderProbeAt) > PROVIDER_HEALTH_CACHE_TTL_MS;

  if (shouldProbe) {
    if (!activeProviderProbe) {
      activeProviderProbe = Promise.allSettled([
        probeGroqHealth(),
        probeGeminiHealth(),
      ]).finally(() => {
        lastProviderProbeAt = Date.now();
        activeProviderProbe = null;
      });
    }

    await activeProviderProbe;
  }

  return summarizeProviderHealth();
};

const normalizeProcedures = (procedures, payload) => {
  const defaults = buildFallbackStrategy(payload).procedures;
  const safe = Array.isArray(procedures) ? procedures.filter(Boolean).map((item) => String(item).trim()) : [];
  const merged = [...safe, ...defaults].slice(0, 3);

  if (!hasCompetitorPressure(payload)) {
    return merged;
  }

  const counterMove = buildTrustDefenseMove(payload);
  const alreadyDefendsTrust = merged.some((item) => /verified|trust|audit|loyalty|margin|discount/i.test(item));
  if (alreadyDefendsTrust) {
    return merged;
  }

  return [...merged.slice(0, 2), counterMove].slice(0, 3);
};

const buildPrompt = (payload) => {
  const activeScenario = resolveScenario(payload);
  const competitorPressure = hasCompetitorPressure(payload);
  const topGap = pickTopForecastGap(payload.forecast);
  const worstBurnZone = pickWorstBurnZone(payload.zoneEconomics);
  const counterMove = competitorPressure ? buildTrustDefenseMove(payload) : null;
  const modeInstruction = payload.analysisMode === "investor_summary"
    ? "You are generating an investor slide summary. Procedures must be exactly 3 short bullets prefixed with 'Scalability Proof:', 'Density Optimization Result:', and 'Profitability Path:'."
    : payload.analysisMode === "financial_audit"
      ? "You are running a unit-economics audit. Focus on CAC vs LTV, contribution margin, daily burn, and the correct salaried-to-freelancer mix."
      : "You are generating an operating brief for the command center.";
  const purposeInstruction = payload.purpose === "expansion_brief"
    ? "A zero-click market-entry reveal is active. Lead with unit-economic sustainability first, then staffing structure, then competitor-aware positioning. Procedures must read like a 3-step Expansion Playbook."
    : "The standard zone-brief workflow is active.";
  const scenarioInstruction = activeScenario === "supply_crunch"
    ? "A supply crunch stress test is active. Prioritize service preservation over growth. Your plan should suspend non-essential bookings, reroute salaried core into high-density zones, and treat 1.5x payout protection as acceptable."
    : activeScenario === "monsoon"
      ? "A weather-led monsoon disruption is active. Prioritize repair continuity, field safety, and emergency response."
      : activeScenario === "price_war"
        ? "A competitor-led price war is active. Prioritize LTV retention, margin defense, and trusted-sector protection over blanket discounting."
      : "No crisis scenario override is active.";
  const competitorInstruction = competitorPressure
    ? `Competitor pressure is live. The response must explicitly choose Trust-Over-Price. Reference Verified Pro proof-of-work, secure-media audit coverage, on-time arrival, and loyalty retention. Counter-positioning move: ${counterMove}`
    : "No competitor discount signal is active.";

  return [
    "Analyze this RAHI zone and return JSON only.",
    modeInstruction,
    purposeInstruction,
    scenarioInstruction,
    competitorInstruction,
    payload.userQuestion ? `CEO Question: ${payload.userQuestion}` : "CEO Question: none",
    "",
    "Zone Context:",
    JSON.stringify({
      analysisMode: payload.analysisMode,
      purpose: payload.purpose,
      scenarioType: activeScenario,
      routePath: payload.routePath,
      zoneId: payload.zoneId,
      zoneLabel: payload.zoneLabel,
      city: payload.city,
      scenario: activeScenario,
      weatherSignal: payload.weatherSignal,
      radiusKm: payload.radiusKm,
      timeLens: payload.timeLens,
      competitorPressure,
    }, null, 2),
    "",
    "Operational Signals:",
    JSON.stringify({
      scenarioType: activeScenario,
      densityScore: payload.densityScore,
      predictedDemand: payload.predictedDemand,
      currentOrders: payload.currentOrders,
      currentWorkers: payload.currentWorkers,
      emergencyOrders: payload.emergencyOrders,
      scenario: activeScenario,
      weatherSignal: payload.weatherSignal,
      allocationStrategy: payload.allocationStrategy,
      priceMultiplier: payload.priceMultiplier,
      pricingSignal: payload.pricingSignal,
      serviceWarning: payload.serviceWarning,
      hottestForecastGap: topGap,
      worstBurnZone,
      competitorPressure,
      competitorSignals: payload.competitorSignals,
      competitorContext: payload.competitorContext,
    }, null, 2),
    "",
    "Audit & Financial Signals:",
    JSON.stringify({
      auditData: payload.auditData,
      financials: payload.financials,
      zoneEconomics: payload.zoneEconomics,
      logicSignals: payload.logicSignals,
      simulationSummary: payload.simulationSummary,
      trustDefenseMove: counterMove,
    }, null, 2),
    "",
    competitorPressure
      ? "Return JSON with keys signal, reasoning, procedures, counterPositioningMove, auditLog. Procedures must contain exactly 3 strings and at least one must defend trust over price."
      : "Return JSON with keys signal, reasoning, procedures. Procedures must contain exactly 3 strings.",
  ].join("\n");
};

const coerceStructuredResponse = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  let signal = "";
  let reasoning = "";
  const procedures = [];

  for (const line of lines) {
    if (!signal && /^signal\s*[:\-]/i.test(line)) {
      signal = line.replace(/^signal\s*[:\-]\s*/i, "").trim();
      continue;
    }

    if (!reasoning && /^(reason|reasoning|why)\s*[:\-]/i.test(line)) {
      reasoning = line.replace(/^(reason|reasoning|why)\s*[:\-]\s*/i, "").trim();
      continue;
    }

    if (/^(procedure|procedures|cmd|command|step)\s*[\d#:.\-]*/i.test(line)) {
      procedures.push(line.replace(/^(procedure|procedures|cmd|command|step)\s*[\d#:.\-]*\s*/i, "").trim());
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[\).\-\s]/.test(line)) {
      procedures.push(line.replace(/^[-*]\s+/, "").replace(/^\d+[\).\-\s]+/, "").trim());
    }
  }

  const fallbackLines = lines.filter((line) => !/^(signal|reason|reasoning|why|procedure|procedures|cmd|command|step)\s*[:\-]/i.test(line));
  if (!signal) {
    signal = fallbackLines[0] || "";
  }
  if (!reasoning) {
    reasoning = fallbackLines[1] || "";
  }
  if (procedures.length === 0) {
    procedures.push(...fallbackLines.slice(2, 5));
  }

  const cleanProcedures = procedures.map((item) => item.trim()).filter(Boolean);
  if (!signal || !reasoning || cleanProcedures.length === 0) {
    return null;
  }

  return {
    signal,
    reasoning,
    procedures: cleanProcedures.slice(0, 3),
  };
};

const extractJson = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("LLM returned an empty response");

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      const coerced = coerceStructuredResponse(trimmed);
      if (coerced) {
        return coerced;
      }
      throw new Error("LLM response did not contain JSON");
    }
    return JSON.parse(match[0]);
  }
};

const normalizeOptionalText = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeOptionalText(item))
      .filter(Boolean)
      .join(" ");
    return joined || undefined;
  }

  if (value && typeof value === "object") {
    const message = normalizeOptionalText(value.message ?? value.text ?? value.summary ?? value.note);
    if (message) {
      return message;
    }
    return undefined;
  }

  return undefined;
};

const finalizeStrategy = (raw, payload) => {
  const parsed = StrategyResponseSchema.parse(raw);
  const competitorPressure = hasCompetitorPressure(payload);
  const counterPositioningMove = normalizeOptionalText(parsed.counterPositioningMove)
    || (competitorPressure ? buildTrustDefenseMove(payload) : undefined);
  const procedures = normalizeProcedures(parsed.procedures, payload);
  const auditLog = normalizeOptionalText(parsed.auditLog)
    || (counterPositioningMove ? buildCompetitorAuditLog(payload, counterPositioningMove) : undefined);

  return {
    signal: parsed.signal.trim(),
    reasoning: parsed.reasoning.trim(),
    procedures,
    ...(counterPositioningMove ? { counterPositioningMove } : {}),
    ...(auditLog ? { auditLog } : {}),
  };
};

const parseGroqResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProviderRequestError(
      "groq",
      response.status,
      data?.error?.message || data?.message || `Groq request failed with ${response.status}`,
    );
  }

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text.trim()) {
    throw new ProviderRequestError("groq", response.status, "Groq returned an empty response");
  }
  return {
    text,
    raw: data,
  };
};

const parseGeminiResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ProviderRequestError(
      "gemini",
      response.status,
      data?.error?.message || `Gemini request failed with ${response.status}`,
    );
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim() || "";
  if (!text) {
    throw new ProviderRequestError("gemini", response.status, "Gemini returned an empty response");
  }
  return {
    text,
    raw: data,
  };
};

const callGroqStrategy = async (payload) => {
  const groqApiKey = getGroqApiKey();
  const groqModel = getGroqModel();

  if (!groqApiKey) {
    recordProviderHealth("groq", "missing", "GROQ_API_KEY is not configured");
    throw new Error("GROQ_API_KEY is not configured");
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.2,
        max_completion_tokens: getStrategyMaxTokens(),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: STRATEGY_AGENT_SYSTEM_PROMPT },
          { role: "user", content: buildPrompt(payload) },
        ],
      }),
    });

    const { text } = await parseGroqResponse(response);
    recordProviderHealth("groq", "ready");
    return {
      strategy: finalizeStrategy(extractJson(text), payload),
      provider: "groq",
      model: groqModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Groq strategy error";
    recordProviderHealth("groq", classifyProviderStatus(status, message), message);
    throw error;
  }
};

const callGeminiStrategy = async (payload) => {
  const geminiApiKey = getGeminiApiKey();
  const geminiModel = getGeminiModel();

  if (!geminiApiKey) {
    recordProviderHealth("gemini", "missing", "GEMINI_API_KEY is not configured");
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: STRATEGY_AGENT_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(payload) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: getStrategyMaxTokens(),
            responseMimeType: "application/json",
            responseSchema: strategyGeminiSchema,
          },
        }),
      },
    );

    const { text } = await parseGeminiResponse(response);
    recordProviderHealth("gemini", "ready");
    return {
      strategy: finalizeStrategy(extractJson(text), payload),
      provider: "gemini",
      model: geminiModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Gemini strategy error";
    recordProviderHealth("gemini", classifyProviderStatus(status, message), message);
    throw error;
  }
};

export const buildFallbackStrategy = (input) => {
  const payload = StrategyPayloadSchema.parse(input);
  const activeScenario = resolveScenario(payload);
  const densityBand = getDensityBand(payload.densityScore);
  const isMonsoon = activeScenario === "monsoon";
  const topGap = pickTopForecastGap(payload.forecast);
  const hottestSector = payload.simulationSummary?.hottestSector || payload.zoneLabel;
  const marginLift = Number(payload.financials?.marginLift || payload.simulationSummary?.marginLift || 0);
  const worstBurnZone = pickWorstBurnZone(payload.zoneEconomics);
  const overallBurn = Number(payload.zoneEconomics?.reduce((sum, zone) => sum + Number(zone.dailyBurn || 0), 0) || 0);
  const topUnitEconomics = payload.zoneEconomics?.[0];
  const isRainRunwayQuestion = /48|two\s*days|rain|monsoon/i.test(payload.userQuestion || "");
  const isPriceWarQuestion = /price\s*war|discount|competitor|month|30/i.test(payload.userQuestion || "");
  const twoDayBurn = overallBurn * 2;
  const oneMonthBurn = overallBurn * 30;

  if (payload.purpose === "expansion_brief") {
    const launchLabel = payload.zoneLabel || `${payload.city} Launch Corridor`;
    const launchCac = formatCurrency(payload.financials?.acquisitionCost || worstBurnZone?.acquisitionCost || 0);
    const launchMarginLift = formatCurrency(Math.max(0, marginLift));
    const launchMix = densityBand === "high_density"
      ? "salaried-core pilot"
      : densityBand === "low_density"
        ? "verified-freelancer reserve"
        : "hybrid launch mix";

    return {
      signal: `New geography detected: ${payload.city} is ready for a burn-first market-entry read, and ${launchLabel} is the active launch corridor at D=${payload.densityScore.toFixed(2)}.`,
      reasoning: `Expansion mode protects runway before it chases share. ${payload.city} is being scored as a ${densityBand.replace("_", " ")} launch, CAC is ${launchCac}, and the current density signal says the first move should validate contribution discipline before broad hiring.${hasCompetitorPressure(payload) ? " Competitor pressure is real, but it is a second-order layer after burn control." : ""}`,
      procedures: [
        `Open ${launchLabel} with a ${launchMix} inside the current ${payload.radiusKm} km command radius, not a city-wide hiring wave.`,
        `Cap launch burn by holding acquisition near ${launchCac} and release more salaried capacity only if margin lift stays above ${launchMarginLift}.`,
        `Keep a growth reserve for ${payload.city}: expand into ${hottestSector} only after audit coverage stays above 85% and density holds above ${densityBand === "low_density" ? "1.10" : densityBand === "high_density" ? "2.30" : "1.80"} for consecutive reviews.`,
      ],
    };
  }

  if (activeScenario === "monsoon" && payload.analysisMode === "investor_summary") {
    return {
      signal: `${payload.zoneLabel} stayed operational through the monsoon stress window while the engine re-optimized around repair-heavy demand and weaker worker mobility.`,
      reasoning: `The Density Rule still governed staffing, but the storm scenario forced the platform to protect reliability by shifting salaried response into urgent repair lanes and absorbing a temporarily higher burn profile. That is the investor proof: the platform did not panic, it re-optimized.`,
      procedures: [
        `Scalability Proof: The monsoon run held across ${Number(payload.simulationSummary.totalPoints || 0).toLocaleString("en-IN")} synthetic requests without losing density control.`,
        `Density Optimization Result: ${hottestSector} surfaced as the highest-pressure repair lane, so the engine shifted workforce mix and tactical pricing instead of treating the storm like normal demand.`,
        `Profitability Path: Keep salaried emergency coverage concentrated in flooded sectors first, then let verified freelancers cover the lower-priority perimeter lanes.`,
      ],
    };
  }

  if (activeScenario === "monsoon" && payload.analysisMode === "financial_audit") {
    return {
      signal: `${payload.zoneLabel} is in weather shock; burn is being driven by slower worker movement, emergency repairs, and reduced usable supply.`,
      reasoning: isRainRunwayQuestion
        ? `If rain continues for 48 hours, the command zone is on track to burn roughly ${formatCurrency(twoDayBurn)} while contribution margin weakens fastest in ${worstBurnZone?.sector || payload.zoneLabel}. The winning move is to narrow service focus and price tactically where supply is collapsing.`
        : `The financial burn audit shows that monsoon conditions changed the unit economics. Reduced field mobility and concentrated repair demand are inflating burn in ${worstBurnZone?.sector || payload.zoneLabel}, so workforce mix matters as much as CAC discipline.`,
      procedures: [
        `Prioritize high-value Plumbing, Roofing, and Electrical queues in ${worstBurnZone?.sector || hottestSector} so scarce capacity protects the best LTV lanes first.`,
        `Activate 15-20% tactical surge pricing in the worst-affected sectors where density and emergency demand are rising faster than worker mobility can recover.`,
        `Move salaried workers into an emergency-response roster immediately and pause low-urgency jobs until daily burn falls below ${formatCurrency(Math.max(0, overallBurn * 0.7))}.`,
      ],
    };
  }

  if (activeScenario === "monsoon") {
    return {
      signal: `${payload.zoneLabel} has entered a monsoon deployment state; repair demand is accelerating while available worker mobility is falling.`,
      reasoning: `RAHI should treat this as an emergency operating window rather than a normal density cycle. The Density Rule still applies, but storm conditions make response speed and repair prioritization more important than flat city-wide coverage.`,
      procedures: [
        `Prioritize Plumbing, Roofing, and Electrical queues around ${hottestSector} before expanding capacity into lower-urgency categories.`,
        `Raise payout or pricing selectively in the worst-affected sectors so acceptance speed improves without triggering city-wide burn.`,
        `Shift salaried workers into an emergency-response lane until density and response times normalize after the weather event.`,
      ],
    };
  }

  if (activeScenario === "price_war" && payload.analysisMode === "investor_summary") {
    return {
      signal: `${payload.zoneLabel} held the contested-market simulation while CAC spiked and the engine protected its profitability floor instead of matching blanket discounts.`,
      reasoning: `The investor proof is that RAHI did not chase vanity growth. The system isolated ${worstBurnZone?.sector || hottestSector} as the most margin-sensitive lane, preserved density where LTV was strongest, and kept margin defense ahead of discount reflexes.`,
      procedures: [
        `Scalability Proof: The price-war run held across ${Number(payload.simulationSummary.totalPoints || 0).toLocaleString("en-IN")} synthetic requests while CAC and churn pressure were artificially elevated.`,
        `Density Optimization Result: ${hottestSector} remained the trusted high-LTV sector, so the engine defended it instead of applying city-wide discounting.`,
        `Profitability Path: Preserve the margin floor by attacking ${worstBurnZone?.sector || payload.zoneLabel} burn first and shifting retention spend toward repeat-demand sectors only.`,
      ],
    };
  }

  if (activeScenario === "price_war" && payload.analysisMode === "financial_audit") {
    return {
      signal: `${payload.zoneLabel} is in a price-war burn cycle; acquisition cost and churn are rising faster than broad discounting can sustainably absorb.`,
      reasoning: isPriceWarQuestion
        ? `If the competitor sustains discounts for a month, the command zone is on track to burn roughly ${formatCurrency(oneMonthBurn)} at the current pace unless RAHI narrows spend to high-LTV sectors and shifts the offer from price to trust.`
        : `The financial audit says this is not a volume problem first, it is a margin-defense problem. ${worstBurnZone?.sector || payload.zoneLabel} is weakest because CAC has inflated relative to LTV while churn keeps fixed labor and discount pressure elevated.`,
      procedures: [
        `Freeze city-wide discounts and move retention spend into ${topUnitEconomics?.sector || hottestSector}, where LTV can still outrun CAC.`,
        `Launch a loyalty or trusted-neighbor offer for repeat customers before spending another rupee on broad acquisition recovery.`,
        `Reduce salaried expansion in ${worstBurnZone?.sector || payload.zoneLabel} until daily burn falls below ${formatCurrency(Math.max(0, Number(worstBurnZone?.dailyBurn || 0) * 0.45))}.`,
      ],
    };
  }

  if (activeScenario === "price_war") {
    return {
      signal: `${payload.zoneLabel} has entered a contested-market state; margin protection now matters more than headline order growth.`,
      reasoning: `The Density Rule still matters, but price-war conditions change the order of operations. RAHI should protect trusted, repeatable demand first because CAC inflation and churn punish blanket growth strategies.`,
      procedures: [
        `Protect high-LTV sectors around ${hottestSector} and stop matching discounts in low-trust, low-repeat lanes.`,
        `Shift the customer message from lowest price to verified service, on-time arrival, and audit-backed proof of work.`,
        `Re-run the burn audit daily until contribution margin stabilizes and CAC falls back below the current LTV floor.`,
      ],
    };
  }

  if (activeScenario === "supply_crunch") {
    const criticalSector = [...(payload.simulationSummary?.sectors || [])]
      .sort((left, right) => (Number(right.supplyGapRatio || 0) - Number(left.supplyGapRatio || 0)) || (Number(right.densityScore || 0) - Number(left.densityScore || 0)))[0];
    const gapPercent = Math.round(Number(criticalSector?.supplyGapRatio || 0) * 100);
    const targetSector = criticalSector?.sector || worstBurnZone?.sector || hottestSector;
    const rerouteWorkers = Math.max(
      6,
      Math.round((Number(criticalSector?.recommendedShift || 0) * 0.8) || (payload.currentWorkers * 0.35)),
    );

    if (payload.analysisMode === "investor_summary") {
      return {
        signal: `${payload.zoneLabel} survived the 50% supply shortage drill by exposing the first breaking sector and rerouting the salaried core before service quality collapsed.`,
        reasoning: `The investor proof here is resilience. The engine identified ${targetSector} as the first critical gap, switched from growth to service preservation, and kept the density model explainable under extreme supply loss.`,
        procedures: [
          `Scalability Proof: The supply shortage run held across ${Number(payload.simulationSummary.totalPoints || 0).toLocaleString("en-IN")} synthetic requests while workforce availability was halved.`,
          `Density Optimization Result: ${targetSector} surfaced as the first breaking lane, so the engine redirected its salaried core and contained the service gap.`,
          `Profitability Path: Preserve high-density service lanes first, then reopen the outer perimeter only after the supply gap falls below 30%.`,
        ],
      };
    }

    if (payload.analysisMode === "financial_audit") {
      return {
        signal: `Emergency preservation mode: ${targetSector} is running a ${gapPercent}% supply-demand gap and must be stabilized before growth resumes.`,
        reasoning: `The supply shortage flag overrides normal growth posture. RAHI should preserve service because density is ${payload.densityScore.toFixed(2)} and ${targetSector} is critically under-supplied against live projected demand.`,
        procedures: [
          `Suspend non-essential bookings outside ${targetSector} until the supply gap drops below 30%.`,
          `Re-route at least ${rerouteWorkers} salaried-core workers into ${targetSector} and keep freelancers as overflow only.`,
          `Activate 1.50x payout protection immediately so high-density service lanes keep filling during the crunch window.`,
        ],
      };
    }

    return {
      signal: `Emergency preservation mode: ${targetSector} is running a ${gapPercent}% supply-demand gap and must be stabilized before growth resumes.`,
      reasoning: `The supply shortage flag overrides normal growth posture. RAHI should preserve service because density is ${payload.densityScore.toFixed(2)} and ${targetSector} is critically under-supplied against live projected demand.`,
      procedures: [
        `Suspend non-essential bookings outside ${targetSector} until the supply gap drops below 30%.`,
        `Re-route at least ${rerouteWorkers} salaried-core workers into ${targetSector} and keep freelancers as overflow only.`,
        `Activate 1.50x payout protection immediately so high-density service lanes keep filling during the crunch window.`,
      ],
    };
  }

  if (payload.analysisMode === "investor_summary") {
    return {
      signal: `${payload.city} command zone summary ready: ${payload.zoneLabel} processed ${Number(payload.simulationSummary.totalPoints || 0).toLocaleString("en-IN")} synthetic requests and surfaced ${Number(payload.simulationSummary.totalProjectedOrders || payload.predictedDemand || 0).toLocaleString("en-IN")} projected jobs.`,
      reasoning: `The investor-ready message is that density optimization converted the selected ${payload.radiusKm} km radius into a measurable operating plan with margin lift of ${formatCurrency(marginLift)} and a clearest pressure point in ${worstBurnZone?.sector || hottestSector}.`,
      procedures: [
        `Scalability Proof: The ${payload.zoneLabel} simulation held across ${Number(payload.simulationSummary.totalPoints || 0).toLocaleString("en-IN")} synthetic requests without breaking the density allocation model.`,
        `Density Optimization Result: ${hottestSector} emerged as the hottest zone, and the engine recommends a ${Math.round(Number(payload.simulationSummary.averageSalariedRatio || 0))}% salaried mix where density justifies it.`,
        `Profitability Path: Protect runway by attacking ${worstBurnZone?.sector || payload.zoneLabel} burn first and preserving the current margin lift of ${formatCurrency(marginLift)} with zone-specific staffing changes.`,
      ],
    };
  }

  if (payload.analysisMode === "financial_audit") {
    if (isMonsoon) {
      return {
        signal: `${payload.zoneLabel} is running an active monsoon stress test; supply is compressed while repair demand is climbing, so contribution margin is at risk if the city keeps operating like a sunny-day network.`,
        reasoning: `The weather-aware Density Rule says ${payload.zoneLabel} must act like an emergency lane first. Density is ${payload.densityScore.toFixed(2)}, daily burn is ${formatCurrency(overallBurn)}, and the current signal "${payload.weatherSignal}" means workforce mobility and service reliability will deteriorate before fixed cost pressure relaxes.`,
        procedures: [
          `Deprioritize cosmetic services across ${payload.zoneLabel} and redeploy salaried workers into Plumbing, Roofing, and Electrical lanes for the next 48 hours.`,
          `Lift pricing to at least ${Math.max(1.25, Number(payload.priceMultiplier || 1)).toFixed(2)}x in flooded or delayed sectors so the weather response does not turn into pure burn.`,
          `Track ${worstBurnZone?.sector || payload.zoneLabel} hourly and freeze non-essential acquisition until the monsoon burn falls below ${formatCurrency(Math.max(0, overallBurn * 0.55))}.`,
        ],
      };
    }

    return {
      signal: `${payload.zoneLabel} unit economics ${overallBurn > 0 ? `show active daily burn of ${formatCurrency(overallBurn)}` : "are currently contribution-positive"} with the sharpest pressure concentrated in ${worstBurnZone?.sector || payload.zoneLabel}.`,
      reasoning: `The burn audit reads CAC vs LTV first. ${worstBurnZone?.sector || payload.zoneLabel} is the weakest zone because CAC is ${formatCurrency(worstBurnZone?.acquisitionCost || payload.financials.acquisitionCost)} against LTV ${formatCurrency(worstBurnZone?.estimatedLtv || 0)}, while the current salaried mix and churn of ${Number(worstBurnZone?.churnRisk || payload.financials.churnRate || 0).toFixed(2)} keep fixed labor pressure elevated.`,
      procedures: [
        `Reduce salaried exposure in ${worstBurnZone?.sector || payload.zoneLabel} until daily burn falls below ${formatCurrency(Math.max(0, Number(worstBurnZone?.dailyBurn || 0) * 0.4))}.`,
        `Only scale acquisition in zones where LTV stays above CAC by at least 3x; current best candidate is ${topUnitEconomics?.sector || hottestSector}.`,
        `Reinvest the recovered margin lift of ${formatCurrency(marginLift)} into higher-density service lanes instead of flat city-wide hiring.`,
      ],
    };
  }

  if (isMonsoon) {
    return {
      signal: `${payload.zoneLabel} is under active monsoon deployment protocol; density ${payload.densityScore.toFixed(2)} and weather friction are pushing the zone into emergency-repair mode.`,
      reasoning: `The Density Rule becomes weather-aware in this case: with ${payload.weatherSignal} and ${payload.emergencyOrders} emergency jobs, RAHI should treat Plumbing, Roofing, and Electrical as the operating core and protect reliability before broad service coverage.`,
      procedures: [
        `Deploy salaried core workers into emergency repair lanes in ${payload.zoneLabel} and pause low-urgency cosmetic work until the rain window clears.`,
        `Apply a ${Math.max(1.25, Number(payload.priceMultiplier || 1)).toFixed(2)}x weather multiplier in the slowest sectors to offset transport delays and incentive burn.`,
        `Re-run the simulation every 6 hours and only reopen general-service growth if audit coverage stays above 80% while density drops below 2.3.`,
      ],
    };
  }

  if (densityBand === "high_density") {
    return {
      signal: `${payload.zoneLabel} is overheating; density ${payload.densityScore.toFixed(2)} is above the salaried-core threshold and ${payload.predictedDemand} jobs are clustering faster than ${payload.currentWorkers} workers can absorb.`,
      reasoning: `RAHI should treat ${payload.zoneLabel} as a reliability-first zone because D=${payload.densityScore.toFixed(2)} exceeds 2.5. The Density Rule says this is not the place to lean on freelancer variability, especially with ${payload.emergencyOrders} emergency jobs and a forecast gap around ${topGap?.label || "the current wave"}.`,
      procedures: [
        `Deploy 4-6 salaried workers into ${payload.zoneLabel} immediately and prioritize emergency services until density drops below 2.3.`,
        `Hold surge pricing near ${payload.priceMultiplier.toFixed(2)}x and protect fill rate before chasing new acquisition in ${payload.city}.`,
        `Move QA checks to the highest-volume service lane in ${hottestSector} and monitor photo-proof success before tonight's next forecast spike.`,
      ],
    };
  }

  if (densityBand === "low_density") {
    return {
      signal: `${payload.zoneLabel} is under-dense; D=${payload.densityScore.toFixed(2)} indicates a burn trap if salaried hiring continues before local order concentration improves.`,
      reasoning: `RAHI should keep ${payload.zoneLabel} freelancer-led because D=${payload.densityScore.toFixed(2)} is below 1.0. The Density Rule treats this as scattered demand, so fixed payroll would rise faster than service reliability, especially with acquisition cost at ${formatCurrency(payload.financials.acquisitionCost)}.`,
      procedures: [
        `Pause salaried expansion in ${payload.zoneLabel} and route only verified freelancers into the active service mix for the next ${payload.timeLens}.`,
        `Increase referral or availability bonuses for top-rated freelancers by 8-10% instead of adding fixed payroll in ${payload.city}.`,
        `Shift discretionary marketing away from ${payload.zoneLabel} unless the forecast crosses 1.1 density or margin lift moves above ${formatCurrency(Math.max(0, marginLift))}.`,
      ],
    };
  }

  return {
    signal: `${payload.zoneLabel} is in transition; D=${payload.densityScore.toFixed(2)} supports a hybrid workforce, but the next move should be paced against forecast lift and churn pressure.`,
    reasoning: `RAHI should run ${payload.zoneLabel} as a transition zone because D=${payload.densityScore.toFixed(2)} sits between 1.0 and 2.5. That means a hybrid mix is optimal while the Random Forest forecast and margin lift of ${formatCurrency(marginLift)} confirm whether the zone is climbing toward a stable salaried core.`,
    procedures: [
      `Add 2-3 salaried anchors around ${payload.zoneLabel} while keeping flexible freelancer coverage for demand spikes in ${topGap?.label || "the next forecast window"}.`,
      `Monitor churn at ${Number(payload.financials.churnRate || 0).toFixed(1)}% and hold acquisition spend until repeat demand improves faster than fixed labor cost.`,
      `Re-run the simulation after the next demand pulse and promote the zone to salaried-core only if density stays above 1.8 for consecutive windows.`,
    ],
  };
};

export const analyzeStrategyWithLLM = async (input) => {
  const payload = StrategyPayloadSchema.parse(input);
  const providers = payload.providerPreference === "gemini"
    ? [callGeminiStrategy, callGroqStrategy]
    : payload.providerPreference === "groq"
      ? [callGroqStrategy, callGeminiStrategy]
      : [callGroqStrategy, callGeminiStrategy];

  for (const provider of providers) {
    try {
      return await provider(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error";
      const providerLabel = error instanceof ProviderRequestError ? `${error.provider}:${error.status}` : provider.name;
      console.warn("[strategy-llm]", providerLabel, message);
    }
  }

  const fallbackStrategy = buildFallbackStrategy(payload);
  const counterPositioningMove = hasCompetitorPressure(payload)
    ? buildTrustDefenseMove(payload)
    : undefined;
  const auditLog = counterPositioningMove
    ? buildCompetitorAuditLog(payload, counterPositioningMove)
    : undefined;

  return {
    strategy: {
      ...fallbackStrategy,
      ...(counterPositioningMove ? { counterPositioningMove } : {}),
      ...(auditLog ? { auditLog } : {}),
      procedures: normalizeProcedures(fallbackStrategy.procedures, payload),
    },
    provider: "rule_engine",
    model: "density-rule-fallback",
    rawText: null,
  };
};

export const hasStrategyProviderConfigured = () => Boolean(getGroqApiKey() || getGeminiApiKey());
