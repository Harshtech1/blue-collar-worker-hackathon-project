import {
  buildMarketBreadcrumb,
  getDefaultMarketLocation,
  resolveMarketLocation,
  resolveLegacyMarketTarget,
  resolveMarketContext,
  resolveMarketLabel as resolveLabelFromRegistry,
  type MarketLocation,
} from "./marketRegistry";

export const ADMIN_ROUTE_PREFIX = "/admin-portal-2026";
export const DEFAULT_WAR_ROOM_MARKET = getDefaultMarketLocation();
export const DEFAULT_WAR_ROOM_ZONE = DEFAULT_WAR_ROOM_MARKET.citySlug;

export type AdminTab =
  | "overview"
  | "users"
  | "workers"
  | "bookings"
  | "finance"
  | "heatmap"
  | "intelligence"
  | "system"
  | "bugs"
  | "audit"
  | "settings";

export type AdminMission =
  | "overview"
  | "war-room"
  | "workforce"
  | "finance"
  | "observability"
  | "settings";

export type AdminObservabilityPanel =
  | "system-health"
  | "bug-monitor"
  | "api-telemetry"
  | "audit-logs";

export type AdminToolAction = AdminObservabilityPanel | "settings";

export const ADMIN_MISSION_LABELS: Record<AdminMission, string> = {
  overview: "Overview",
  "war-room": "Operations Center",
  workforce: "Workforce",
  finance: "Finance",
  observability: "System Health",
  settings: "Settings",
};

export const OBSERVABILITY_PANEL_LABELS: Record<AdminObservabilityPanel, string> = {
  "system-health": "System Health",
  "bug-monitor": "Issue Monitor",
  "api-telemetry": "API Performance",
  "audit-logs": "Verified Audit Trail",
};

const getAdminSegments = (pathname: string) => {
  const trimmed = pathname.startsWith(ADMIN_ROUTE_PREFIX)
    ? pathname.slice(ADMIN_ROUTE_PREFIX.length)
    : pathname;

  return trimmed.split("/").filter(Boolean);
};

const normalizeMarketLocation = (
  location?: Partial<MarketLocation> | null,
): MarketLocation => {
  if (!location) return resolveMarketLocation(
    DEFAULT_WAR_ROOM_MARKET.stateSlug,
    DEFAULT_WAR_ROOM_MARKET.citySlug,
    DEFAULT_WAR_ROOM_MARKET.districtSlug,
  );

  return resolveMarketLocation(location.stateSlug, location.citySlug, location.districtSlug);
};

export const resolveObservabilityPanel = (value?: string | null): AdminObservabilityPanel => {
  switch (value) {
    case "bug-monitor":
    case "api-telemetry":
    case "audit-logs":
      return value;
    case "system-health":
    default:
      return "system-health";
  }
};

export const getMissionFromPath = (pathname: string): AdminMission => {
  const [firstSegment] = getAdminSegments(pathname);

  switch (firstSegment) {
    case undefined:
    case "overview":
      return "overview";
    case "war-room":
    case "intelligence":
    case "heatmap":
      return "war-room";
    case "workforce":
    case "users":
    case "workers":
    case "bookings":
      return "workforce";
    case "finance":
      return "finance";
    case "observability":
    case "system":
    case "bugs":
    case "audit":
      return "observability";
    case "settings":
      return "settings";
    default:
      return "overview";
  }
};

export const getWarRoomLocationFromPath = (pathname: string): MarketLocation => {
  const [firstSegment, secondSegment, thirdSegment, fourthSegment] = getAdminSegments(pathname);

  if (firstSegment === "war-room" || firstSegment === "intelligence") {
    if (secondSegment && thirdSegment) {
      return normalizeMarketLocation({
        stateSlug: decodeURIComponent(secondSegment),
        citySlug: decodeURIComponent(thirdSegment),
        districtSlug: fourthSegment ? decodeURIComponent(fourthSegment) : null,
      });
    }

    const legacy = resolveLegacyMarketTarget(secondSegment ? decodeURIComponent(secondSegment) : null);
    if (legacy) {
      return normalizeMarketLocation(legacy);
    }
  }

  return { ...DEFAULT_WAR_ROOM_MARKET };
};

export const getWarRoomDistrictFromPath = (pathname: string) => {
  return getWarRoomLocationFromPath(pathname).districtSlug || null;
};

export const getWarRoomZoneIdFromPath = (pathname: string) => (
  getWarRoomLocationFromPath(pathname).citySlug
);

export const getObservabilityPanelFromPath = (pathname: string) => {
  const [firstSegment, secondSegment] = getAdminSegments(pathname);

  if (firstSegment === "bugs") return "bug-monitor";
  if (firstSegment === "system") return "system-health";
  if (firstSegment === "audit") return "audit-logs";
  if (firstSegment === "observability") return resolveObservabilityPanel(secondSegment);

  return "system-health";
};

export const resolveMarketContextFromLocation = (
  stateSlug?: string | null,
  citySlug?: string | null,
  districtSlug?: string | null,
) => resolveMarketContext(stateSlug, citySlug, districtSlug);

export const resolveMarketLabel = (
  cityOrStateSlug?: string | null,
  citySlugOrDistrictSlug?: string | null,
  districtSlug?: string | null,
) => {
  if (districtSlug !== undefined) {
    return resolveLabelFromRegistry(cityOrStateSlug, citySlugOrDistrictSlug, districtSlug);
  }

  if (citySlugOrDistrictSlug) {
    return resolveLabelFromRegistry(cityOrStateSlug, citySlugOrDistrictSlug, null);
  }

  const legacy = resolveLegacyMarketTarget(cityOrStateSlug);
  if (legacy) {
    return resolveLabelFromRegistry(legacy.stateSlug, legacy.citySlug, legacy.districtSlug);
  }

  return resolveLabelFromRegistry(DEFAULT_WAR_ROOM_MARKET.stateSlug, DEFAULT_WAR_ROOM_MARKET.citySlug, null);
};

export const buildWarRoomPath = (
  stateOrLocation: string | MarketLocation = DEFAULT_WAR_ROOM_MARKET,
  citySlug?: string | null,
  districtSlug?: string | null,
) => {
  const location = (() => {
    if (typeof stateOrLocation === "object") {
      return normalizeMarketLocation(stateOrLocation);
    }

    if (citySlug) {
      return normalizeMarketLocation({
        stateSlug: stateOrLocation,
        citySlug,
        districtSlug: districtSlug || null,
      });
    }

    const legacy = resolveLegacyMarketTarget(stateOrLocation);
    if (legacy) {
      return normalizeMarketLocation(legacy);
    }

    return { ...DEFAULT_WAR_ROOM_MARKET };
  })();

  const districtSegment = location.districtSlug
    ? `/${encodeURIComponent(location.districtSlug)}`
    : "";

  return `${ADMIN_ROUTE_PREFIX}/war-room/${encodeURIComponent(location.stateSlug)}/${encodeURIComponent(location.citySlug)}${districtSegment}`;
};

export const buildIntelligencePath = (
  stateOrLocation: string | MarketLocation = DEFAULT_WAR_ROOM_MARKET,
  citySlug?: string | null,
) => buildWarRoomPath(
  typeof stateOrLocation === "object"
    ? stateOrLocation
    : citySlug
      ? { stateSlug: stateOrLocation, citySlug }
      : resolveLegacyMarketTarget(stateOrLocation) || DEFAULT_WAR_ROOM_MARKET,
).replace("/war-room/", "/intelligence/");

export const buildObservabilityPath = (
  panel: AdminObservabilityPanel = "system-health",
) => `${ADMIN_ROUTE_PREFIX}/observability/${panel}`;

export const buildMissionPath = (
  mission: AdminMission,
  options: {
    zoneId?: string;
    market?: Partial<MarketLocation>;
    panel?: AdminObservabilityPanel;
  } = {},
) => {
  const location = options.market || (options.zoneId ? resolveLegacyMarketTarget(options.zoneId) : null) || DEFAULT_WAR_ROOM_MARKET;

  switch (mission) {
    case "overview":
      return `${ADMIN_ROUTE_PREFIX}/overview`;
    case "war-room":
      return buildWarRoomPath(location as MarketLocation);
    case "workforce":
      return `${ADMIN_ROUTE_PREFIX}/workforce`;
    case "finance":
      return `${ADMIN_ROUTE_PREFIX}/finance`;
    case "observability":
      return buildObservabilityPath(options.panel || "system-health");
    case "settings":
      return `${ADMIN_ROUTE_PREFIX}/settings`;
    default:
      return `${ADMIN_ROUTE_PREFIX}/overview`;
  }
};

export const buildPathForTool = (tool: AdminToolAction) => {
  if (tool === "settings") {
    return buildMissionPath("settings");
  }

  return buildObservabilityPath(tool);
};

export const buildPathForTab = (
  tab: AdminTab,
  currentZoneIdOrLocation: string | MarketLocation = DEFAULT_WAR_ROOM_MARKET,
) => {
  const market = typeof currentZoneIdOrLocation === "string"
    ? resolveLegacyMarketTarget(currentZoneIdOrLocation) || DEFAULT_WAR_ROOM_MARKET
    : currentZoneIdOrLocation;

  switch (tab) {
    case "overview":
      return buildMissionPath("overview");
    case "users":
    case "workers":
    case "bookings":
      return buildMissionPath("workforce");
    case "finance":
      return buildMissionPath("finance");
    case "heatmap":
    case "intelligence":
      return buildWarRoomPath(market);
    case "system":
      return buildObservabilityPath("system-health");
    case "bugs":
      return buildObservabilityPath("bug-monitor");
    case "audit":
      return buildObservabilityPath("audit-logs");
    case "settings":
      return buildMissionPath("settings");
    default:
      return buildMissionPath("overview");
  }
};

export const buildMarketBreadcrumbLabel = (
  location: Partial<MarketLocation> = DEFAULT_WAR_ROOM_MARKET,
) => buildMarketBreadcrumb(location.stateSlug, location.citySlug, location.districtSlug);
