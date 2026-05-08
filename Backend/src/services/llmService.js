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
- Market Context: City name, state or region, city tier, whether this is an existing pilot or a new market-entry corridor, and whether historical data exists yet.
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
const DEFAULT_ADMIN_COPILOT_MAX_TOKENS = 450;
const DEFAULT_SYSTEM_INSIGHTS_MAX_TOKENS = 320;
const ADMIN_ROUTE_PREFIX = "/admin-portal-2026";

const ADMIN_COPILOT_SYSTEM_PROMPT = `### ROLE: RAHI TECHNICAL COPILOT
You are the technical copilot for the RAHI admin suite. You help operators understand incidents, summarize recent audit events, and navigate safely inside the admin surface.

### OPERATING RULES
- Use only the provided system context, issue list, and audit trail.
- If you infer a cause instead of proving it directly, say that it is an inference.
- Keep answers concise, operator-friendly, and technically grounded.
- Only navigate when the operator is clearly asking to move somewhere.
- If the operator asks for navigation and analysis together, answer the question briefly first and still return the route.
- Never send the operator outside the admin suite.
- Never suggest logout, customer routes, or destructive actions.

### NAVIGATION TOOL
You may select a single MapsTo(route) destination, but it must be one of the allowed admin routes supplied in the prompt.

### OUTPUT
Return valid JSON with:
- reply: short natural-language answer for the operator.
- navigationTarget: allowed admin route string or null.
- navigationReason: short reason for the route choice or null.
- auditHighlights: up to 3 short audit or issue lines.
- confidence: one of high, medium, low.`;

const SYSTEM_INSIGHTS_SYSTEM_PROMPT = `### ROLE: RAHI SYSTEM INSIGHTS ENGINE
You convert compact RAHI operating metrics into 5 concise strategy chips for leadership.

### OBJECTIVE
Generate exactly 5 actionable chips in this order:
1. Local Ops
2. Financial Sustainability
3. Market Expansion
4. Expansion Budget
5. Revenue Potential

### RULES
- Each chip must be concise, executive-friendly, and operationally useful.
- Ground every chip in the supplied metrics.
- Keep each insight under 140 characters when possible.
- If a village-level readiness object is present, treat it as a Punjab micro-market and benchmark it against the Punjab state average.
- For Punjab villages, the Expansion Posture chip must explicitly include:
  "Micro-Market Entry"
  and compare the village against the Punjab state average.
- If the market city is NOT Agra, the Expansion Posture chip must explicitly include:
  "Shadow Launch (Freelancer-First)"
  and the exact financial line:
  "Projected CAC: ₹150 | Payback Window: 18 Days"
- If the market city IS Agra, focus the Expansion Posture chip on protecting the pilot before aggressive rollout.
- Do not mention that you are an AI.

### OUTPUT
Return valid JSON:
{
  "chips": [
    { "id": "local_ops", "title": "Local Ops", "insight": "..." },
    { "id": "financial_stability", "title": "Financial Sustainability", "insight": "..." },
    { "id": "expansion_posture", "title": "Market Expansion", "insight": "..." }
  ]
}

Respond with JSON only.`;

const ADMIN_ALLOWED_ROUTE_PATTERNS = [
  /^\/admin-portal-2026\/overview$/,
  /^\/admin-portal-2026\/workforce$/,
  /^\/admin-portal-2026\/finance$/,
  /^\/admin-portal-2026\/settings$/,
  /^\/admin-portal-2026\/heatmap$/,
  /^\/admin-portal-2026\/observability\/(system-health|bug-monitor|api-telemetry|audit-logs)$/,
  /^\/admin-portal-2026\/war-room\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/,
  /^\/admin-portal-2026\/intelligence\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/,
];

const ADMIN_ROUTE_TOOL_CATALOG = [
  {
    route: `${ADMIN_ROUTE_PREFIX}/overview`,
    label: "Overview",
    reason: "Opening the morning brief and executive snapshot.",
    keywords: ["overview", "dashboard", "brief", "summary"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/workforce`,
    label: "Workforce",
    reason: "Opening workforce operations for worker, booking, and trust-score review.",
    keywords: ["workforce", "workers", "bookings", "customers", "trust scores", "trust score", "fleet"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/finance`,
    label: "Finance",
    reason: "Opening finance so you can inspect payouts, revenue, and payment exposure.",
    keywords: ["finance", "money", "payments", "payment", "payout", "payouts", "revenue", "cash"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/observability/system-health`,
    label: "System Health",
    reason: "Opening system health for uptime, provider status, and deployment checks.",
    keywords: ["system health", "observability", "uptime", "infra", "deployment", "health"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/observability/bug-monitor`,
    label: "Issue Monitor",
    reason: "Opening the issue monitor so the top incidents stay in view.",
    keywords: ["bug", "bugs", "incident", "incidents", "failure", "failures", "error", "errors"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/observability/api-telemetry`,
    label: "API Telemetry",
    reason: "Opening API telemetry for latency and performance signals.",
    keywords: ["latency", "telemetry", "api", "performance", "response time"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/observability/audit-logs`,
    label: "Audit Logs",
    reason: "Opening the verified audit trail and recent operating events.",
    keywords: ["audit", "logs", "log", "trail", "strict persistence", "persistence"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/heatmap`,
    label: "Heatmap",
    reason: "Opening the heatmap view for spatial demand analysis.",
    keywords: ["heatmap", "density map"],
  },
];

const ADMIN_WAR_ROOM_ROUTE_CATALOG = [
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/uttar-pradesh/agra`,
    label: "Agra War Room",
    reason: "Opening the Agra war room so the map centers on the pilot market.",
    keywords: ["agra cantt", "agra", "uttar pradesh"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/punjab/chandigarh`,
    label: "Chandigarh War Room",
    reason: "Opening the Chandigarh war room so the map centers on that market.",
    keywords: ["chandigarh", "punjab"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/punjab/amritsar`,
    label: "Amritsar War Room",
    reason: "Opening the Amritsar war room so the map centers on that market.",
    keywords: ["amritsar", "punjab"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/punjab/ludhiana`,
    label: "Ludhiana War Room",
    reason: "Opening the Ludhiana war room so the map centers on that market.",
    keywords: ["ludhiana", "punjab"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/uttar-pradesh/lucknow`,
    label: "Lucknow War Room",
    reason: "Opening the Lucknow war room so the map centers on that market.",
    keywords: ["lucknow", "uttar pradesh"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/uttar-pradesh/noida`,
    label: "Noida War Room",
    reason: "Opening the Noida war room so the map centers on that market.",
    keywords: ["noida", "uttar pradesh"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/delhi/new-delhi`,
    label: "New Delhi War Room",
    reason: "Opening the New Delhi war room so the map centers on that market.",
    keywords: ["new delhi", "delhi"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/delhi/north-delhi`,
    label: "North Delhi War Room",
    reason: "Opening the North Delhi war room so the map centers on that market.",
    keywords: ["north delhi", "delhi north"],
  },
  {
    route: `${ADMIN_ROUTE_PREFIX}/war-room/delhi/south-delhi`,
    label: "South Delhi War Room",
    reason: "Opening the South Delhi war room so the map centers on that market.",
    keywords: ["south delhi", "delhi south"],
  },
];

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
  cityName: z.string().optional().default("Unknown City"),
  stateName: z.string().optional().default(""),
  stateCode: z.string().optional().default(""),
  marketContext: z.string().optional().default(""),
  cityTier: z.enum(["pilot", "tier_1", "tier_2", "tier_3", "international"]).optional().default("tier_3"),
  isExistingMarket: z.boolean().optional().default(false),
  hasHistoricalData: z.boolean().optional().default(false),
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

const AdminCopilotRequestSchema = z.object({
  message: z.string().min(1),
  currentRoute: z.string().optional().default(`${ADMIN_ROUTE_PREFIX}/observability/system-health`),
  systemSummary: z.any().optional().default(null),
  systemContext: z.object({
    currentMission: z.string().optional().default("observability"),
    currentObservabilityPanel: z.string().optional().default("system-health"),
    currentZoneId: z.string().optional().default("agra"),
    zoneLabel: z.string().optional().default("Agra Cantt"),
    globalUptime: z.string().optional().default("99.20%"),
    latencyMs: z.number().nonnegative().optional().default(0),
    llmMode: z.enum(["ready", "fallback"]).optional().default("ready"),
    llmSummary: z.string().optional().default("Cloud Engine: Monitoring"),
    activeWorkerRate: z.number().optional().default(0),
    activeBugs: z.number().optional().default(0),
    pendingPayouts: z.number().optional().default(0),
    averageTicket: z.number().optional().default(0),
    sevenDayBookings: z.number().optional().default(0),
    sevenDayRevenue: z.number().optional().default(0),
    healthSnapshot: z.any().optional().default(null),
  }).optional().default({}),
  issues: z.array(z.object({
    code: z.string().optional().default(""),
    domain: z.string().optional().default(""),
    severity: z.string().optional().default("watch"),
    message: z.string().optional().default(""),
    impact: z.string().optional().default(""),
    recommendedAction: z.string().optional().default(""),
  })).optional().default([]),
  auditTrail: z.array(z.object({
    source: z.string().optional().default("audit"),
    severity: z.string().optional().default("info"),
    message: z.string().optional().default(""),
    time: z.string().optional().default(""),
  })).optional().default([]),
  providerPreference: z.enum(["groq", "gemini"]).optional(),
});

const AdminCopilotResponseSchema = z.object({
  reply: z.string().min(1),
  navigationTarget: z.string().nullable().optional(),
  navigationReason: z.string().nullable().optional(),
  auditHighlights: z.array(z.string()).optional().default([]),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
});

const SystemInsightsRequestSchema = z.object({
  marketMetrics: z.object({
    state: z.string().optional().default("Uttar Pradesh"),
    stateSlug: z.string().optional().default("uttar-pradesh"),
    city: z.string().optional().default("Agra"),
    citySlug: z.string().optional().default("agra"),
    zoneLabel: z.string().optional().default("Agra Cantt"),
    marketLabel: z.string().optional().default("Agra, Uttar Pradesh"),
    density: z.number().optional().default(0.82),
    surgeZones: z.array(z.string()).optional().default([]),
    cityTier: z.enum(["pilot", "tier_1", "tier_2", "tier_3", "international"]).optional().default("tier_2"),
    isExistingMarket: z.boolean().optional().default(false),
    entryPosture: z.string().optional().default("Shadow Launch (Freelancer-First)"),
    hierarchyPath: z.string().optional().default("Uttar Pradesh > Agra"),
  }).optional().default({}),
  unitEconomics: z.object({
    yieldPerJob: z.number().optional().default(0),
    cacProjected: z.number().optional().default(150),
    paybackDays: z.number().optional().default(18),
    launchCacPerWorker: z.number().optional().default(150),
    marketCapacity: z.number().optional().default(0),
    regionalEntryBudget: z.number().optional().default(0),
    burnToScaleRatio: z.number().optional().default(0),
    launchMode: z.string().optional().default("Shadow Launch"),
    projectedFirstYearRevenue: z.number().optional().default(0),
    marketShareCapture: z.number().optional().default(12),
    marginExpansionPer100Workers: z.number().optional().default(4.2),
    operationalEfficiencyGain: z.number().optional().default(0.042),
    scalabilityNewWorkers: z.number().optional().default(100),
    scalabilityDeltaProfit: z.number().optional().default(0),
    scalabilityDeltaProfitAnnualized: z.number().optional().default(0),
  }).optional().default({}),
  marketReadiness: z.object({
    villageCode: z.string().optional().default(""),
    laborAvailabilityIndex: z.number().optional().default(0),
    connectivityStability: z.number().optional().default(0),
    infrastructureGapScore: z.number().optional().default(0),
    villageReadinessScore: z.number().optional().default(0),
    projectedCac: z.number().optional().default(150),
    popDensity: z.number().optional().default(0),
    domesticPowerHours: z.number().optional().default(0),
    hhSize: z.number().optional().default(0),
    agriPowerHours: z.number().optional().default(0),
    benchmarkLabel: z.string().optional().default("Punjab state average"),
    comparisonNarrative: z.string().optional().default("Village benchmarking pending."),
  }).nullable().optional().default(null),
  systemHealth: z.object({
    criticalBugs: z.number().int().nonnegative().optional().default(0),
    uptime: z.number().nonnegative().optional().default(99.9),
    llmMode: z.enum(["ready", "fallback"]).optional().default("ready"),
  }).optional().default({}),
  providerPreference: z.enum(["groq", "gemini"]).optional(),
});

const SystemInsightChipSchema = z.object({
  id: z.enum(["local_ops", "financial_stability", "expansion_posture", "expansion_budget", "revenue_potential"]),
  title: z.string().optional(),
  insight: z.string().min(1),
});

const SystemInsightsResponseSchema = z.object({
  chips: z.array(SystemInsightChipSchema).min(1).max(5),
});

const adminCopilotJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    navigationTarget: { type: ["string", "null"] },
    navigationReason: { type: ["string", "null"] },
    auditHighlights: {
      type: "array",
      items: { type: "string" },
      minItems: 0,
      maxItems: 3,
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["reply", "navigationTarget", "navigationReason", "auditHighlights", "confidence"],
  additionalProperties: false,
};

const adminCopilotGeminiSchema = {
  type: "object",
  properties: adminCopilotJsonSchema.properties,
  required: adminCopilotJsonSchema.required,
};

const systemInsightsJsonSchema = {
  type: "object",
  properties: {
    chips: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: ["local_ops", "financial_stability", "expansion_posture", "expansion_budget", "revenue_potential"] },
          title: { type: "string" },
          insight: { type: "string" },
        },
        required: ["id", "title", "insight"],
        additionalProperties: false,
      },
    },
  },
  required: ["chips"],
  additionalProperties: false,
};

const systemInsightsGeminiSchema = {
  type: "object",
  properties: systemInsightsJsonSchema.properties,
  required: systemInsightsJsonSchema.required,
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
  const marketModeInstruction = payload.isExistingMarket
    ? "This is an existing pilot market. You may optimize around live operating history and reliability proof."
    : "This is a new market-entry corridor. Do not assume real historical orders exist. Use synthetic simulation, density logic, and expansion discipline instead.";
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
    marketModeInstruction,
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
      cityName: payload.cityName,
      stateName: payload.stateName,
      stateCode: payload.stateCode,
      cityTier: payload.cityTier,
      isExistingMarket: payload.isExistingMarket,
      hasHistoricalData: payload.hasHistoricalData,
      scenario: activeScenario,
      weatherSignal: payload.weatherSignal,
      radiusKm: payload.radiusKm,
      timeLens: payload.timeLens,
      marketContext: payload.marketContext,
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

const normalizeTextArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeOptionalText(item))
    .filter(Boolean)
    .slice(0, 3);
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

const sanitizeAdminRoute = (route) => {
  const normalized = normalizeOptionalText(route);
  if (!normalized) return null;
  return ADMIN_ALLOWED_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized))
    ? normalized
    : null;
};

const tokenizeAdminCopilotQuery = (value) => (
  String(value || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    || []
);

const hasAdminNavigationIntent = (message) => (
  /(?:go to|take me(?: to)?|open|show me|jump to|navigate(?: to)?|bring me(?: to)?|move to)/i
    .test(String(message || ""))
);

const findMatchingAdminRoute = (normalizedMessage, routes) => (
  routes.find((entry) => entry.keywords.some((keyword) => normalizedMessage.includes(keyword)))
  || null
);

const resolveAdminNavigation = (message, systemContext = {}, currentRoute = "") => {
  const normalizedMessage = String(message || "").toLowerCase();
  if (!normalizedMessage) return null;

  const currentZoneId = String(systemContext?.currentZoneId || "agra").trim().toLowerCase() || "agra";
  const currentZoneLabel = normalizeOptionalText(systemContext?.zoneLabel) || "the active zone";
  const safeCurrentRoute = sanitizeAdminRoute(currentRoute);
  const currentZoneRoute = {
    route: safeCurrentRoute
      || `${ADMIN_ROUTE_PREFIX}/war-room/uttar-pradesh/agra`,
    label: `${currentZoneLabel} War Room`,
    reason: `Opening the war room for ${currentZoneLabel}.`,
  };

  const explicitZoneRoute = findMatchingAdminRoute(normalizedMessage, ADMIN_WAR_ROOM_ROUTE_CATALOG);
  if (explicitZoneRoute && (hasAdminNavigationIntent(normalizedMessage) || /war room|operations center|map|intelligence/.test(normalizedMessage))) {
    return explicitZoneRoute;
  }

  if (/war room|operations center|map|intelligence/.test(normalizedMessage) && hasAdminNavigationIntent(normalizedMessage)) {
    return currentZoneRoute;
  }

  if (!hasAdminNavigationIntent(normalizedMessage)) {
    return null;
  }

  return findMatchingAdminRoute(normalizedMessage, ADMIN_ROUTE_TOOL_CATALOG)
    || explicitZoneRoute
    || null;
};

const buildAdminCopilotPrompt = (payload, heuristicNavigation) => {
  const healthSnapshot = payload.systemContext?.healthSnapshot || {};
  const summaryContext = {
    currentRoute: payload.currentRoute,
    currentMission: payload.systemContext?.currentMission,
    observabilityPanel: payload.systemContext?.currentObservabilityPanel,
    systemSummary: payload.systemSummary || null,
    zoneLabel: payload.systemContext?.zoneLabel,
    uptime: payload.systemContext?.globalUptime,
    latencyMs: payload.systemContext?.latencyMs,
    activeBugs: payload.systemContext?.activeBugs,
    activeWorkerRate: payload.systemContext?.activeWorkerRate,
    pendingPayouts: payload.systemContext?.pendingPayouts,
    averageTicket: payload.systemContext?.averageTicket,
    sevenDayBookings: payload.systemContext?.sevenDayBookings,
    sevenDayRevenue: payload.systemContext?.sevenDayRevenue,
    llmMode: payload.systemContext?.llmMode,
    llmSummary: payload.systemContext?.llmSummary,
    database: healthSnapshot?.database || "unknown",
    secureUploads: healthSnapshot?.media?.secureUploadsReady ? "ready" : "fallback",
    deploymentBranch: healthSnapshot?.deployment?.branch || "unknown",
    deploymentCommit: healthSnapshot?.deployment?.commit || null,
  };

  const issueLines = payload.issues.length > 0
    ? payload.issues.slice(0, 8).map((issue) => (
      `- [${String(issue.severity || "watch").toUpperCase()}] ${issue.domain || issue.code || "Issue"}: ${issue.message}${issue.impact ? ` Impact: ${issue.impact}` : ""}${issue.recommendedAction ? ` Action: ${issue.recommendedAction}` : ""}`
    )).join("\n")
    : "- No open issues supplied.";

  const auditLines = payload.auditTrail.length > 0
    ? payload.auditTrail.slice(0, 12).map((entry) => (
      `- [${String(entry.source || "audit").toUpperCase()}${entry.time ? ` @ ${entry.time}` : ""}] ${entry.message}`
    )).join("\n")
    : "- No recent audit events supplied.";

  const allowedRouteLines = [...ADMIN_ROUTE_TOOL_CATALOG, ...ADMIN_WAR_ROOM_ROUTE_CATALOG]
    .map((entry) => `- ${entry.label}: ${entry.route}`)
    .join("\n");

  return [
    "System Context:",
    JSON.stringify(summaryContext, null, 2),
    "",
    "Open Issues:",
    issueLines,
    "",
    "STRICT_PERSISTENCE Audit Trail:",
    auditLines,
    "",
    "Allowed MapsTo(route) destinations:",
    allowedRouteLines,
    "",
    `Heuristic navigation hint: ${heuristicNavigation ? `${heuristicNavigation.route} (${heuristicNavigation.reason})` : "none"}`,
    "",
    `Operator query: ${payload.message}`,
    "",
    "Return JSON only. Keep reply concise. Use navigationTarget only for a clear admin-navigation intent.",
  ].join("\n");
};

const collectRelevantAdminHighlights = (payload) => {
  const tokens = tokenizeAdminCopilotQuery(payload.message).filter((token) => token.length > 2);
  const scored = [
    ...payload.issues.map((issue) => ({
      source: issue.domain || issue.code || "issue",
      message: [issue.message, issue.impact, issue.recommendedAction].filter(Boolean).join(" "),
      severity: issue.severity || "watch",
      score: 0,
    })),
    ...payload.auditTrail.map((entry) => ({
      source: entry.source || "audit",
      message: entry.message || "",
      severity: entry.severity || "info",
      score: 0,
    })),
  ].map((entry) => {
    const haystack = `${entry.source} ${entry.message}`.toLowerCase();
    const matchedTokenCount = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    const severityBoost = entry.severity === "critical"
      ? 3
      : entry.severity === "watch"
        ? 2
        : 1;
    return {
      ...entry,
      score: matchedTokenCount + severityBoost,
    };
  });

  const bestScore = scored.reduce((max, entry) => Math.max(max, entry.score), 0);
  const relevant = bestScore > 1
    ? scored.filter((entry) => entry.score >= bestScore - 1)
    : scored.filter((entry) => entry.severity === "critical" || entry.severity === "watch");

  return relevant
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => `[${String(entry.source || "audit").toUpperCase()}] ${entry.message.trim()}`)
    .filter(Boolean);
};

const finalizeAdminCopilot = (raw, payload, heuristicNavigation) => {
  const parsed = AdminCopilotResponseSchema.parse(raw);
  const llmNavigation = sanitizeAdminRoute(parsed.navigationTarget);
  const finalNavigation = heuristicNavigation?.route
    || (hasAdminNavigationIntent(payload.message) ? llmNavigation : null);
  const navigationReason = finalNavigation
    ? heuristicNavigation?.reason
      || normalizeOptionalText(parsed.navigationReason)
      || `Opening ${finalNavigation}.`
    : null;

  return {
    reply: parsed.reply.trim(),
    navigationTarget: finalNavigation,
    navigationReason,
    auditHighlights: normalizeTextArray(parsed.auditHighlights),
    confidence: parsed.confidence || "medium",
  };
};

const buildAdminCopilotFallback = (payload) => {
  const query = String(payload.message || "").toLowerCase();
  const navigation = resolveAdminNavigation(payload.message, payload.systemContext, payload.currentRoute);
  const highlights = collectRelevantAdminHighlights(payload);
  const latencyMs = Math.round(Number(payload.systemContext?.latencyMs || 0));
  const activeBugs = Math.round(Number(payload.systemContext?.activeBugs || 0));
  const criticalBugCount = Math.round(Number(payload.systemSummary?.systemHealth?.criticalBugs || activeBugs || 0));
  const yieldPerJob = Math.round(Number(payload.systemSummary?.unitEconomics?.yieldPerJob || 0));
  const healthSnapshot = payload.systemContext?.healthSnapshot || {};
  const database = healthSnapshot?.database || "unknown";
  const secureUploadsReady = healthSnapshot?.media?.secureUploadsReady === true;
  const llmMode = payload.systemContext?.llmMode || healthSnapshot?.llm?.mode || "ready";

  let reply;

  if (navigation?.route && hasAdminNavigationIntent(payload.message)) {
    if (/payment|payout|finance|money|revenue|settlement/.test(query)) {
      reply = `Unit economics are averaging ${formatCurrency(yieldPerJob)} per job, pending payout exposure is ${formatCurrency(payload.systemContext?.pendingPayouts || 0)}, and seven-day revenue is ${formatCurrency(payload.systemContext?.sevenDayRevenue || 0)}. ${navigation.reason}`;
    } else {
      reply = navigation.reason;
    }
  } else if (/latency|slow|performance|api/.test(query)) {
    reply = `Latency is currently ${latencyMs} ms. ${latencyMs > 80 ? "That is elevated for the admin rail, so API Telemetry and the issue monitor are the first places I would check." : "That is within the normal operating band right now."} Database is ${database}, secure uploads are ${secureUploadsReady ? "ready" : "in fallback"}, and the cloud reasoning rail is ${llmMode}.`;
  } else if (/payment|payout|finance|money|revenue|settlement/.test(query)) {
    reply = `Unit economics are averaging ${formatCurrency(yieldPerJob)} per job, pending payout exposure is ${formatCurrency(payload.systemContext?.pendingPayouts || 0)}, and seven-day revenue is ${formatCurrency(payload.systemContext?.sevenDayRevenue || 0)}. ${highlights[0] ? `The strongest related signal is ${highlights[0]}.` : "I would open Finance and the issue monitor to confirm whether this is a settlement problem or just payout backlog."}`;
  } else if (/health|uptime|system|observability/.test(query)) {
    reply = `From the STRICT_PERSISTENCE rail, I count ${criticalBugCount} critical bugs currently active. System uptime is ${payload.systemContext?.globalUptime || "unknown"}, latency is ${latencyMs} ms, and the cloud engine is ${llmMode}. ${secureUploadsReady ? "Secure uploads are ready." : "Secure uploads are running in fallback."}`;
  } else if (/bug|error|failure|incident|audit|log/.test(query)) {
    reply = highlights.length > 0
      ? `The latest audit trail points to ${highlights[0]}${highlights[1] ? ` Next signal: ${highlights[1]}.` : ""}`
      : "I do not have a matching persisted incident signal in the current audit trail, so any root-cause answer here would be an inference from live context only.";
  } else {
    reply = "I can summarize system health, explain latency, inspect payout pressure, read recent audit events, or navigate anywhere inside the admin suite.";
  }

  return {
    reply,
    navigationTarget: navigation?.route || null,
    navigationReason: navigation?.reason || null,
    auditHighlights: highlights,
    confidence: highlights.length > 0 ? "high" : "medium",
  };
};

const callGroqAdminCopilot = async (payload, heuristicNavigation) => {
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
        temperature: 0.15,
        max_completion_tokens: DEFAULT_ADMIN_COPILOT_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ADMIN_COPILOT_SYSTEM_PROMPT },
          { role: "user", content: buildAdminCopilotPrompt(payload, heuristicNavigation) },
        ],
      }),
    });

    const { text } = await parseGroqResponse(response);
    recordProviderHealth("groq", "ready");
    return {
      copilot: finalizeAdminCopilot(extractJson(text), payload, heuristicNavigation),
      provider: "groq",
      model: groqModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Groq copilot error";
    recordProviderHealth("groq", classifyProviderStatus(status, message), message);
    throw error;
  }
};

const callGeminiAdminCopilot = async (payload, heuristicNavigation) => {
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
            parts: [{ text: ADMIN_COPILOT_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildAdminCopilotPrompt(payload, heuristicNavigation) }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            topP: 0.8,
            maxOutputTokens: DEFAULT_ADMIN_COPILOT_MAX_TOKENS,
            responseMimeType: "application/json",
            responseSchema: adminCopilotGeminiSchema,
          },
        }),
      },
    );

    const { text } = await parseGeminiResponse(response);
    recordProviderHealth("gemini", "ready");
    return {
      copilot: finalizeAdminCopilot(extractJson(text), payload, heuristicNavigation),
      provider: "gemini",
      model: geminiModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Gemini copilot error";
    recordProviderHealth("gemini", classifyProviderStatus(status, message), message);
    throw error;
  }
};

export const analyzeAdminCopilotWithLLM = async (input) => {
  const payload = AdminCopilotRequestSchema.parse(input);
  const heuristicNavigation = resolveAdminNavigation(payload.message, payload.systemContext, payload.currentRoute);
  const providers = payload.providerPreference === "gemini"
    ? [callGeminiAdminCopilot, callGroqAdminCopilot]
    : payload.providerPreference === "groq"
      ? [callGroqAdminCopilot, callGeminiAdminCopilot]
      : [callGroqAdminCopilot, callGeminiAdminCopilot];

  for (const provider of providers) {
    try {
      return await provider(payload, heuristicNavigation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown admin copilot error";
      const providerLabel = error instanceof ProviderRequestError ? `${error.provider}:${error.status}` : provider.name;
      console.warn("[admin-copilot]", providerLabel, message);
    }
  }

  return {
    copilot: buildAdminCopilotFallback(payload),
    provider: "rule_engine",
    model: "admin-copilot-fallback",
    rawText: null,
  };
};

const getSystemInsightsMaxTokens = () => DEFAULT_SYSTEM_INSIGHTS_MAX_TOKENS;

const buildSystemInsightsPrompt = (payload) => [
  "Analyze these RAHI platform metrics.",
  "Generate 5 short, high-impact strategy chips focused on:",
  "1. Local Ops",
  "2. Financial Sustainability",
  "3. Market Expansion",
  "4. Expansion Budget",
  "5. Revenue Potential",
  "Revenue Potential must mention Year-1 revenue, market share capture, payback, and the scalability multiplier.",
  payload.marketReadiness
    ? "This is a Punjab village micro-market. Benchmark the village against the Punjab state average and keep Expansion Posture explicitly on Micro-Market Entry."
    : "If the market is outside Agra, keep Expansion Posture in Shadow Launch (Freelancer-First).",
  "",
  "System Summary:",
  JSON.stringify(payload, null, 2),
  "",
  "Return JSON only.",
].join("\n");

const buildSystemInsightsFallback = (input) => {
  const payload = SystemInsightsRequestSchema.parse(input);
  const city = String(payload.marketMetrics?.city || "Agra");
  const zoneLabel = payload.marketMetrics?.zoneLabel || city;
  const density = Number(payload.marketMetrics?.density || 0.82);
  const surgeZone = payload.marketMetrics?.surgeZones?.[0] || zoneLabel;
  const yieldPerJob = Math.round(Number(payload.unitEconomics?.yieldPerJob || 0));
  const cacProjected = Math.round(Number(payload.unitEconomics?.cacProjected || 150));
  const paybackDays = Math.round(Number(payload.unitEconomics?.paybackDays || 18));
  const criticalBugs = Math.round(Number(payload.systemHealth?.criticalBugs || 0));
  const regionalEntryBudget = Math.round(Number(payload.unitEconomics?.regionalEntryBudget || 0));
  const projectedFirstYearRevenue = Math.round(Number(payload.unitEconomics?.projectedFirstYearRevenue || 0));
  const marketShareCapture = Math.max(
    1,
    Math.round(Number(payload.unitEconomics?.marketShareCapture || 12)),
  );
  const burnToScaleRatio = Number(payload.unitEconomics?.burnToScaleRatio || 0);
  const marketCapacity = Math.round(Number(payload.unitEconomics?.marketCapacity || 0));
  const launchMode = String(payload.unitEconomics?.launchMode || "Shadow Launch").trim();
  const marginExpansionPer100Workers = Number(
    payload.unitEconomics?.marginExpansionPer100Workers || 0,
  );
  const scalabilityNewWorkers = Math.max(
    1,
    Math.round(Number(payload.unitEconomics?.scalabilityNewWorkers || 100)),
  );
  const scalabilityDeltaProfit = Math.round(
    Number(payload.unitEconomics?.scalabilityDeltaProfit || 0),
  );
  const revenueLabel = projectedFirstYearRevenue > 0
    ? `INR ${projectedFirstYearRevenue.toLocaleString("en-IN")}`
    : "Revenue model pending";
  const budgetLabel = regionalEntryBudget > 0
    ? `INR ${regionalEntryBudget.toLocaleString("en-IN")}`
    : "Budget under review";
  const deltaProfitLabel = scalabilityDeltaProfit > 0
    ? `INR ${scalabilityDeltaProfit.toLocaleString("en-IN")}`
    : "INR 0";

  return {
    chips: [
      {
        id: "local_ops",
        title: "Local Ops",
        insight: density >= 1
          ? `Protect ${surgeZone} first and shift standby coverage into the densest active lane.`
          : `Keep ${surgeZone} under light-touch coverage until density hardens above 1.0.`,
      },
      {
        id: "financial_stability",
        title: "Financial Stability",
        insight: criticalBugs > 0
          ? `Hold yield near ₹${yieldPerJob} while ${criticalBugs} critical issues stay active and CAC remains near ₹${cacProjected}.`
          : `Yield is holding near ₹${yieldPerJob}; keep projected CAC near ₹${cacProjected} and payback at ${paybackDays} days.`,
      },
      {
        id: "expansion_posture",
        title: "Expansion Posture",
        insight: city.trim().toLowerCase() !== "agra"
          ? `Shadow Launch (Freelancer-First) | Projected CAC: ₹${cacProjected} | Payback: ${paybackDays} Days`
          : `Agra pilot first: protect the core and export the playbook only after payback stays inside ${paybackDays} days.`,
      },
      {
        id: "expansion_budget",
        title: "Expansion Budget",
        insight: city.trim().toLowerCase() !== "agra"
          ? `${launchMode} budget: ${budgetLabel} across ${marketCapacity} worker slots with burn-to-scale at ${burnToScaleRatio.toFixed(2)}x CAC.`
          : `Keep expansion reserve near ${budgetLabel} and release it only after Agra payback remains inside ${paybackDays} days.`,
      },
      {
        id: "revenue_potential",
        title: "Revenue Potential",
        insight: `${city}: ${revenueLabel} Year-1 revenue | ${marketShareCapture}% market capture | +${marginExpansionPer100Workers.toFixed(1)}% margin / ${scalabilityNewWorkers} workers | Delta Profit +${deltaProfitLabel}/mo | ${launchMode}`,
      },
    ],
  };
};

const finalizeSystemInsights = (raw, input) => {
  const parsed = SystemInsightsResponseSchema.parse(raw);
  const fallback = buildSystemInsightsFallback(input).chips;
  const chipMap = new Map(parsed.chips.map((chip) => [chip.id, chip]));
  const normalizedCity = String(input?.marketMetrics?.city || "Agra").trim().toLowerCase();

  return {
    chips: fallback.map((seed) => {
      const source = chipMap.get(seed.id);
      const title = normalizeOptionalText(source?.title) || seed.title;
      let insight = normalizeOptionalText(source?.insight) || seed.insight;

      if (
        seed.id === "expansion_posture"
        && normalizedCity !== "agra"
        && (
          !/shadow launch \(freelancer-first\)/i.test(insight)
          || !/projected cac:/i.test(insight)
          || !/payback window:/i.test(insight)
        )
      ) {
        insight = seed.insight;
      }

      return {
        id: seed.id,
        title,
        insight,
      };
    }),
  };
};

const callGroqSystemInsights = async (input) => {
  const payload = SystemInsightsRequestSchema.parse(input);
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
        temperature: 0.15,
        max_completion_tokens: getSystemInsightsMaxTokens(),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_INSIGHTS_SYSTEM_PROMPT },
          { role: "user", content: buildSystemInsightsPrompt(payload) },
        ],
      }),
    });

    const { text } = await parseGroqResponse(response);
    recordProviderHealth("groq", "ready");
    return {
      insights: finalizeSystemInsights(extractJson(text), payload),
      provider: "groq",
      model: groqModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Groq system insights error";
    recordProviderHealth("groq", classifyProviderStatus(status, message), message);
    throw error;
  }
};

const callGeminiSystemInsights = async (input) => {
  const payload = SystemInsightsRequestSchema.parse(input);
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
            parts: [{ text: SYSTEM_INSIGHTS_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildSystemInsightsPrompt(payload) }],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            topP: 0.8,
            maxOutputTokens: getSystemInsightsMaxTokens(),
            responseMimeType: "application/json",
            responseSchema: systemInsightsGeminiSchema,
          },
        }),
      },
    );

    const { text } = await parseGeminiResponse(response);
    recordProviderHealth("gemini", "ready");
    return {
      insights: finalizeSystemInsights(extractJson(text), payload),
      provider: "gemini",
      model: geminiModel,
      rawText: text,
    };
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Unknown Gemini system insights error";
    recordProviderHealth("gemini", classifyProviderStatus(status, message), message);
    throw error;
  }
};

export const analyzeSystemInsightsWithLLM = async (input) => {
  const payload = SystemInsightsRequestSchema.parse(input);
  const providers = payload.providerPreference === "gemini"
    ? [callGeminiSystemInsights, callGroqSystemInsights]
    : payload.providerPreference === "groq"
      ? [callGroqSystemInsights, callGeminiSystemInsights]
      : [callGroqSystemInsights, callGeminiSystemInsights];

  for (const provider of providers) {
    try {
      return await provider(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown system insights error";
      const providerLabel = error instanceof ProviderRequestError ? `${error.provider}:${error.status}` : provider.name;
      console.warn("[system-insights]", providerLabel, message);
    }
  }

  return {
    insights: buildSystemInsightsFallback(payload),
    provider: "rule_engine",
    model: "system-insights-fallback",
    rawText: null,
  };
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
