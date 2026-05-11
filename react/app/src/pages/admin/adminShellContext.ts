import { useOutletContext } from "react-router-dom";
import type {
  AdminMission,
  AdminObservabilityPanel,
  AdminTab,
  AdminToolAction,
} from "./adminRoutes";
import type { MarketCity, MarketDistrict, MarketLocation, MarketState } from "./marketRegistry";
import type {
  AdminCompetitorHotspot,
  AdminMapOverlays,
} from "./utils/marketDefense";
import type {
  AdminMarketCityOption,
  AdminMarketSnapshot,
  AdminRegionOption,
} from "./utils/adminMarketSnapshot";

export interface AdminBooking {
  _id: string;
  service?: string;
  customer?: string;
  total_price?: number | string;
  commission?: number | string;
  platform_fee?: number | string;
  insurance_fee?: number | string;
  worker_earning?: number | string;
  status?: "pending" | "matched" | "in_progress" | "completed";
  createdAt?: string | Date;
  date?: string | Date;
}

export interface AdminUnitEconomicsSummary {
  avgTicket: number;
  commissionPerJob: number;
  marketingCacPerJob: number;
  incentivesPerJob: number;
  netProfitPerJob: number;
  totalCommission: number;
  source: string;
}

export interface AdminInvestorAnalyticsSummary {
  totalBookings?: number;
  completedJobs?: number;
  completionRate?: number;
  cancellationRate?: number;
  churnRate?: number;
  escalatedBookings?: number;
  revenue?: number;
  workerEarnings?: number;
  platformCommission?: number;
  unitEconomics?: AdminUnitEconomicsSummary;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalBookings: number;
  totalWorkers: number;
  totalRevenue: number;
  activeBookings: number;
  completedBookings: number;
  pendingBookings: number;
  systemHealth: "healthy" | "warning" | "critical";
}

export interface AdminSystemHealthSnapshot {
  status?: string;
  database?: string;
  media?: {
    secureUploadsReady?: boolean;
    provider?: string;
  };
  deployment?: {
    provider?: string;
    commit?: string | null;
    branch?: string | null;
  };
  llm?: {
    mode?: "ready" | "fallback";
    summary?: string;
    primaryProvider?: string | null;
  };
}

export interface AdminActivityEntry {
  type?: string;
  msg: string;
  time: string;
  role?: string;
}

export type AdminMapStyle = "road" | "terrain" | "high-contrast";

export interface AdminActiveMarket {
  cityId: string;
  cityLabel: string;
  regionId: string | null;
  regionLabel: string | null;
  mode: "live" | "demo-fallback";
  mapStyle: AdminMapStyle;
}

export interface AdminShellContextValue {
  stats: AdminDashboardStats;
  loading: boolean;
  error: string;
  pitchMode: boolean;
  activeMarket: AdminActiveMarket;
  selectedMarketLocation: MarketLocation;
  selectedStateSlug: string;
  selectedCitySlug: string;
  selectedDistrictId: string | null;
  selectedStateLabel: string;
  selectedCityLabel: string;
  selectedDistrictLabel: string | null;
  selectedMarket: {
    state: MarketState;
    city: MarketCity;
    district?: MarketDistrict | null;
  };
  cityOptions: AdminMarketCityOption[];
  regionOptions: AdminRegionOption[];
  mapStyle: AdminMapStyle;
  mapOverlays: AdminMapOverlays;
  defensivePostureActive: boolean;
  activeCompetitorHotspot: AdminCompetitorHotspot | null;
  marketSnapshot: AdminMarketSnapshot | null;
  marketSnapshotLoading: boolean;
  districtOverlayMode: "city" | "district";
  routeZoneId: string;
  zoneLabel: string;
  currentMission: AdminMission;
  currentObservabilityPanel: AdminObservabilityPanel;
  healthSnapshot: AdminSystemHealthSnapshot | null;
  channelLatencyMs: number;
  llmMode: "ready" | "fallback";
  llmSummary: string;
  globalUptime: string;
  activeWorkerRate: number;
  pendingPayouts: number;
  averageTicket: number;
  sevenDayBookings: number;
  sevenDayRevenue: number;
  bookingTrendDelta: number;
  usersList: any[];
  workersList: any[];
  bookingsList: AdminBooking[];
  investorSummary: AdminInvestorAnalyticsSummary | null;
  chartData: Array<{ name: string; bookings?: number; revenue?: number }>;
  activities: AdminActivityEntry[];
  verificationViewerLoadingId: string | null;
  onNavigateMission: (mission: AdminMission) => void;
  onNavigateTab: (tab: AdminTab) => void;
  onSelectTool: (tool: AdminToolAction) => void;
  onSelectWarRoomZone: (zoneId: string) => void;
  onSelectMarketState: (stateSlug: string) => void;
  onSelectMarketCity: (citySlug: string, stateSlug?: string) => void;
  onSelectMarketDistrict: (districtSlug: string, citySlug?: string, stateSlug?: string) => void;
  onSelectActiveMarket: (cityId: string) => void;
  onSelectActiveRegion: (regionId: string | null) => void;
  onSelectMapStyle: (mapStyle: AdminMapStyle) => void;
  onSetMapOverlays: (nextOverlays: Partial<AdminMapOverlays>) => void;
  onActivateDefensivePosture: () => void;
  onClearDefensivePosture: () => void;
  onOpenVerificationDocument: (worker: any, type?: "aadhaar" | "pan") => void;
  onTogglePitchMode: () => void;
}

export const useAdminShellContext = () => useOutletContext<AdminShellContextValue>();





