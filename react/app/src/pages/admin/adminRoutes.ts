import { GLOBAL_SIMULATION_CITIES, sectorSeeds } from "@/utils/simulationData";

export const ADMIN_ROUTE_PREFIX = "/admin-portal-2026";
export const DEFAULT_WAR_ROOM_ZONE = "agra-cantt";

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
  "war-room": "Location Center",
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

export const getWarRoomZoneIdFromPath = (pathname: string) => {
  const [firstSegment, secondSegment] = getAdminSegments(pathname);

  if (firstSegment === "war-room" || firstSegment === "intelligence") {
    return secondSegment || DEFAULT_WAR_ROOM_ZONE;
  }

  return DEFAULT_WAR_ROOM_ZONE;
};

export const getObservabilityPanelFromPath = (pathname: string) => {
  const [firstSegment, secondSegment] = getAdminSegments(pathname);

  if (firstSegment === "bugs") return "bug-monitor";
  if (firstSegment === "system") return "system-health";
  if (firstSegment === "audit") return "audit-logs";
  if (firstSegment === "observability") return resolveObservabilityPanel(secondSegment);

  return "system-health";
};

export const resolveMarketLabel = (zoneId?: string | null) => {
  if (!zoneId) return "Agra Cantt";

  const sector = sectorSeeds.find((entry) => entry.id === zoneId);
  if (sector) return sector.label;

  const city = GLOBAL_SIMULATION_CITIES.find((entry) => entry.id === zoneId);
  if (city) return city.stateCode ? `${city.label}, ${city.stateCode}` : city.label;

  return zoneId
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const buildWarRoomPath = (zoneId = DEFAULT_WAR_ROOM_ZONE) => (
  `${ADMIN_ROUTE_PREFIX}/war-room/${encodeURIComponent(zoneId)}`
);

export const buildObservabilityPath = (
  panel: AdminObservabilityPanel = "system-health",
) => `${ADMIN_ROUTE_PREFIX}/observability/${panel}`;

export const buildMissionPath = (
  mission: AdminMission,
  options: {
    zoneId?: string;
    panel?: AdminObservabilityPanel;
  } = {},
) => {
  switch (mission) {
    case "overview":
      return `${ADMIN_ROUTE_PREFIX}/overview`;
    case "war-room":
      return buildWarRoomPath(options.zoneId || DEFAULT_WAR_ROOM_ZONE);
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
  currentZoneId = DEFAULT_WAR_ROOM_ZONE,
) => {
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
      return buildWarRoomPath(currentZoneId);
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
