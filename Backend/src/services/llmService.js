import { z } from "zod";

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

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-pro";

const StrategyPayloadSchema = z.object({
  analysisMode: z.enum(["strategy_brief", "financial_audit", "investor_summary"]).optional().default("strategy_brief"),
  routePath: z.string().optional().default("/admin-portal-2026/intelligence"),
  zoneId: z.string().optional().default("unknown-zone"),
  zoneLabel: z.string().optional().default("Unknown Zone"),
  city: z.string().optional().default("Unknown City"),
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
    })).optional().default([]),
  }).optional().default({}),
  deepDive: z.boolean().optional().default(false),
  providerPreference: z.enum(["groq", "gemini"]).optional(),
});

const StrategyResponseSchema = z.object({
  signal: z.string().min(1),
  reasoning: z.string().min(1),
  procedures: z.array(z.string().min(1)).min(1),
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
  },
  required: ["signal", "reasoning", "procedures"],
  additionalProperties: false,
};

const geminiStrategySchema = {
  type: "OBJECT",
  properties: {
    signal: { type: "STRING" },
    reasoning: { type: "STRING" },
    procedures: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["signal", "reasoning", "procedures"],
  propertyOrdering: ["signal", "reasoning", "procedures"],
};

const formatCurrency = (value) => `INR ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

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

const normalizeProcedures = (procedures, payload) => {
  const defaults = buildFallbackStrategy(payload).procedures;
  const safe = Array.isArray(procedures) ? procedures.filter(Boolean).map((item) => String(item).trim()) : [];
  return [...safe, ...defaults].slice(0, 3);
};

const buildPrompt = (payload) => {
  const topGap = pickTopForecastGap(payload.forecast);
  const worstBurnZone = pickWorstBurnZone(payload.zoneEconomics);
  const modeInstruction = payload.analysisMode === "investor_summary"
    ? "You are generating an investor slide summary. Procedures must be exactly 3 short bullets prefixed with 'Scalability Proof:', 'Density Optimization Result:', and 'Profitability Path:'."
    : payload.analysisMode === "financial_audit"
      ? "You are running a unit-economics audit. Focus on CAC vs LTV, contribution margin, daily burn, and the correct salaried-to-freelancer mix."
      : "You are generating an operating brief for the command center.";

  return [
    "Analyze this RAHI zone and return JSON only.",
    modeInstruction,
    payload.userQuestion ? `CEO Question: ${payload.userQuestion}` : "CEO Question: none",
    "",
    "Zone Context:",
    JSON.stringify({
      analysisMode: payload.analysisMode,
      routePath: payload.routePath,
      zoneId: payload.zoneId,
      zoneLabel: payload.zoneLabel,
      city: payload.city,
      radiusKm: payload.radiusKm,
      timeLens: payload.timeLens,
    }, null, 2),
    "",
    "Operational Signals:",
    JSON.stringify({
      densityScore: payload.densityScore,
      predictedDemand: payload.predictedDemand,
      currentOrders: payload.currentOrders,
      currentWorkers: payload.currentWorkers,
      emergencyOrders: payload.emergencyOrders,
      allocationStrategy: payload.allocationStrategy,
      priceMultiplier: payload.priceMultiplier,
      pricingSignal: payload.pricingSignal,
      serviceWarning: payload.serviceWarning,
      hottestForecastGap: topGap,
      worstBurnZone,
    }, null, 2),
    "",
    "Audit & Financial Signals:",
    JSON.stringify({
      auditData: payload.auditData,
      financials: payload.financials,
      zoneEconomics: payload.zoneEconomics,
      logicSignals: payload.logicSignals,
      simulationSummary: payload.simulationSummary,
    }, null, 2),
    "",
    "Return JSON with keys signal, reasoning, procedures. Procedures must contain exactly 3 strings.",
  ].join("\n");
};

const extractJson = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("LLM returned an empty response");

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("LLM response did not contain JSON");
    }
    return JSON.parse(match[0]);
  }
};

const finalizeStrategy = (raw, payload) => {
  const parsed = StrategyResponseSchema.parse(raw);
  return {
    signal: parsed.signal.trim(),
    reasoning: parsed.reasoning.trim(),
    procedures: normalizeProcedures(parsed.procedures, payload),
  };
};

const parseGroqResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Groq request failed with ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content || "";
  return {
    text,
    raw: data,
  };
};

const parseGeminiResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim() || "";
  return {
    text,
    raw: data,
  };
};

const callGroqStrategy = async (payload) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STRATEGY_AGENT_SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(payload) },
      ],
    }),
  });

  const { text } = await parseGroqResponse(response);
  return {
    strategy: finalizeStrategy(extractJson(text), payload),
    provider: "groq",
    model: GROQ_MODEL,
    rawText: text,
  };
};

const callGeminiStrategy = async (payload) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
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
          response_mime_type: "application/json",
          response_schema: geminiStrategySchema,
        },
      }),
    },
  );

  const { text } = await parseGeminiResponse(response);
  return {
    strategy: finalizeStrategy(extractJson(text), payload),
    provider: "gemini",
    model: GEMINI_MODEL,
    rawText: text,
  };
};

export const buildFallbackStrategy = (input) => {
  const payload = StrategyPayloadSchema.parse(input);
  const densityBand = getDensityBand(payload.densityScore);
  const topGap = pickTopForecastGap(payload.forecast);
  const hottestSector = payload.simulationSummary?.hottestSector || payload.zoneLabel;
  const marginLift = Number(payload.financials?.marginLift || payload.simulationSummary?.marginLift || 0);
  const worstBurnZone = pickWorstBurnZone(payload.zoneEconomics);
  const overallBurn = Number(payload.zoneEconomics?.reduce((sum, zone) => sum + Number(zone.dailyBurn || 0), 0) || 0);
  const topUnitEconomics = payload.zoneEconomics?.[0];

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
  const preferred = payload.providerPreference
    || (payload.deepDive ? "gemini" : "groq");

  const providers = preferred === "gemini"
    ? [callGeminiStrategy, callGroqStrategy]
    : [callGroqStrategy, callGeminiStrategy];

  for (const provider of providers) {
    try {
      return await provider(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error";
      console.warn("[strategy-llm]", message);
    }
  }

  return {
    strategy: buildFallbackStrategy(payload),
    provider: "rule_engine",
    model: "density-rule-fallback",
    rawText: null,
  };
};

export const hasStrategyProviderConfigured = () => Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
