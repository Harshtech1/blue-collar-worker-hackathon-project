import { useOutletContext } from "react-router-dom";
import type {
  AdminMission,
  AdminObservabilityPanel,
  AdminTab,
  AdminToolAction,
} from "./adminRoutes";

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

export interface AdminShellContextValue {
  stats: AdminDashboardStats;
  loading: boolean;
  error: string;
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
  onOpenVerificationDocument: (worker: any, type?: "aadhaar" | "pan") => void;
}

export const useAdminShellContext = () => useOutletContext<AdminShellContextValue>();
