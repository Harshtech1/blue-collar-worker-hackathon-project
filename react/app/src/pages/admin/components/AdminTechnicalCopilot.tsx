import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageSquare,
  Radar,
  SendHorizontal,
  X,
} from "lucide-react";
import { API } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ADMIN_COPILOT_SEED_EVENT,
  type AdminCopilotSeedDetail,
} from "../adminCopilotEvents";
import type { AdminShellContextValue } from "../adminShellContext";
import { ADMIN_OBSERVABILITY_ISSUES, humanizeIssueCode, type ObservabilityIssue } from "../adminSignals";
import {
  ADMIN_ROUTE_PREFIX,
  buildMissionPath,
  buildObservabilityPath,
  buildWarRoomPath,
  getWarRoomLocationFromPath,
  resolveMarketContextFromLocation,
  resolveMarketLabel,
} from "../adminRoutes";
import { buildAgenticSystemSummary } from "../hooks/useAgenticInsights";
import {
  buildMarketGeoConfig,
  getDefaultCityForState,
  listMarketCities,
  listMarketStates,
} from "../marketRegistry";
import { buildSystemInsightsSummary } from "../utils/systemInsights";

const DEMO_ADMIN_TOKEN = "demo-admin-token";
const REQUEST_COOLDOWN_MS = 1200;
const PLUS_JAKARTA_FONT = "\"Plus Jakarta Sans\", \"Inter\", ui-sans-serif, system-ui, sans-serif";
const JETBRAINS_MONO_FONT = "\"JetBrains Mono\", \"Fira Code\", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

type CopilotResponse = {
  reply: string;
  navigationTarget: string | null;
  navigationReason: string | null;
  auditHighlights?: string[];
  confidence?: "high" | "medium" | "low";
};

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  auditHighlights?: string[];
  navigationTarget?: string | null;
};

const QUICK_ACTIONS = [
  "System Health?",
  "Jump to War Room",
  "Analyze Payouts",
];

const INITIAL_ASSISTANT_MESSAGE = "Technical Copilot is live. Ask about system health, payout pressure, critical bugs, or say \"Show me the money\" to jump into finance.";

const createMessageId = () => (
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const formatCurrency = (value: number) => `INR ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const formatCompactCurrency = (value: number) => {
  const normalizedValue = Math.round(Number(value || 0));
  if (normalizedValue >= 10000000) {
    return `INR ${(normalizedValue / 10000000).toFixed(1)}Cr`;
  }

  if (normalizedValue >= 100000) {
    return `INR ${(normalizedValue / 100000).toFixed(1)}L`;
  }

  if (normalizedValue >= 1000) {
    return `INR ${Math.round(normalizedValue / 1000)}K`;
  }

  return formatCurrency(normalizedValue);
};

const isAdminSafeRoute = (route: string | null | undefined) => (
  typeof route === "string" && route.startsWith(ADMIN_ROUTE_PREFIX)
);

const hasNavigationIntent = (message: string) => (
  /(?:go to|take me(?: to)?|open|show me|jump to|navigate(?: to)?|bring me(?: to)?|move to)/i.test(message)
);

const resolveLocalNavigation = (message: string, context: AdminShellContextValue) => {
  const normalized = message.toLowerCase();
  const currentZoneRoute = {
    route: buildWarRoomPath(context.selectedMarketLocation),
    label: context.zoneLabel || "War Room",
    reason: `Opening the war room for ${context.zoneLabel || "the active zone"}.`,
  };
  const explicitCity = listMarketCities().find((city) => (
    normalized.includes(city.label.toLowerCase()) || normalized.includes(city.slug.replace(/-/g, " "))
  ));
  if (
    explicitCity
    && (
      /map|war room|operations center|intelligence/.test(normalized)
      || (hasNavigationIntent(message) && !/finance|money|payment|payments|payout|payouts|revenue|cash/.test(normalized))
    )
  ) {
    return {
      route: buildWarRoomPath({ stateSlug: explicitCity.stateSlug, citySlug: explicitCity.slug }),
      label: `${explicitCity.label} War Room`,
      reason: `Opening ${explicitCity.label} War Room so the map centers on that market.`,
    };
  }

  const explicitState = listMarketStates().find((state) => (
    normalized.includes(state.label.toLowerCase()) || normalized.includes(state.slug.replace(/-/g, " "))
  ));
  if (
    explicitState
    && (
      /map|war room|operations center|intelligence|market/.test(normalized)
      || (hasNavigationIntent(message) && !/finance|money|payment|payments|payout|payouts|revenue|cash/.test(normalized))
    )
  ) {
    const defaultCity = getDefaultCityForState(explicitState.slug);
    if (!defaultCity) {
      return currentZoneRoute;
    }

    return {
      route: buildWarRoomPath({ stateSlug: explicitState.slug, citySlug: defaultCity.slug }),
      label: `${explicitState.label} Cluster`,
      reason: `Opening ${explicitState.label} through ${defaultCity.label}, the current focus city for that state cluster.`,
    };
  }

  if (/war room|operations center|map|intelligence/.test(normalized) && hasNavigationIntent(message)) {
    return currentZoneRoute;
  }

  if (!hasNavigationIntent(message)) {
    return null;
  }

  if (/finance|money|payment|payments|payout|payouts|revenue|cash/.test(normalized)) {
    return {
      route: buildMissionPath("finance"),
      label: "Finance",
      reason: "Opening finance so you can inspect payouts, revenue, and payment exposure.",
    };
  }

  if (/workforce|worker|workers|trust score|trust scores|booking|bookings|customer|customers|fleet/.test(normalized)) {
    return {
      route: buildMissionPath("workforce"),
      label: "Workforce",
      reason: "Opening workforce operations for worker, booking, and trust-score review.",
    };
  }

  if (/system health|observability|uptime|health|infra/.test(normalized)) {
    return {
      route: buildObservabilityPath("system-health"),
      label: "System Health",
      reason: "Opening system health for uptime, provider status, and deployment checks.",
    };
  }

  if (/bug|bugs|incident|error|failure|failures/.test(normalized)) {
    return {
      route: buildObservabilityPath("bug-monitor"),
      label: "Issue Monitor",
      reason: "Opening the issue monitor so the top incidents stay in view.",
    };
  }

  if (/latency|telemetry|api|performance/.test(normalized)) {
    return {
      route: buildObservabilityPath("api-telemetry"),
      label: "API Telemetry",
      reason: "Opening API telemetry for latency and performance signals.",
    };
  }

  if (/audit|logs|log|trail|strict persistence/.test(normalized)) {
    return {
      route: buildObservabilityPath("audit-logs"),
      label: "Audit Logs",
      reason: "Opening the verified audit trail and recent operating events.",
    };
  }

  if (/overview|dashboard|brief|summary/.test(normalized)) {
    return {
      route: buildMissionPath("overview"),
      label: "Overview",
      reason: "Opening the morning brief and executive snapshot.",
    };
  }

  return null;
};

const collectLocalHighlights = (message: string, context: AdminShellContextValue) => {
  const tokens = (message.toLowerCase().match(/[a-z0-9]+/g) || []).filter((token) => token.length > 2);
  const scoredEntries = [
    ...ADMIN_OBSERVABILITY_ISSUES.map((issue) => ({
      label: issue.domain,
      severity: issue.severity,
      content: `${issue.message} ${issue.impact} ${issue.recommendedAction}`.trim(),
    })),
    ...context.activities.slice(0, 8).map((activity) => ({
      label: activity.role || activity.type || "Ops",
      severity: "info" as const,
      content: `${activity.msg}${activity.time ? ` ${activity.time}` : ""}`.trim(),
    })),
  ].map((entry) => {
    const haystack = `${entry.label} ${entry.content}`.toLowerCase();
    const tokenScore = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    const severityBoost = entry.severity === "critical"
      ? 3
      : entry.severity === "watch"
        ? 2
        : 1;
    return {
      ...entry,
      score: tokenScore + severityBoost,
    };
  });

  return scoredEntries
    .filter((entry) => entry.score > 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => `[${entry.label.toUpperCase()}] ${entry.content}`);
};

const resolveRouteZoneOverride = (
  route: string,
  fallbackZoneId: string,
  fallbackLabel: string,
) => {
  const parsed = new URL(route, "https://rahi.local");
  const marketLocation = getWarRoomLocationFromPath(parsed.pathname);
  const districtSlug = parsed.searchParams.get("district");
  const marketContext = resolveMarketContextFromLocation(marketLocation.stateSlug, marketLocation.citySlug);
  const routeZoneId = marketContext.city.simulationCityId || marketContext.city.slug || fallbackZoneId;
  return {
    zoneId: routeZoneId,
    zoneLabel: resolveMarketLabel(marketLocation.stateSlug, marketLocation.citySlug, districtSlug) || fallbackLabel,
    selectedMarketLocation: {
      stateSlug: marketContext.state.slug,
      citySlug: marketContext.city.slug,
      districtSlug: districtSlug || null,
    },
    selectedStateSlug: marketContext.state.slug,
    selectedCitySlug: marketContext.city.slug,
    selectedDistrictId: districtSlug || null,
    selectedStateLabel: marketContext.state.label,
    selectedCityLabel: marketContext.city.label,
    selectedMarket: {
      state: marketContext.state,
      city: marketContext.city,
    },
  };
};

const buildCopilotSummary = (
  context: AdminShellContextValue,
  currentRoute: string,
  zoneOverride?: Partial<AdminShellContextValue> & { zoneId: string; zoneLabel: string },
) => {
  const effectiveZoneId = zoneOverride?.zoneId || context.routeZoneId;
  const effectiveZoneLabel = zoneOverride?.zoneLabel || context.zoneLabel;
  const geoConfig = buildMarketGeoConfig({
    market: zoneOverride?.selectedMarket?.city || context.selectedMarket.city,
    stateSlug: zoneOverride?.selectedStateSlug || context.selectedStateSlug,
    citySlug: zoneOverride?.selectedCitySlug || context.selectedCitySlug,
    districtSlug: zoneOverride?.selectedDistrictId ?? context.selectedDistrictId,
    radiusKm: effectiveZoneId === "agra" ? 10 : 14,
  });

  return buildAgenticSystemSummary(
    {
      ...context,
      routeZoneId: effectiveZoneId,
      zoneLabel: effectiveZoneLabel,
      selectedMarketLocation: zoneOverride?.selectedMarketLocation || context.selectedMarketLocation,
      selectedStateSlug: zoneOverride?.selectedStateSlug || context.selectedStateSlug,
      selectedCitySlug: zoneOverride?.selectedCitySlug || context.selectedCitySlug,
      selectedDistrictId: zoneOverride?.selectedDistrictId ?? context.selectedDistrictId,
      selectedStateLabel: zoneOverride?.selectedStateLabel || context.selectedStateLabel,
      selectedCityLabel: zoneOverride?.selectedCityLabel || context.selectedCityLabel,
      selectedMarket: zoneOverride?.selectedMarket || context.selectedMarket,
    },
    {
      geoConfig,
      currentRoute,
    },
  );
};

const explainIssuePlainly = (issue: ObservabilityIssue) => (
  `${humanizeIssueCode(issue.code)} is happening because ${issue.message} Plain English: ${issue.impact} Recommended move: ${issue.recommendedAction}`
);

const buildNavigationAnnouncement = (
  route: string,
  context: AdminShellContextValue,
  systemSummary: ReturnType<typeof buildSystemInsightsSummary>,
) => {
  if (route.startsWith(buildMissionPath("finance"))) {
    return `Welcome to the Ledger. Yield is ${formatCurrency(systemSummary.unitEconomics.yieldPerJob)} per job and pending payouts are ${formatCurrency(context.pendingPayouts)}.`;
  }

  if (route.includes("/war-room/")) {
    const targetZone = resolveRouteZoneOverride(route, context.routeZoneId, context.zoneLabel);
    const targetSystemSummary = buildSystemInsightsSummary({
      routeZoneId: targetZone.zoneId,
      zoneLabel: targetZone.zoneLabel,
      stateSlug: targetZone.selectedStateSlug,
      citySlug: targetZone.selectedCitySlug,
      districtSlug: targetZone.selectedDistrictId,
      stats: context.stats,
      activeWorkerRate: context.activeWorkerRate,
      averageTicket: context.averageTicket,
      globalUptime: context.globalUptime,
      llmMode: context.llmMode,
      healthSnapshot: context.healthSnapshot,
      investorSummary: context.investorSummary,
    });
    return `War Room is live for ${targetZone.zoneLabel}. Market density is ${targetSystemSummary.marketMetrics.density.toFixed(2)} and the strongest launch lane is ${targetSystemSummary.marketMetrics.recommendedExpansionCity}.`;
  }

  if (route.startsWith(buildObservabilityPath("system-health"))) {
    return `System Health is in view. ${systemSummary.systemHealth.criticalBugs} critical bugs are active and uptime is ${context.globalUptime}.`;
  }

  if (route.startsWith(buildObservabilityPath("bug-monitor"))) {
    return `Issue Monitor is in view. ${systemSummary.systemHealth.criticalBugs} critical bugs are active across the STRICT_PERSISTENCE rail.`;
  }

  return null;
};

const buildLocalCopilotResponse = (
  message: string,
  context: AdminShellContextValue,
  currentRoute: string,
): CopilotResponse => {
  const navigation = resolveLocalNavigation(message, context);
  const query = message.toLowerCase();
  const highlights = collectLocalHighlights(message, context);
  const hasUploadsReady = context.healthSnapshot?.media?.secureUploadsReady === true;
  const summary = buildCopilotSummary(context, currentRoute);
  const systemSummary = buildSystemInsightsSummary({
    routeZoneId: context.routeZoneId,
    zoneLabel: context.zoneLabel,
    stateSlug: context.selectedStateSlug,
    citySlug: context.selectedCitySlug,
    districtSlug: context.selectedDistrictId,
    stats: context.stats,
    activeWorkerRate: context.activeWorkerRate,
    averageTicket: context.averageTicket,
    globalUptime: context.globalUptime,
    llmMode: context.llmMode,
    healthSnapshot: context.healthSnapshot,
    investorSummary: context.investorSummary,
  });
  const paymentIssue = ADMIN_OBSERVABILITY_ISSUES.find((issue) => issue.code === "PAYMENT_FAILURE");
  const criticalBugCount = summary.systemHealth.criticalBugCount;

  if (navigation?.route && hasNavigationIntent(message)) {
    if (/payment|payout|finance|money|revenue|settlement/.test(query)) {
      return {
        reply: `Unit economics are averaging ${formatCurrency(summary.unitEconomics.yieldPerJob)} per job, pending payout exposure is ${formatCurrency(summary.pendingPayouts)}, and seven-day revenue is ${formatCurrency(summary.sevenDayRevenue)}. ${navigation.reason}`,
        navigationTarget: navigation.route,
        navigationReason: navigation.reason,
        auditHighlights: highlights,
        confidence: "high",
      };
    }

    if (/expansion|launch|shadow launch|brief|delhi|chandigarh|market entry/.test(query)) {
      const targetZone = resolveRouteZoneOverride(navigation.route, context.routeZoneId, context.zoneLabel);
      const targetSummary = buildCopilotSummary(context, navigation.route, targetZone);
      return {
        reply: `Opening ${targetSummary.currentCity}. Shadow Launch posture is recommended: freelancer-first, projected CAC ${formatCurrency(targetSummary.unitEconomics.cacProjected)}, payback ${targetSummary.unitEconomics.paybackDays} days, and modeled ROI ${targetSummary.marketContext.projectedRoi}%.`,
        navigationTarget: navigation.route,
        navigationReason: navigation.reason,
        auditHighlights: highlights,
        confidence: "high",
      };
    }

    return {
      reply: navigation.reason,
      navigationTarget: navigation.route,
      navigationReason: navigation.reason,
      auditHighlights: highlights,
      confidence: "high",
    };
  }

  if (/latency|slow|performance|api/.test(query)) {
    return {
      reply: `Latency is currently ${context.channelLatencyMs} ms. ${context.channelLatencyMs > 80 ? "That is elevated for the admin rail, so API telemetry and bug monitor are the first places I would inspect." : "That is within the current operating band."} Database is ${context.healthSnapshot?.database || "unknown"}, secure uploads are ${hasUploadsReady ? "ready" : "in fallback"}, and the cloud engine is ${context.llmMode}.`,
      navigationTarget: null,
      navigationReason: null,
      auditHighlights: highlights,
      confidence: "medium",
    };
  }

  if (/why did the payment fail|payment failure|gateway|settlement callback/.test(query) && paymentIssue) {
    return {
      reply: explainIssuePlainly(paymentIssue),
      navigationTarget: buildObservabilityPath("bug-monitor"),
      navigationReason: "Opening the highest-impact observability rail for payment recovery.",
      auditHighlights: highlights.length > 0 ? highlights : [`[PAYMENTS] ${paymentIssue.message}`],
      confidence: "high",
    };
  }

  if (/revenue potential|year[- ]?1 revenue|market share|burn-to-scale|scalability|margin multiplier|scale forecast/.test(query)) {
    const scalabilityNewWorkers = Math.round(systemSummary.unitEconomics.scalabilityNewWorkers || 100);
    const scalabilityDeltaProfit = Math.round(systemSummary.unitEconomics.scalabilityDeltaProfit || 0);
    const scalabilityDeltaProfitAnnualized = Math.round(systemSummary.unitEconomics.scalabilityDeltaProfitAnnualized || 0);
    return {
      reply: `In ${summary.currentCity}, RAHI projects ${formatCompactCurrency(systemSummary.unitEconomics.projectedFirstYearRevenue)} in Year-1 revenue with ${systemSummary.unitEconomics.marketShareCapture}% market capture and a ${systemSummary.unitEconomics.paybackDays}-day payback period. The scalability multiplier is Delta Profit = (New Workers x Efficiency Gain) x Current Margin. For the next ${scalabilityNewWorkers} workers, that adds about ${formatCompactCurrency(scalabilityDeltaProfit)} in monthly profit and ${formatCompactCurrency(scalabilityDeltaProfitAnnualized)} annualized while burn-to-scale stays at ${systemSummary.unitEconomics.burnToScaleRatio.toFixed(2)}x.`,
      navigationTarget: null,
      navigationReason: null,
      auditHighlights: highlights,
      confidence: "high",
    };
  }

  if (/payment|payout|finance|money|revenue|settlement/.test(query)) {
    return {
      reply: `Yield is ${formatCurrency(summary.unitEconomics.yieldPerJob)} per job, pending payouts are ${formatCurrency(summary.pendingPayouts)}, and seven-day revenue is ${formatCurrency(summary.sevenDayRevenue)}. ${highlights[0] ? `The strongest related signal is ${highlights[0]}.` : "I would inspect finance and issue monitor together to separate settlement failures from ordinary payout backlog."}`,
      navigationTarget: summary.financeRoute,
      navigationReason: "Opening finance to verify unit economics and payout pressure.",
      auditHighlights: highlights,
      confidence: highlights.length > 0 ? "high" : "medium",
    };
  }

  if (/health|uptime|system|observability/.test(query)) {
    return {
      reply: `From the STRICT_PERSISTENCE rail, I count ${criticalBugCount} critical bugs currently active. System uptime is ${context.globalUptime}, latency is ${context.channelLatencyMs} ms, and the cloud reasoning rail is ${context.llmMode}. ${hasUploadsReady ? "Secure uploads are ready." : "Secure uploads are currently in fallback."}`,
      navigationTarget: null,
      navigationReason: null,
      auditHighlights: highlights,
      confidence: "high",
    };
  }

  if (/shadow launch|market entry|expansion|new market|delhi|chandigarh/.test(query)) {
    return {
      reply: `${summary.currentCity} is in ${summary.marketContext.posture}. Projected CAC is ${formatCurrency(summary.unitEconomics.cacProjected)}, payback is ${summary.unitEconomics.paybackDays} days, and modeled ROI is ${summary.marketContext.projectedRoi}%.`,
      navigationTarget: summary.opsRoute,
      navigationReason: "Opening the war room for the active market-entry brief.",
      auditHighlights: highlights,
      confidence: "high",
    };
  }

  if (/bug|error|failure|failures|incident|audit|log/.test(query)) {
    return {
      reply: highlights.length > 0
        ? `The strongest audit signals I see are ${highlights[0]}${highlights[1] ? ` and ${highlights[1]}.` : "."}`
        : "I do not have a matching persisted signal in local demo mode, so any root-cause answer here would be an inference from the visible admin context only.",
      navigationTarget: null,
      navigationReason: null,
      auditHighlights: highlights,
      confidence: highlights.length > 0 ? "high" : "low",
    };
  }

  return {
    reply: "I can summarize system health, explain latency, inspect payout pressure, read recent audit signals, or navigate anywhere inside the admin suite.",
    navigationTarget: null,
    navigationReason: null,
    auditHighlights: highlights,
    confidence: "medium",
  };
};

const buildCopilotPayload = (
  message: string,
  context: AdminShellContextValue,
  currentRoute: string,
  strategySummary: ReturnType<typeof buildCopilotSummary>,
  systemSummary: ReturnType<typeof buildSystemInsightsSummary>,
) => ({
  message,
  currentRoute,
  systemSummary,
  systemContext: {
    currentMission: context.currentMission,
    currentObservabilityPanel: context.currentObservabilityPanel,
    currentZoneId: context.routeZoneId,
    zoneLabel: context.zoneLabel,
    globalUptime: context.globalUptime,
    latencyMs: context.channelLatencyMs,
    llmMode: context.llmMode,
    llmSummary: context.llmSummary,
    marketMetrics: systemSummary.marketMetrics,
    yieldPerJob: systemSummary.unitEconomics.yieldPerJob,
    criticalBugCount: systemSummary.systemHealth.criticalBugs,
    activeWorkerRate: context.activeWorkerRate,
    activeBugs: strategySummary.systemHealth.criticalBugCount,
    pendingPayouts: context.pendingPayouts,
    averageTicket: context.averageTicket,
    sevenDayBookings: context.sevenDayBookings,
    sevenDayRevenue: context.sevenDayRevenue,
    healthSnapshot: context.healthSnapshot,
  },
  issues: ADMIN_OBSERVABILITY_ISSUES,
  auditTrail: context.activities.slice(0, 8).map((activity) => ({
    source: activity.role || activity.type || "ops",
    severity: activity.type === "booking" ? "watch" : "info",
    message: activity.msg,
    time: activity.time,
  })),
});

export function AdminTechnicalCopilot({
  shellContext,
  showLauncher = true,
}: {
  shellContext: AdminShellContextValue;
  showLauncher?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastRequestAtRef = useRef(0);
  const lastAutoBriefRef = useRef("");
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inlineNote, setInlineNote] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: createMessageId(),
      role: "assistant",
      content: INITIAL_ASSISTANT_MESSAGE,
    },
  ]);
  const systemSummary = useMemo(() => buildSystemInsightsSummary({
    routeZoneId: shellContext.routeZoneId,
    zoneLabel: shellContext.zoneLabel,
    stateSlug: shellContext.selectedStateSlug,
    citySlug: shellContext.selectedCitySlug,
    districtSlug: shellContext.selectedDistrictId,
    stats: shellContext.stats,
    activeWorkerRate: shellContext.activeWorkerRate,
    averageTicket: shellContext.averageTicket,
    globalUptime: shellContext.globalUptime,
    llmMode: shellContext.llmMode,
    healthSnapshot: shellContext.healthSnapshot,
    investorSummary: shellContext.investorSummary,
  }), [
    shellContext.routeZoneId,
    shellContext.zoneLabel,
    shellContext.selectedStateSlug,
    shellContext.selectedCitySlug,
    shellContext.selectedDistrictId,
    shellContext.stats,
    shellContext.activeWorkerRate,
    shellContext.averageTicket,
    shellContext.globalUptime,
    shellContext.llmMode,
    shellContext.healthSnapshot,
    shellContext.investorSummary,
  ]);
  const strategySummary = useMemo(() => (
    buildCopilotSummary(shellContext, location.pathname)
  ), [shellContext, location.pathname]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (strategySummary.marketContext.isExistingMarket) {
      return;
    }

    const briefKey = `${strategySummary.zoneId}:${strategySummary.currentCity}`;
    if (lastAutoBriefRef.current === briefKey) {
      return;
    }

    lastAutoBriefRef.current = briefKey;
    setMessages((current) => {
      if (current.some((message) => message.content.includes(`Initiate Shadow Launch sequence for ${strategySummary.currentCity}`))) {
        return current;
      }

      return [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: `Initiate Shadow Launch sequence for ${strategySummary.currentCity}? Projected CAC ${formatCurrency(strategySummary.unitEconomics.cacProjected)} | Payback ${strategySummary.unitEconomics.paybackDays} days | ROI ${strategySummary.marketContext.projectedRoi}%. Freelancer-first posture protects burn while density validates.`,
          navigationTarget: strategySummary.opsRoute,
          auditHighlights: [
            `[EXPANSION] ${strategySummary.currentCity} is in ${strategySummary.marketContext.posture}.`,
          ],
        },
      ];
    });
    setInlineNote("Market Entry Brief ready.");
  }, [strategySummary]);

  const appendMessage = (message: CopilotMessage) => {
    setMessages((current) => [...current, message]);
  };

  const requestCopilot = useCallback(async (message: string): Promise<CopilotResponse> => {
    const token = localStorage.getItem("adminToken");
    const isDemoMode = localStorage.getItem("adminDemoMode") === "true"
      || !token
      || token === DEMO_ADMIN_TOKEN;

    if (isDemoMode) {
      return buildLocalCopilotResponse(message, shellContext, location.pathname);
    }

    const response = await fetch(`${API}/admin/copilot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify(buildCopilotPayload(message, shellContext, location.pathname, strategySummary, systemSummary)),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || "Admin copilot request failed");
    }

    return response.json();
  }, [location.pathname, shellContext, strategySummary, systemSummary]);

  const handleSend = useCallback(async (nextMessage?: string) => {
    const message = (nextMessage ?? input).trim();
    if (!message || isLoading) return;

    const now = Date.now();
    if ((now - lastRequestAtRef.current) < REQUEST_COOLDOWN_MS) {
      setInlineNote("Technical Copilot is cooling down for a second to protect the cloud reasoning rail.");
      return;
    }

    lastRequestAtRef.current = now;
    setInlineNote("");
    setInput("");
    appendMessage({
      id: createMessageId(),
      role: "user",
      content: message,
    });
    setIsLoading(true);

    try {
      const result = await requestCopilot(message);
      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: result.reply,
        auditHighlights: result.auditHighlights,
        navigationTarget: result.navigationTarget,
      });

      const resultNavigationTarget = result.navigationTarget;
      if (resultNavigationTarget && isAdminSafeRoute(resultNavigationTarget) && resultNavigationTarget !== location.pathname) {
        navigate(resultNavigationTarget);
        const announcement = buildNavigationAnnouncement(resultNavigationTarget, shellContext, systemSummary);
        if (announcement) {
          window.setTimeout(() => {
            appendMessage({
              id: createMessageId(),
              role: "assistant",
              content: announcement,
            });
          }, 160);
        }
      }
    } catch (error) {
      const fallback = buildLocalCopilotResponse(message, shellContext, location.pathname);
      appendMessage({
        id: createMessageId(),
        role: "assistant",
        content: fallback.reply,
        auditHighlights: fallback.auditHighlights,
        navigationTarget: fallback.navigationTarget,
      });
      setInlineNote(error instanceof Error ? error.message : "Technical Copilot fell back to the local reasoning lane.");

      const fallbackNavigationTarget = fallback.navigationTarget;
      if (fallbackNavigationTarget && isAdminSafeRoute(fallbackNavigationTarget) && fallbackNavigationTarget !== location.pathname) {
        navigate(fallbackNavigationTarget);
        const announcement = buildNavigationAnnouncement(fallbackNavigationTarget, shellContext, systemSummary);
        if (announcement) {
          window.setTimeout(() => {
            appendMessage({
              id: createMessageId(),
              role: "assistant",
              content: announcement,
            });
          }, 160);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, location.pathname, navigate, requestCopilot, shellContext, systemSummary]);

  useEffect(() => {
    const handleSeed = (event: Event) => {
      const detail = (event as CustomEvent<AdminCopilotSeedDetail>).detail;
      if (!detail?.prompt) return;

      setIsOpen(true);
      setInlineNote(detail.sourceLabel ? `${detail.sourceLabel} queued in Technical Copilot.` : "Preparing guided prompt...");
      setInput(detail.prompt);

      if (detail.mode === "draft") {
        return;
      }

      window.setTimeout(() => {
        void handleSend(detail.prompt);
      }, 120);
    };

    window.addEventListener(ADMIN_COPILOT_SEED_EVENT, handleSeed);
    return () => window.removeEventListener(ADMIN_COPILOT_SEED_EVENT, handleSeed);
  }, [handleSend]);

  const showQuickActions = messages.length <= 1;

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-5 z-[60] flex items-end justify-end lg:bottom-6"
      style={{ fontFamily: PLUS_JAKARTA_FONT }}
    >
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {isOpen ? (
          <section className="w-[min(350px,calc(100vw-1.5rem))] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_-34px_rgba(15,23,42,0.32)]">
            <header className="bg-[#0F172A] px-4 py-3 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12 text-white">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Engine Room
                      </p>
                      <h3 className="truncate text-sm font-semibold text-white">
                        RAHI Technical Copilot
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    Live
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/16"
                    aria-label="Close Technical Copilot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>

            <div className="border-x border-slate-200 bg-white">
              <div
                ref={scrollContainerRef}
                className="flex h-[420px] flex-col gap-3 overflow-y-auto px-4 py-4"
              >
                {showQuickActions ? (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => void handleSend(action)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-[22px] border px-3.5 py-3 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.28)]",
                        message.role === "user"
                          ? "rounded-br-md border-[#0F172A] bg-[#0F172A] text-white"
                          : "rounded-bl-md border-slate-200 bg-white text-slate-800",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </p>

                      {message.auditHighlights && message.auditHighlights.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {message.auditHighlights.map((highlight) => (
                            <div
                              key={`${message.id}-${highlight}`}
                              className={cn(
                                "rounded-2xl border px-3 py-2 text-[11px] leading-5",
                                message.role === "user"
                                  ? "border-white/16 bg-white/8 text-slate-100"
                                  : "border-slate-200 bg-slate-50 text-slate-600",
                              )}
                              style={{ fontFamily: JETBRAINS_MONO_FONT }}
                            >
                              {highlight}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {isAdminSafeRoute(message.navigationTarget) ? (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          <Radar className="h-3.5 w-3.5 text-[#0F172A]" />
                          MapsTo {message.navigationTarget}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {isLoading ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                      Interpreting system state...
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="border border-slate-200 border-t-slate-200 bg-white px-4 py-3">
              <div className="flex items-end gap-2 rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => {
                    setInlineNote("");
                    setInput(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask about health, logs, or say &quot;Show me the money&quot;"
                  className="min-h-10 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0F172A] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send Technical Copilot message"
                >
                  <SendHorizontal className="h-4.5 w-4.5" />
                </button>
              </div>
              {inlineNote ? (
                <p className="mt-2 text-[11px] font-medium text-slate-500">
                  {inlineNote}
                </p>
              ) : null}
            </footer>
          </section>
        ) : null}

        {showLauncher ? (
          <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="group inline-flex items-center gap-3 rounded-full border border-white/50 bg-white/88 px-4 py-3 text-left shadow-[0_20px_48px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_56px_-28px_rgba(15,23,42,0.45)]"
          aria-label="Open Technical Copilot"
        >
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0F172A_0%,#1E293B_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md transition group-hover:bg-emerald-400/30" />
              <MessageSquare className="relative h-5 w-5" />
            </span>

          <span className="hidden min-w-0 sm:block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Technical Copilot
            </span>
              <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900">
                Ask or navigate
                <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
