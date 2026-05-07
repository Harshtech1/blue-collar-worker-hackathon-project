import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Radar,
  Server,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { API } from "@/lib/constants";
import { toast } from "sonner";
import { AdminSidebar } from "./components/AdminSidebar";
import { AdminTechnicalCopilot } from "./components/AdminTechnicalCopilot";
import {
  ADMIN_MISSION_LABELS,
  ADMIN_ROUTE_PREFIX,
  DEFAULT_WAR_ROOM_MARKET,
  OBSERVABILITY_PANEL_LABELS,
  buildMarketBreadcrumbLabel,
  buildIntelligencePath,
  buildMissionPath,
  buildPathForTab,
  buildPathForTool,
  buildWarRoomPath,
  getMissionFromPath,
  getWarRoomLocationFromPath,
  getObservabilityPanelFromPath,
  type AdminMission,
  type AdminTab,
  type AdminToolAction,
} from "./adminRoutes";
import {
  findMarketCity,
  getDefaultCityForState,
  getDefaultDistrictForCity,
  getDefaultMarketLocation,
  getMarketDistrictBySlug,
  listMarketCities,
  listMarketStates,
  resolveLegacyMarketTarget,
  resolveMarketContext,
  resolveMarketLabel,
  resolveMarketLocation,
  type MarketLocation,
} from "./marketRegistry";
import {
  buildDemoMarketSnapshot,
  findAdminMarketCity,
  getAdminMarketBreadcrumb,
  getAdminMarketCityOptions,
  getAdminRegionOptionsForCity,
  type AdminMarketSnapshot,
} from "./utils/adminMarketSnapshot";
import type {
  AdminActivityEntry,
  AdminActiveMarket,
  AdminBooking,
  AdminDashboardStats,
  AdminInvestorAnalyticsSummary,
  AdminMapStyle,
  AdminShellContextValue,
  AdminSystemHealthSnapshot,
} from "./adminShellContext";

const DEMO_ADMIN_TOKEN = "demo-admin-token";
const ADMIN_PITCH_MODE_KEY = "adminPitchMode";
const ADMIN_SELECTED_MARKET_KEY = "adminSelectedMarket";
const ADMIN_MAP_STYLE_KEY = "adminMapStyle";
const ADMIN_ROLE_FLAG_KEY = "isAdmin";

const ADMIN_EMAIL_OPTIONS = [
  "rahiforbharat@gmail.com",
  "admin@rahi.local",
];

const demoUsers = [
  { _id: "demo-customer-1", name: "Aarav Sharma", email: "aarav@example.com", phone: "+91 98765 43210", role: "customer", createdAt: new Date().toISOString() },
  { _id: "demo-customer-2", name: "Meera Singh", email: "meera@example.com", phone: "+91 99887 76655", role: "customer", createdAt: new Date(Date.now() - 86400000).toISOString() },
];

const demoWorkers = [
  { _id: "demo-worker-1", name: "Ramesh Kumar", profession: "Plumbing Specialist", phone: "+91 91234 56780", status: "verified", isAvailable: true, logisticsScore: 91, acceptanceRate: 88, reliabilityScore: 93, completedJobs: 142, createdAt: new Date().toISOString() },
  { _id: "demo-worker-2", name: "Sunita Devi", profession: "Home Cleaning Pro", phone: "+91 92345 67890", status: "verified", isAvailable: true, logisticsScore: 86, acceptanceRate: 82, reliabilityScore: 89, completedJobs: 118, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { _id: "demo-worker-3", name: "Imran Khan", profession: "Electrician", phone: "+91 93456 78901", status: "pending", isAvailable: false, logisticsScore: 67, acceptanceRate: 61, reliabilityScore: 72, completedJobs: 36, createdAt: new Date(Date.now() - 259200000).toISOString() },
];

const demoBookings: AdminBooking[] = [
  { _id: "demo-booking-1", service: "Plumbing Repair", total_price: 799, status: "completed", createdAt: new Date().toISOString() },
  { _id: "demo-booking-2", service: "Deep Home Cleaning", total_price: 1499, status: "in_progress", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { _id: "demo-booking-3", service: "Electrical Inspection", total_price: 599, status: "pending", createdAt: new Date(Date.now() - 7200000).toISOString() },
];

const buildInvestorSummaryFromBookings = (bookings: AdminBooking[]): AdminInvestorAnalyticsSummary => {
  const completed = bookings.filter((booking) => booking.status === "completed" && booking.total_price);
  const completedJobs = completed.length;
  const revenue = completed.reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0);
  const ledgerCommission = completed.reduce((sum, booking) => sum + Number(booking.commission ?? 0), 0);
  const hasLedgerCommission = ledgerCommission > 0;
  const platformCommission = hasLedgerCommission ? Math.round(ledgerCommission) : Math.round(revenue * 0.15);
  const avgTicket = completedJobs > 0 ? Math.round(revenue / completedJobs) : 0;
  const marketingCacPerJob = completedJobs > 0 ? Math.round((revenue * 0.028) / completedJobs) : 0;
  const incentivesPerJob = completedJobs > 0 ? Math.round((revenue * 0.012) / completedJobs) : 0;
  const commissionPerJob = completedJobs > 0 ? Math.round(platformCommission / completedJobs) : 0;
  const netProfitPerJob = commissionPerJob - (marketingCacPerJob + incentivesPerJob);

  return {
    totalBookings: bookings.length,
    completedJobs,
    revenue,
    platformCommission,
    workerEarnings: Math.max(0, revenue - platformCommission),
    unitEconomics: {
      avgTicket,
      commissionPerJob,
      marketingCacPerJob,
      incentivesPerJob,
      netProfitPerJob,
      totalCommission: platformCommission,
      source: hasLedgerCommission ? "booking-ledger + live ops model" : "demo revenue + ops model",
    },
  };
};

const emptyStats: AdminDashboardStats = {
  totalUsers: 0,
  totalBookings: 0,
  totalWorkers: 0,
  totalRevenue: 0,
  activeBookings: 0,
  completedBookings: 0,
  pendingBookings: 0,
  systemHealth: "healthy",
};

const missionNarratives: Record<AdminMission, string> = {
  overview: "A high-level snapshot of bookings, workforce readiness, and revenue performance.",
  "war-room": "Explore demand and workforce coverage on a cleaner map-first operating surface.",
  workforce: "Review staffing, verification, and booking coverage in one organized workflow.",
  finance: "Track revenue, payouts, and unit economics in a format that is easy to present.",
  observability: "Keep uptime, provider health, and the audit trail available without cluttering daily operations.",
  settings: "Administrative controls and platform preferences live here in a simpler layout.",
};

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentMission = useMemo(
    () => getMissionFromPath(location.pathname),
    [location.pathname],
  );
  const currentObservabilityPanel = useMemo(
    () => getObservabilityPanelFromPath(location.pathname),
    [location.pathname],
  );
  const routeMarketLocation = useMemo(
    () => getWarRoomLocationFromPath(location.pathname),
    [location.pathname],
  );
  const [selectedMarketLocation, setSelectedMarketLocation] = useState<MarketLocation>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_SELECTED_MARKET_KEY);
      if (!raw) return getDefaultMarketLocation();

      const parsed = JSON.parse(raw) as Partial<MarketLocation>;
      return resolveMarketLocation(parsed.stateSlug, parsed.citySlug, parsed.districtSlug);
    } catch (error) {
      console.warn("[AdminDashboard] Could not hydrate selected market:", error);
      return getDefaultMarketLocation();
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("adminToken");
    return Boolean(token);
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [pitchMode, setPitchMode] = useState(() => localStorage.getItem(ADMIN_PITCH_MODE_KEY) === "true");

  const [stats, setStats] = useState<AdminDashboardStats>(emptyStats);
  const [chartData, setChartData] = useState<Array<{ name: string; date?: string; bookings?: number; revenue?: number }>>([]);
  const [activities, setActivities] = useState<AdminActivityEntry[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<AdminBooking[]>([]);
  const [investorSummary, setInvestorSummary] = useState<AdminInvestorAnalyticsSummary | null>(null);

  const [verificationViewerOpen, setVerificationViewerOpen] = useState(false);
  const [verificationViewerUrl, setVerificationViewerUrl] = useState("");
  const [verificationViewerName, setVerificationViewerName] = useState("");
  const [verificationViewerType, setVerificationViewerType] = useState("aadhaar");
  const [verificationViewerLoadingId, setVerificationViewerLoadingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthSnapshot, setHealthSnapshot] = useState<AdminSystemHealthSnapshot | null>(null);
  const [channelLatencyMs, setChannelLatencyMs] = useState(42);
  const [mapStyle, setMapStyle] = useState<AdminMapStyle>(((): AdminMapStyle => {
    const persisted = localStorage.getItem(ADMIN_MAP_STYLE_KEY);
    if (persisted === "road") return "road";
    if (persisted === "terrain" || persisted === "satellite") return "satellite";
    if (persisted === "high-contrast" || persisted === "night-ops") return "night-ops";

    return "road";
  })());
  const [marketSnapshot, setMarketSnapshot] = useState<AdminMarketSnapshot | null>(null);
  const [marketSnapshotLoading, setMarketSnapshotLoading] = useState(false);
  const systemReadyToastShown = useRef(false);

  useEffect(() => {
    if (currentMission === "war-room") {
      setSelectedMarketLocation(() => resolveMarketLocation(
        routeMarketLocation.stateSlug,
        routeMarketLocation.citySlug,
        routeMarketLocation.districtSlug,
      ));
    }
  }, [currentMission, routeMarketLocation.citySlug, routeMarketLocation.districtSlug, routeMarketLocation.stateSlug]);

  useEffect(() => {
    localStorage.setItem(ADMIN_SELECTED_MARKET_KEY, JSON.stringify(selectedMarketLocation));
  }, [selectedMarketLocation]);

  useEffect(() => {
    localStorage.setItem(ADMIN_MAP_STYLE_KEY, mapStyle);
  }, [mapStyle]);

  const marketLocation = useMemo<MarketLocation>(() => (
    currentMission === "war-room"
      ? resolveMarketLocation(
        routeMarketLocation.stateSlug,
        routeMarketLocation.citySlug,
        routeMarketLocation.districtSlug,
      )
      : resolveMarketLocation(
        selectedMarketLocation.stateSlug,
        selectedMarketLocation.citySlug,
        selectedMarketLocation.districtSlug,
      )
  ), [
    currentMission,
    routeMarketLocation.citySlug,
    routeMarketLocation.districtSlug,
    routeMarketLocation.stateSlug,
    selectedMarketLocation.citySlug,
    selectedMarketLocation.districtSlug,
    selectedMarketLocation.stateSlug,
  ]);

  const selectedDistrictId = marketLocation.districtSlug || null;

  const selectedMarket = useMemo(
    () => resolveMarketContext(marketLocation.stateSlug, marketLocation.citySlug, marketLocation.districtSlug),
    [marketLocation.citySlug, marketLocation.districtSlug, marketLocation.stateSlug],
  );
  const selectedStateSlug = selectedMarket.state.slug;
  const selectedCitySlug = selectedMarket.city.slug;
  const routeZoneId = selectedMarket.city.simulationCityId || selectedCitySlug;
  const zoneLabel = useMemo(
    () => resolveMarketLabel(selectedStateSlug, selectedCitySlug, selectedDistrictId),
    [selectedCitySlug, selectedDistrictId, selectedStateSlug],
  );
  const selectedStateLabel = selectedMarket.state.label;
  const selectedCityLabel = selectedMarket.city.label;
  const districtOverlayMode = selectedDistrictId ? "district" as const : "city" as const;
  const selectedDistrictLabel = selectedMarket.district?.label || getMarketDistrictBySlug(selectedDistrictId, selectedCitySlug)?.label || null;
  const marketStateOptions = useMemo(() => listMarketStates(), []);
  const filteredCityOptions = useMemo(
    () => listMarketCities(selectedStateSlug),
    [selectedStateSlug],
  );
  const marketCityOptions = useMemo(() => getAdminMarketCityOptions(), []);
  const selectedCityOption = useMemo(
    () => marketCityOptions.find((city) => city.cityId === selectedCitySlug) || null,
    [marketCityOptions, selectedCitySlug],
  );
  const fallbackMarketSnapshot = useMemo(
    () => buildDemoMarketSnapshot({
      cityId: selectedCitySlug,
      regionId: selectedDistrictId,
    }),
    [selectedCitySlug, selectedDistrictId],
  );
  const regionOptions = useMemo(
    () => marketSnapshot?.regions || getAdminRegionOptionsForCity(selectedCitySlug),
    [marketSnapshot, selectedCitySlug],
  );
  const activeMarket = useMemo<AdminActiveMarket>(() => ({
    cityId: marketSnapshot?.market.cityId || selectedCitySlug,
    cityLabel: marketSnapshot?.market.cityLabel || selectedCityLabel,
    regionId: marketSnapshot?.market.regionId || selectedDistrictId,
    regionLabel: marketSnapshot?.market.regionLabel || selectedDistrictLabel,
    mode: marketSnapshot?.dataMode === "live" ? "live" : "demo-fallback",
    mapStyle: pitchMode ? "road" : mapStyle,
  }), [
    mapStyle,
    marketSnapshot,
    pitchMode,
    selectedCityLabel,
    selectedCitySlug,
    selectedDistrictId,
    selectedDistrictLabel,
  ]);

  useEffect(() => {
    let cancelled = false;

    const hydrateMarketSnapshot = async () => {
      const adminToken = localStorage.getItem("adminToken");
      const demoMode = localStorage.getItem("adminDemoMode") === "true" || adminToken === DEMO_ADMIN_TOKEN;
      const fallbackSnapshot = buildDemoMarketSnapshot({
        cityId: selectedCitySlug,
        regionId: selectedDistrictId,
      });

      if (cancelled) return;

      if (demoMode || !adminToken) {
        setMarketSnapshot(fallbackSnapshot);
        setMarketSnapshotLoading(false);
        return;
      }

      setMarketSnapshotLoading(true);

      try {
        const search = new URLSearchParams({
          cityId: selectedCitySlug,
        });

        if (selectedDistrictId) {
          search.set("regionId", selectedDistrictId);
        }

        const response = await fetch(`${API}/admin/market-snapshot?${search.toString()}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          cache: "no-store",
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load market snapshot");
        }

        if (!cancelled) {
          setMarketSnapshot(payload?.data || fallbackSnapshot);
        }
      } catch (snapshotError) {
        console.warn("[AdminDashboard] Market snapshot fallback engaged:", snapshotError);
        if (!cancelled) {
          setMarketSnapshot(fallbackSnapshot);
        }
      } finally {
        if (!cancelled) {
          setMarketSnapshotLoading(false);
        }
      }
    };

    void hydrateMarketSnapshot();

    return () => {
      cancelled = true;
    };
  }, [selectedCitySlug, selectedDistrictId]);

  const loadDemoDashboardData = useCallback(() => {
    const completed = demoBookings.filter((booking) => booking.status === "completed");
    const active = demoBookings.filter(
      (booking) => booking.status === "pending" || booking.status === "matched" || booking.status === "in_progress",
    );

    const totalRevenue = completed.reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0);
    const last7Days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));

      return {
        name: date.toLocaleDateString("en-US", { weekday: "short" }),
        date: date.toDateString(),
        bookings: index >= 4 ? index - 2 : index,
        revenue: index >= 4 ? (index - 3) * 650 : 0,
      };
    });

    setUsersList(demoUsers);
    setWorkersList(demoWorkers);
    setBookingsList(demoBookings);
    setInvestorSummary(buildInvestorSummaryFromBookings(demoBookings));
    setChartData(last7Days);
    setActivities([
      { type: "booking", msg: "Deep Home Cleaning is in progress", time: new Date().toLocaleTimeString(), role: "Operations" },
      { type: "user", msg: "New customer joined: Aarav Sharma", time: new Date(Date.now() - 1200000).toLocaleTimeString(), role: "Growth" },
      { type: "booking", msg: "Electrical Inspection is pending assignment", time: new Date(Date.now() - 2400000).toLocaleTimeString(), role: "Dispatch" },
    ]);
    setStats({
      totalUsers: demoUsers.length,
      totalBookings: demoBookings.length,
      totalWorkers: demoWorkers.length,
      totalRevenue,
      activeBookings: active.length,
      completedBookings: completed.length,
      pendingBookings: demoBookings.filter((booking) => booking.status === "pending").length,
      systemHealth: "warning",
    });
    setLoading(false);
    setError("");
  }, []);

  const clearAdminSession = useCallback((nextError = "") => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem(ADMIN_ROLE_FLAG_KEY);
    localStorage.removeItem("adminDemoMode");
    setIsAuthenticated(false);
    if (nextError) {
      setError(nextError);
    }
  }, []);

  const fetchHealthSnapshot = useCallback(async () => {
    const startedAt = performance.now();

    try {
      const response = await fetch(`${API}/health`, { cache: "no-store" });
      if (!response.ok) return null;

      const health = await response.json();
      setHealthSnapshot(health);
      setChannelLatencyMs(Math.max(8, Math.round(performance.now() - startedAt)));
      return health as AdminSystemHealthSnapshot;
    } catch (probeError) {
      console.warn("[AdminDashboard] Health probe failed:", probeError);
      return null;
    }
  }, []);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    const token = localStorage.getItem("adminToken");
    if (localStorage.getItem("adminDemoMode") === "true" || token === DEMO_ADMIN_TOKEN) {
      loadDemoDashboardData();
      return;
    }

    if (!token) {
      clearAdminSession("Admin session missing. Please log in again.");
      if (!isBackground) setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` } as HeadersInit;

    try {
      const [usersRes, bookingsRes, workersRes, analyticsRes] = await Promise.all([
        fetch(`${API}/admin/customers`, { headers }),
        fetch(`${API}/admin/bookings`, { headers }),
        fetch(`${API}/admin/workers`, { headers }),
        fetch(`${API}/admin/investor-analytics`, { headers }),
      ]);

      const authRejected = [usersRes, bookingsRes, workersRes, analyticsRes].some((response) => response.status === 401);
      if (authRejected) {
        clearAdminSession("Admin session expired. Please log in again.");
        return;
      }

      const failedResponse = [usersRes, bookingsRes, workersRes, analyticsRes].find((response) => !response.ok);
      if (failedResponse) {
        throw new Error(`Admin data sync failed with status ${failedResponse.status}`);
      }

      const usersData = await usersRes.json();
      const bookingsData = await bookingsRes.json();
      const workersData = await workersRes.json();
      const analyticsData = await analyticsRes.json();

      const users = usersData.data || (Array.isArray(usersData) ? usersData : []);
      const bookings: AdminBooking[] = bookingsData.data || (Array.isArray(bookingsData) ? bookingsData : []);
      const workers = workersData.data || (Array.isArray(workersData) ? workersData : []);
      const analyticsSummary = analyticsData?.data?.summary || null;

      setUsersList(users);
      setBookingsList(bookings);
      setWorkersList(workers);
      setInvestorSummary(analyticsSummary || buildInvestorSummaryFromBookings(bookings));

      const completed = bookings.filter((booking) => booking.status === "completed");
      const active = bookings.filter(
        (booking) => booking.status === "pending" || booking.status === "matched" || booking.status === "in_progress",
      );

      const totalRevenue = completed.reduce(
        (sum, booking) => sum + Number(booking.total_price ?? 0),
        0,
      );

      const last7Days = Array.from({ length: 7 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));

        return {
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          date: date.toDateString(),
          bookings: 0,
          revenue: 0,
        };
      });

      bookings.forEach((booking) => {
        if (!booking.createdAt && !booking.date) return;

        const bookingDate = new Date((booking.createdAt || booking.date) as string).toDateString();
        const matchingDay = last7Days.find((entry) => entry.date === bookingDate);

        if (matchingDay) {
          matchingDay.bookings = Number(matchingDay.bookings || 0) + 1;
          if (booking.status === "completed" && booking.total_price) {
            matchingDay.revenue = Number(matchingDay.revenue || 0) + Number(booking.total_price);
          }
        }
      });
      setChartData(last7Days);

      const recentActivities: AdminActivityEntry[] = [];
      const sortedBookings = [...bookings]
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
        .slice(0, 3);
      sortedBookings.forEach((booking) => {
        recentActivities.push({
          type: "booking",
          msg: `Booking ${booking.service || "Service"} is ${booking.status}`,
          time: new Date(booking.createdAt || Date.now()).toLocaleTimeString(),
          role: "Operations",
        });
      });

      const sortedUsers = [...users]
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
        .slice(0, 2);
      sortedUsers.forEach((user) => {
        recentActivities.push({
          type: "user",
          msg: `New user joined: ${user.name || user.phone}`,
          time: new Date(user.createdAt || Date.now()).toLocaleTimeString(),
          role: "Growth",
        });
      });

      setActivities(recentActivities.sort((left, right) => right.time.localeCompare(left.time)));
      setStats({
        totalUsers: users.length,
        totalBookings: bookings.length,
        totalWorkers: workers.length,
        totalRevenue,
        activeBookings: active.length,
        completedBookings: completed.length,
        pendingBookings: bookings.length - completed.length - active.length,
        systemHealth: "healthy",
      });
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setStats((previous) => ({ ...previous, systemHealth: "critical" }));
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [clearAdminSession, loadDemoDashboardData]);

  const handleViewVerificationDocument = useCallback(async (worker: any, type: "aadhaar" | "pan" = "aadhaar") => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setError("Admin session expired. Please log in again.");
      return;
    }

    setVerificationViewerLoadingId(`${worker._id}:${type}`);
    try {
      const response = await fetch(`${API}/admin/workers/${worker._id}/verification-document?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load verification document");
      }

      setVerificationViewerUrl(data.url);
      setVerificationViewerName(worker.name || "Worker");
      setVerificationViewerType(type);
      setVerificationViewerOpen(true);
    } catch (viewerError: any) {
      setError(viewerError.message || "Failed to load verification document");
    } finally {
      setVerificationViewerLoadingId(null);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || "Invalid admin credentials");
        return;
      }

      const { token, role } = await response.json();
      localStorage.setItem("adminToken", token);
      localStorage.setItem(ADMIN_ROLE_FLAG_KEY, role === "admin" ? "true" : "false");
      localStorage.removeItem("adminDemoMode");
      setIsAuthenticated(true);
      await fetchDashboardData();
      navigate(buildMissionPath("overview"), { replace: true });
    } catch (_loginError) {
      setError("Server unreachable. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [email, fetchDashboardData, location.pathname, navigate, password]);

  const handleDemoBypass = useCallback(() => {
    localStorage.setItem("adminToken", DEMO_ADMIN_TOKEN);
    localStorage.setItem(ADMIN_ROLE_FLAG_KEY, "true");
    localStorage.setItem("adminDemoMode", "true");
    setEmail("demo@rahi.local");
    setIsAuthenticated(true);
    navigate(buildMissionPath("overview"), { replace: true });
    loadDemoDashboardData();
  }, [loadDemoDashboardData, navigate]);

  const handleForgotPassword = useCallback(async () => {
    setError("");
    setRecoveryMessage("");
    setRecoveryLoading(true);

    try {
      const response = await fetch(`${API}/auth/admin-forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRecoveryMessage(data.message || "Enter a valid admin email first.");
        return;
      }

      setRecoveryMessage(data.message || "Recovery request submitted.");
    } catch (_forgotError) {
      setRecoveryMessage("Server unreachable. Start the backend and try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }, [email]);

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate(buildMissionPath("overview"), { replace: true });
  }, [clearAdminSession, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    void fetchDashboardData();
    void fetchHealthSnapshot();

    const dashboardInterval = window.setInterval(() => {
      void fetchDashboardData(true);
    }, 5000);

    return () => window.clearInterval(dashboardInterval);
  }, [fetchDashboardData, fetchHealthSnapshot, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || systemReadyToastShown.current) return;

    let cancelled = false;

    const probeSystemReadiness = async () => {
      const health = await fetchHealthSnapshot();
      if (cancelled || !health) return;

      if (health.status === "ok" && health.media?.secureUploadsReady === true) {
        systemReadyToastShown.current = true;
        toast.success("System Ready: Render, database, Socket.IO, and secure uploads are live.");
      }
    };

    void probeSystemReadiness();

    return () => {
      cancelled = true;
    };
  }, [fetchHealthSnapshot, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const healthInterval = window.setInterval(() => {
      void fetchHealthSnapshot();
    }, 15000);

    return () => window.clearInterval(healthInterval);
  }, [fetchHealthSnapshot, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (location.pathname === ADMIN_ROUTE_PREFIX || location.pathname === `${ADMIN_ROUTE_PREFIX}/`) {
      navigate(buildMissionPath("overview"), { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;
    const previousBodyBackground = body.style.background;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.background = "#F8FAFC";

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      body.style.background = previousBodyBackground;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ADMIN_PITCH_MODE_KEY, pitchMode ? "true" : "false");
  }, [pitchMode]);

  const activeWorkersCount = useMemo(
    () => workersList.filter((worker) => worker.isAvailable || worker.status === "verified" || worker.status === "online").length,
    [workersList],
  );
  const activeWorkerRate = stats.totalWorkers > 0 ? Math.round((activeWorkersCount / stats.totalWorkers) * 100) : 0;
  const globalUptime = healthSnapshot?.status === "ok" ? "99.90%" : stats.systemHealth === "critical" ? "96.80%" : "99.20%";
  const llmSummary = healthSnapshot?.llm?.summary || "Cloud Engine: Monitoring";
  const llmMode = healthSnapshot?.llm?.mode || "ready";
  const pendingPayouts = useMemo(
    () => bookingsList
      .filter((booking) => booking.status === "in_progress" || booking.status === "matched")
      .reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0),
    [bookingsList],
  );
  const averageTicket = useMemo(() => {
    const completed = bookingsList.filter((booking) => booking.status === "completed" && booking.total_price);
    if (completed.length === 0) return 0;

    return Math.round(
      completed.reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0) / completed.length,
    );
  }, [bookingsList]);
  const sevenDayBookings = useMemo(
    () => chartData.reduce((sum, day) => sum + Number(day.bookings ?? 0), 0),
    [chartData],
  );
  const sevenDayRevenue = useMemo(
    () => chartData.reduce((sum, day) => sum + Number(day.revenue ?? 0), 0),
    [chartData],
  );
  const bookingTrendDelta = useMemo(() => {
    if (chartData.length < 2) return 0;

    const latest = Number(chartData[chartData.length - 1]?.bookings ?? 0);
    const previous = Number(chartData[chartData.length - 2]?.bookings ?? 0);
    return latest - previous;
  }, [chartData]);

  const handleMissionNavigation = useCallback((mission: AdminMission) => {
    navigate(buildMissionPath(mission, { market: marketLocation, panel: currentObservabilityPanel }));
  }, [currentObservabilityPanel, marketLocation, navigate]);

  const handleTabNavigation = useCallback((tab: AdminTab) => {
    navigate(buildPathForTab(tab, marketLocation));
  }, [marketLocation, navigate]);

  const handleToolSelection = useCallback((tool: AdminToolAction) => {
    navigate(buildPathForTool(tool));
  }, [navigate]);

  const syncAdminMarketLocation = useCallback((nextLocation: MarketLocation) => {
    setSelectedMarketLocation(nextLocation);

    if (currentMission !== "war-room") {
      return;
    }

    const nextPath = location.pathname.includes("/intelligence/")
      ? buildIntelligencePath(nextLocation)
      : buildWarRoomPath(nextLocation);
    navigate(nextPath);
  }, [currentMission, location.pathname, navigate]);

  const handleMarketStateSelect = useCallback((stateToken: string) => {
    const nextStateSlug = stateToken.replace(/^state:/, "");
    const nextCity = getDefaultCityForState(nextStateSlug);
    if (!nextCity) return;

    const nextDistrict = getDefaultDistrictForCity(nextCity.slug);
    syncAdminMarketLocation({
      stateSlug: nextStateSlug,
      citySlug: nextCity.slug,
      districtSlug: nextDistrict?.slug || null,
    });
  }, [syncAdminMarketLocation]);

  const handleMarketCitySelect = useCallback((cityToken: string, stateSlug?: string) => {
    const nextCitySlug = cityToken.replace(/^city:/, "");
    const explicitCity = findMarketCity(nextCitySlug);
    const nextStateSlug = stateSlug || explicitCity?.stateSlug || selectedStateSlug;
    const nextDistrict = getDefaultDistrictForCity(nextCitySlug);
    const nextLocation = {
      stateSlug: nextStateSlug,
      citySlug: nextCitySlug,
      districtSlug: nextDistrict?.slug || null,
    };

    syncAdminMarketLocation(nextLocation);
    if (currentMission !== "war-room") {
      navigate(buildWarRoomPath(nextLocation));
    }
  }, [currentMission, navigate, selectedStateSlug, syncAdminMarketLocation]);
  const handleMarketDistrictSelect = useCallback((districtToken: string, citySlug?: string, stateSlug?: string) => {
    const nextDistrictSlug = districtToken.replace(/^district:/, "");
    const nextCitySlug = citySlug || selectedCitySlug;
    const nextStateSlug = stateSlug || selectedStateSlug;
    syncAdminMarketLocation({
      stateSlug: nextStateSlug,
      citySlug: nextCitySlug,
      districtSlug: nextDistrictSlug,
    });
  }, [selectedCitySlug, selectedStateSlug, syncAdminMarketLocation]);
  function handleActiveMarketSelect(cityId: string) {
    const selectedCity = findAdminMarketCity(cityId);
    const targetCity = findMarketCity(selectedCity?.cityId || cityId);
    if (!targetCity) return;

    const nextDistrict = getDefaultDistrictForCity(targetCity.slug);
    const nextLocation = {
      stateSlug: targetCity.stateSlug,
      citySlug: targetCity.slug,
      districtSlug: nextDistrict?.slug || null,
    };

    syncAdminMarketLocation(nextLocation);
    if (currentMission !== "war-room") {
      navigate(buildWarRoomPath(nextLocation));
    }
  }
  const handleActiveRegionSelect = useCallback((regionId: string | null) => {
    syncAdminMarketLocation({
      stateSlug: selectedStateSlug,
      citySlug: selectedCitySlug,
      districtSlug: regionId || null,
    });
  }, [selectedCitySlug, selectedStateSlug, syncAdminMarketLocation]);
  const handleMapStyleSelect = useCallback((nextMapStyle: AdminMapStyle) => {
    setMapStyle(nextMapStyle);
  }, []);

  const handleWarRoomZoneSelect = useCallback((zoneId: string) => {
    if (zoneId.startsWith("state:")) {
      const targetState = zoneId.replace("state:", "");
      const nextCity = getDefaultCityForState(targetState);
      if (nextCity) {
        const nextDistrict = getDefaultDistrictForCity(nextCity.slug);
        syncAdminMarketLocation({
          stateSlug: targetState,
          citySlug: nextCity.slug,
          districtSlug: nextDistrict?.slug || null,
        });
      }
      return;
    }

    if (zoneId.startsWith("city:")) {
      const targetCity = zoneId.replace("city:", "");
      const explicitTarget = listMarketCities().find((city) => city.slug === targetCity);
      if (explicitTarget) {
        const nextDistrict = getDefaultDistrictForCity(explicitTarget.slug);
        syncAdminMarketLocation({
          stateSlug: explicitTarget.stateSlug,
          citySlug: explicitTarget.slug,
          districtSlug: nextDistrict?.slug || null,
        });
        return;
      }
    }

    const normalizedTarget = zoneId.startsWith("district:")
      ? zoneId.replace("district:", "")
      : zoneId;
    const targetMarket = resolveLegacyMarketTarget(normalizedTarget);
    if (!targetMarket) {
      syncAdminMarketLocation(marketLocation);
      return;
    }

    syncAdminMarketLocation({
      stateSlug: targetMarket.stateSlug,
      citySlug: targetMarket.citySlug,
      districtSlug: targetMarket.districtSlug || null,
    });
  }, [marketLocation, syncAdminMarketLocation]);
  const handlePitchModeToggle = useCallback(() => {
    setPitchMode((current) => !current);
  }, []);

  const topContextLabel = currentMission === "war-room"
    ? zoneLabel
    : currentMission === "observability"
      ? OBSERVABILITY_PANEL_LABELS[currentObservabilityPanel]
      : ADMIN_MISSION_LABELS[currentMission];
  const marketBreadcrumb = useMemo(
    () => marketSnapshot ? getAdminMarketBreadcrumb(marketSnapshot) : buildMarketBreadcrumbLabel(marketLocation),
    [marketLocation, marketSnapshot],
  );
  const usesDedicatedMapSurface = currentMission === "war-room";

  const shellContext = useMemo<AdminShellContextValue>(() => ({
    stats,
    loading,
    error,
    pitchMode,
    activeMarket,
    selectedMarketLocation: marketLocation,
    selectedStateSlug,
    selectedCitySlug,
    selectedDistrictId,
    selectedStateLabel,
    selectedCityLabel,
    selectedDistrictLabel,
    selectedMarket: {
      state: selectedMarket.state,
      city: selectedMarket.city,
    },
    cityOptions: marketCityOptions,
    regionOptions,
    mapStyle: pitchMode ? "road" : mapStyle,
    marketSnapshot: marketSnapshot || fallbackMarketSnapshot,
    marketSnapshotLoading,
    districtOverlayMode,
    routeZoneId,
    zoneLabel,
    currentMission,
    currentObservabilityPanel,
    healthSnapshot,
    channelLatencyMs,
    llmMode,
    llmSummary,
    globalUptime,
    activeWorkerRate,
    pendingPayouts,
    averageTicket,
    sevenDayBookings,
    sevenDayRevenue,
    bookingTrendDelta,
    usersList,
    workersList,
    bookingsList,
    investorSummary,
    chartData,
    activities,
    verificationViewerLoadingId,
    onNavigateMission: handleMissionNavigation,
    onNavigateTab: handleTabNavigation,
    onSelectTool: handleToolSelection,
    onSelectWarRoomZone: handleWarRoomZoneSelect,
    onSelectMarketState: handleMarketStateSelect,
    onSelectMarketCity: handleMarketCitySelect,
    onSelectMarketDistrict: handleMarketDistrictSelect,
    onSelectActiveMarket: handleActiveMarketSelect,
    onSelectActiveRegion: handleActiveRegionSelect,
    onSelectMapStyle: handleMapStyleSelect,
    onOpenVerificationDocument: handleViewVerificationDocument,
    onTogglePitchMode: handlePitchModeToggle,
  }), [
    activeMarket,
    activities,
    activeWorkerRate,
    averageTicket,
    bookingTrendDelta,
    bookingsList,
    channelLatencyMs,
    chartData,
    currentMission,
    currentObservabilityPanel,
    error,
    globalUptime,
    handleActiveMarketSelect,
    handleActiveRegionSelect,
    handleMapStyleSelect,
    districtOverlayMode,
    handleMissionNavigation,
    handleMarketCitySelect,
    handleMarketDistrictSelect,
    handleMarketStateSelect,
    handlePitchModeToggle,
    handleTabNavigation,
    handleToolSelection,
    handleViewVerificationDocument,
    handleWarRoomZoneSelect,
    healthSnapshot,
    llmMode,
    llmSummary,
    loading,
    investorSummary,
    fallbackMarketSnapshot,
    mapStyle,
    marketCityOptions,
    marketLocation,
    marketSnapshot,
    marketSnapshotLoading,
    pendingPayouts,
    pitchMode,
    regionOptions,
    routeZoneId,
    selectedCityLabel,
    selectedCitySlug,
    selectedDistrictId,
    selectedDistrictLabel,
    selectedMarket.city,
    selectedMarket.state,
    selectedStateLabel,
    selectedStateSlug,
    sevenDayBookings,
    sevenDayRevenue,
    stats,
    usersList,
    verificationViewerLoadingId,
    workersList,
    zoneLabel,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-slate-50 text-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(226,232,240,0.55),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]" />
        <div className="relative z-10 flex min-h-full items-center justify-center px-4">
          <section className="w-full max-w-xl rounded-[1.5rem] border border-slate-200 bg-white p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              <Radar className="h-3.5 w-3.5 text-[#0F172A]" />
              RAHI Operations Suite
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Admin access
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600">
              Authenticate into the routed operations suite. Market analytics, workforce, finance, and observability stay mounted inside one protected admin shell.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <Mail className="h-3.5 w-3.5 text-[#0F172A]" />
                  Admin Email
                </label>
                <input
                  list="admin-email-options"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="rahiforbharat@gmail.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
                <datalist id="admin-email-options">
                  {ADMIN_EMAIL_OPTIONS.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <KeyRound className="h-3.5 w-3.5 text-[#0F172A]" />
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter secure credential"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Checking access..." : "Login with live backend"}
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDemoBypass}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Enter demo view
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowForgotPassword((value) => !value)}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-700"
              >
                {showForgotPassword ? "Hide recovery" : "Forgot password?"}
              </button>
              {error ? (
                <span className="text-xs font-semibold text-rose-600">{error}</span>
              ) : null}
            </div>

            {showForgotPassword ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs leading-6 text-slate-600">
                  Submit the admin email to trigger the recovery flow on the live backend.
                </p>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={recoveryLoading}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {recoveryLoading ? "Submitting..." : "Send recovery request"}
                </button>
                {recoveryMessage ? (
                  <p className="mt-3 text-xs font-semibold text-slate-700">{recoveryMessage}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mission-control-shell fixed inset-0 isolate overflow-hidden bg-slate-50 text-slate-900">
      <style>{`
        html, body, #root {
          height: 100%;
          overflow: hidden;
        }

        .mission-control-shell {
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar {
          width: 9px;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar-track {
          background: rgba(226, 232, 240, 0.9);
          border-radius: 999px;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.85);
          border-radius: 999px;
          border: 2px solid rgba(248, 250, 252, 0.92);
        }

        .admin-shell-grid {
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
          grid-template-areas:
            "top_hud"
            "content";
        }

        .admin-shell-sidebar { grid-area: sidebar; }
        .admin-shell-top { grid-area: top_hud; }
        .admin-shell-content { grid-area: content; min-height: 0; }

        @media (min-width: 1024px) {
          .admin-shell-grid {
            grid-template-columns: 18rem minmax(0, 1fr);
            grid-template-areas:
              "sidebar top_hud"
              "sidebar content";
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(226,232,240,0.85),rgba(248,250,252,0.94)_42%,rgba(248,250,252,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(191,219,254,0.22),transparent_22%),radial-gradient(circle_at_86%_16%,rgba(226,232,240,0.5),transparent_24%)]" />

      <div className="admin-shell-grid relative z-10 grid h-full gap-4 p-4">
        <div className="admin-shell-sidebar min-h-0">
          <AdminSidebar
            activeMission={currentMission}
            onNavigate={handleMissionNavigation}
            onToolSelect={handleToolSelection}
            onLogout={handleLogout}
          />
        </div>

        <header className="admin-shell-top min-w-0">
          <div className="h-full rounded-[1.2rem] border border-slate-200 bg-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.14)]">
            <div className="flex h-full flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <div className="flex items-center gap-2">
                    <Radar className="h-3.5 w-3.5 text-[#0F172A]" />
                    RAHI Operations Suite
                  </div>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 xl:block" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] text-slate-700">
                    <MapPin className="h-3 w-3 text-[#0F172A]" />
                    {topContextLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] text-slate-600">
                    <BrainCircuit className="h-3 w-3 text-[#0F172A]" />
                    {pitchMode
                      ? "PITCH MODE ACTIVE"
                      : healthSnapshot?.deployment?.commit
                        ? `COMMIT ${healthSnapshot.deployment.commit.slice(0, 7)}`
                        : "COMMIT SYNCING"}
                  </span>
                </div>
                <p className="mt-2 max-w-4xl text-[12px] text-slate-600">
                  {pitchMode
                    ? "Pitch Mode is simplifying the suite for presentations by foregrounding growth, unit economics, and expansion signals while muting low-level operator chatter."
                    : llmMode === "ready"
                    ? missionNarratives[currentMission]
                    : "Cloud reasoning is degraded, but local fallback guidance is still steering the active shell."}
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {marketBreadcrumb}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.24)]">
                  <Globe2 className="h-3.5 w-3.5 text-[#0F172A]" />
                  <span>State</span>
                  <select
                    value={selectedStateSlug}
                    onChange={(event) => handleMarketStateSelect(event.target.value)}
                    className="min-w-[11rem] bg-transparent pr-1 text-[11px] font-semibold normal-case tracking-normal text-slate-900 outline-none"
                  >
                    {marketStateOptions.map((state) => (
                      <option key={state.slug} value={state.slug}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.24)]">
                  <MapPin className="h-3.5 w-3.5 text-[#0F172A]" />
                  <span>City</span>
                  <select
                    value={selectedCitySlug}
                    onChange={(event) => handleMarketCitySelect(event.target.value, selectedStateSlug)}
                    className="min-w-[13rem] bg-transparent pr-1 text-[11px] font-semibold normal-case tracking-normal text-slate-900 outline-none"
                  >
                    {filteredCityOptions.map((city) => (
                      <option key={city.slug} value={city.slug}>
                        {city.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.24)]">
                  <MapPin className="h-3.5 w-3.5 text-[#0F172A]" />
                  <span>District</span>
                  <select
                    value={selectedDistrictId || ""}
                    onChange={(event) => handleActiveRegionSelect(event.target.value || null)}
                    className="min-w-[13rem] bg-transparent pr-1 text-[11px] font-semibold normal-case tracking-normal text-slate-900 outline-none"
                  >
                    <option value="">City overview</option>
                    {regionOptions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedCityOption ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {selectedCityOption.label} | {selectedCityOption.readiness}% ready
                  </span>
                ) : null}
                <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Markets {">"} {selectedStateLabel} {">"} {selectedCityLabel}
                </span>
                {activeMarket.regionLabel ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    <MapPin className="h-3.5 w-3.5" />
                    {activeMarket.regionLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handlePitchModeToggle}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition",
                    pitchMode
                      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {pitchMode ? "Pitch Mode On" : "Pitch Mode Off"}
                </button>
                <HudTickerItem icon={Globe2} label="Mission" value={ADMIN_MISSION_LABELS[currentMission].toUpperCase()} tone="indigo" />
                <HudTickerItem icon={Globe2} label="Uptime" value={globalUptime} tone="emerald" />
                <HudTickerItem icon={Clock3} label="Latency" value={`${channelLatencyMs}ms`} tone="sky" />
                <HudTickerItem icon={UsersRound} label="Active Fleet" value={`${activeWorkerRate}%`} tone="indigo" />
                {!pitchMode ? (
                  <HudTickerItem
                    icon={Server}
                    label="Cloud Engine"
                    value={llmMode === "ready" ? "READY" : "FALLBACK"}
                    tone={llmMode === "ready" ? "emerald" : "amber"}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="admin-shell-content relative min-h-0 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.12)]">
          {!usesDedicatedMapSurface ? <div className="absolute inset-0 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]" /> : null}

          <div className="relative z-10 h-full">
            <Outlet context={shellContext} />
          </div>
        </main>
      </div>

      <AdminTechnicalCopilot shellContext={shellContext} showLauncher={!pitchMode} />

      <Dialog open={verificationViewerOpen} onOpenChange={setVerificationViewerOpen}>
        <DialogContent className="max-w-4xl border border-slate-200 bg-white text-slate-900 shadow-[0_32px_90px_-44px_rgba(15,23,42,0.24)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {verificationViewerName} - {verificationViewerType.toUpperCase()} Verification Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">
                This preview uses a time-limited signed URL from the backend.
              </p>
              <a
                href={verificationViewerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F172A] px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <ExternalLink size={14} />
                Open In New Tab
              </a>
            </div>

            {verificationViewerUrl ? (
              verificationViewerUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={verificationViewerUrl}
                  title="Verification Document Preview"
                  className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={verificationViewerUrl}
                    alt={`${verificationViewerType} verification document`}
                    className="max-h-[70vh] w-full object-contain"
                  />
                </div>
              )
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                Unable to preview this document right now.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type HudTone = "emerald" | "amber" | "indigo" | "sky" | "rose";

const hudToneClasses: Record<HudTone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  indigo: "border-slate-200 bg-slate-50 text-slate-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

function HudTickerItem({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  tone: HudTone;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]", hudToneClasses[tone])}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}
