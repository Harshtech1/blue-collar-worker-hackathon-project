import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ShieldCheck,
  ChevronRight,
  Clock3,
  DollarSign,
  Mail,
  KeyRound,
  FileLock2,
  ExternalLink,
  Globe2,
  MapPin,
  Radar,
  Server,
  TriangleAlert,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  AdminMission,
  AdminSidebar,
  AdminTab,
  type AdminToolAction,
} from "./components/AdminSidebar";
import { DataTable } from "./components/DataTable";
import { OverviewTab } from "./components/OverviewTab";
import { FinanceTab } from "./components/FinanceTab";
import { SystemTab } from "./components/SystemTab";
import { BugsTab } from "./components/BugsTab";
import { IntelligenceTab } from "./components/IntelligenceTab";
import { sectorSeeds } from "@/utils/simulationData";
import { API } from '@/lib/constants';
import { toast } from "sonner";

/* ================= TYPES ================= */

interface Booking {
  _id: string;
  service?: string;
  customer?: string;
  total_price?: number | string;
  status?: "pending" | "matched" | "in_progress" | "completed";
  createdAt?: string | Date;
  date?: string | Date;
}

interface DashboardStats {
  totalUsers: number;
  totalBookings: number;
  totalWorkers: number;
  totalRevenue: number;
  activeBookings: number;
  completedBookings: number;
  pendingBookings: number;
  systemHealth: "healthy" | "warning" | "critical";
}

interface SystemHealthSnapshot {
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

const ADMIN_EMAIL_OPTIONS = [
  "rahiforbharat@gmail.com",
  "admin@rahi.local",
];

const DEMO_ADMIN_TOKEN = "rahi-demo-admin-token";
const ADMIN_ROUTE_PREFIX = "/admin-portal-2026";
const DEFAULT_INTELLIGENCE_ZONE = "agra-cantt";

const ADMIN_MISSIONS: AdminMission[] = [
  "overview",
  "intelligence",
  "workforce",
  "finance",
  "observability",
  "settings",
];

const ADMIN_TABS: AdminTab[] = [
  "overview",
  "users",
  "workers",
  "bookings",
  "finance",
  "heatmap",
  "intelligence",
  "system",
  "bugs",
  "audit",
  "settings",
];

const isAdminTab = (value: string | undefined): value is AdminTab => (
  Boolean(value) && ADMIN_TABS.includes(value as AdminTab)
);

const isAdminMission = (value: string | undefined): value is AdminMission => (
  Boolean(value) && ADMIN_MISSIONS.includes(value as AdminMission)
);

const isAdminToolAction = (value: string | null | undefined): value is AdminToolAction => (
  value === "bug-monitor"
  || value === "api-telemetry"
  || value === "database-status"
  || value === "settings"
);

const getAdminRouteState = (pathname: string, search: string) => {
  const trimmed = pathname.startsWith(ADMIN_ROUTE_PREFIX)
    ? pathname.slice(ADMIN_ROUTE_PREFIX.length)
    : pathname;
  const segments = trimmed.split("/").filter(Boolean);
  const primarySegment = segments[0];
  const params = new URLSearchParams(search);
  const panelParam = params.get("panel");
  const toolParam = params.get("tool");
  const toolAction = isAdminToolAction(toolParam) ? toolParam : null;

  if (!primarySegment || primarySegment === "overview") {
    const routeTab = panelParam === "users" || panelParam === "bookings" ? panelParam : "overview";
    return {
      routeMission: "overview" as const,
      routeTab,
      routeZoneId: null,
      toolAction,
    };
  }

  if (primarySegment === "intelligence" || primarySegment === "heatmap") {
    return {
      routeMission: "intelligence" as const,
      routeTab: "intelligence" as const,
      routeZoneId: segments[1] || DEFAULT_INTELLIGENCE_ZONE,
      toolAction,
    };
  }

  if (primarySegment === "workforce" || primarySegment === "workers") {
    return {
      routeMission: "workforce" as const,
      routeTab: "workers" as const,
      routeZoneId: null,
      toolAction,
    };
  }

  if (primarySegment === "finance") {
    return {
      routeMission: "finance" as const,
      routeTab: "finance" as const,
      routeZoneId: null,
      toolAction,
    };
  }

  if (
    primarySegment === "observability"
    || primarySegment === "system"
    || primarySegment === "bugs"
    || primarySegment === "audit"
  ) {
    const routeTab =
      primarySegment === "bugs" || toolAction === "bug-monitor"
        ? "bugs"
        : "system";

    return {
      routeMission: "observability" as const,
      routeTab,
      routeZoneId: null,
      toolAction,
    };
  }

  if (primarySegment === "settings") {
    return {
      routeMission: "settings" as const,
      routeTab: "settings" as const,
      routeZoneId: null,
      toolAction: "settings" as const,
    };
  }

  if (primarySegment === "users" || primarySegment === "bookings") {
    return {
      routeMission: "overview" as const,
      routeTab: primarySegment,
      routeZoneId: null,
      toolAction,
    };
  }

  if (isAdminMission(primarySegment)) {
    return {
      routeMission: primarySegment,
      routeTab: primarySegment === "observability" ? "system" : primarySegment === "workforce" ? "workers" : primarySegment === "settings" ? "settings" : "overview",
      routeZoneId: null,
      toolAction,
    };
  }

  return {
    routeMission: "overview" as const,
    routeTab: "overview" as const,
    routeZoneId: null,
    toolAction,
  };
};

const demoUsers = [
  { _id: "demo-customer-1", name: "Aarav Sharma", email: "aarav@example.com", phone: "+91 98765 43210", role: "customer", createdAt: new Date().toISOString() },
  { _id: "demo-customer-2", name: "Meera Singh", email: "meera@example.com", phone: "+91 99887 76655", role: "customer", createdAt: new Date(Date.now() - 86400000).toISOString() },
];

const demoWorkers = [
  { _id: "demo-worker-1", name: "Ramesh Kumar", profession: "Plumbing Specialist", phone: "+91 91234 56780", status: "verified", isAvailable: true, logisticsScore: 91, acceptanceRate: 88, reliabilityScore: 93, completedJobs: 142, createdAt: new Date().toISOString() },
  { _id: "demo-worker-2", name: "Sunita Devi", profession: "Home Cleaning Pro", phone: "+91 92345 67890", status: "verified", isAvailable: true, logisticsScore: 86, acceptanceRate: 82, reliabilityScore: 89, completedJobs: 118, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { _id: "demo-worker-3", name: "Imran Khan", profession: "Electrician", phone: "+91 93456 78901", status: "pending", isAvailable: false, logisticsScore: 67, acceptanceRate: 61, reliabilityScore: 72, completedJobs: 36, createdAt: new Date(Date.now() - 259200000).toISOString() },
];

const demoBookings: Booking[] = [
  { _id: "demo-booking-1", service: "Plumbing Repair", total_price: 799, status: "completed", createdAt: new Date().toISOString() },
  { _id: "demo-booking-2", service: "Deep Home Cleaning", total_price: 1499, status: "in_progress", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { _id: "demo-booking-3", service: "Electrical Inspection", total_price: 599, status: "pending", createdAt: new Date(Date.now() - 7200000).toISOString() },
];

/* ================= COMPONENT ================= */

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { routeMission, routeTab, routeZoneId, toolAction } = useMemo(
    () => getAdminRouteState(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("adminToken"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => routeTab);

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBookings: 0,
    totalWorkers: 0,
    totalRevenue: 0,
    activeBookings: 0,
    completedBookings: 0,
    pendingBookings: 0,
    systemHealth: "healthy",
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [usersList, setUsersList] = useState<any[]>([]);
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [verificationViewerOpen, setVerificationViewerOpen] = useState(false);
  const [verificationViewerUrl, setVerificationViewerUrl] = useState("");
  const [verificationViewerName, setVerificationViewerName] = useState("");
  const [verificationViewerType, setVerificationViewerType] = useState("aadhaar");
  const [verificationViewerLoadingId, setVerificationViewerLoadingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthSnapshot, setHealthSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [channelLatencyMs, setChannelLatencyMs] = useState(42);
  const systemReadyToastShown = useRef(false);


  /* ================= AUTH ================= */

  useEffect(() => {
    setActiveTab(routeTab);
  }, [routeTab]);

  useEffect(() => {
    if (location.pathname === ADMIN_ROUTE_PREFIX || location.pathname === `${ADMIN_ROUTE_PREFIX}/`) {
      navigate(`${ADMIN_ROUTE_PREFIX}/overview`, { replace: true });
      return;
    }

    if (routeMission === "intelligence" && location.pathname === `${ADMIN_ROUTE_PREFIX}/intelligence`) {
      navigate(`${ADMIN_ROUTE_PREFIX}/intelligence/${routeZoneId || DEFAULT_INTELLIGENCE_ZONE}`, { replace: true });
    }
  }, [location.pathname, navigate, routeMission, routeZoneId]);

  const fetchHealthSnapshot = useCallback(async () => {
    const startedAt = performance.now();

    try {
      const res = await fetch(`${API}/health`, { cache: "no-store" });
      if (!res.ok) return null;

      const health = await res.json();
      setHealthSnapshot(health);
      setChannelLatencyMs(Math.max(8, Math.round(performance.now() - startedAt)));
      return health as SystemHealthSnapshot;
    } catch (probeError) {
      console.warn("[AdminDashboard] Health probe failed:", probeError);
      return null;
    }
  }, []);

  useEffect(() => {
    // Check for existing admin session token
    const token = localStorage.getItem("adminToken");
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData();
      void fetchHealthSnapshot();
      
      // Fast polling every 5 seconds for real-time dashboard feel
      const intervalId = setInterval(() => {
        fetchDashboardData(true);
      }, 5000);
      return () => clearInterval(intervalId);
    } else {
      setLoading(false);
    }
  }, [fetchHealthSnapshot]);

  useEffect(() => {
    if (!isAuthenticated || systemReadyToastShown.current) return;

    let cancelled = false;

    const probeSystemReadiness = async () => {
      const health = await fetchHealthSnapshot();
      if (cancelled || !health) return;

      if (health?.status === "ok" && health?.media?.secureUploadsReady === true) {
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

    const intervalId = window.setInterval(() => {
      void fetchHealthSnapshot();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [fetchHealthSnapshot, isAuthenticated]);

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
    body.style.background = "#020617";

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      body.style.background = previousBodyBackground;
    };
  }, []);

  // PRIORITY 1 FIX: Credentials validated SERVER-SIDE via POST /api/auth/admin-login.
  // Admin password no longer lives in the JS bundle as a VITE_ variable.
  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Invalid admin credentials");
        return;
      }
      const { token } = await res.json();
      localStorage.setItem("adminToken", token);
      setIsAuthenticated(true);
      fetchDashboardData();
    } catch (err) {
      setError("Server unreachable. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoBypass = () => {
    localStorage.setItem("adminToken", DEMO_ADMIN_TOKEN);
    localStorage.setItem("adminDemoMode", "true");
    setEmail("demo@rahi.local");
    setIsAuthenticated(true);
    setActiveTab("intelligence");
    navigate(`${ADMIN_ROUTE_PREFIX}/intelligence/${DEFAULT_INTELLIGENCE_ZONE}`);
    loadDemoDashboardData();
  };

  const handleForgotPassword = async () => {
    setError("");
    setRecoveryMessage("");
    setRecoveryLoading(true);

    try {
      const res = await fetch(`${API}/auth/admin-forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRecoveryMessage(data.message || "Enter a valid admin email first.");
        return;
      }

      setRecoveryMessage(data.message || "Recovery request submitted.");
    } catch (err) {
      setRecoveryMessage("Server unreachable. Start the backend and try again.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminDemoMode");
    setIsAuthenticated(false);
  };

  const handleMissionChange = (mission: AdminMission) => {
    if (mission === "overview") {
      navigate(`${ADMIN_ROUTE_PREFIX}/overview`);
      return;
    }

    if (mission === "intelligence") {
      navigate(`${ADMIN_ROUTE_PREFIX}/intelligence/${routeZoneId || DEFAULT_INTELLIGENCE_ZONE}`);
      return;
    }

    navigate(`${ADMIN_ROUTE_PREFIX}/${mission}`);
  };

  const handleToolSelect = (tool: AdminToolAction) => {
    if (tool === "settings") {
      navigate(`${ADMIN_ROUTE_PREFIX}/settings`);
      return;
    }

    navigate(`${ADMIN_ROUTE_PREFIX}/observability?tool=${tool}`);
  };

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);

    if (tab === "overview") {
      navigate(`${ADMIN_ROUTE_PREFIX}/overview`);
      return;
    }

    if (tab === "users" || tab === "bookings") {
      navigate(`${ADMIN_ROUTE_PREFIX}/overview?panel=${tab}`);
      return;
    }

    if (tab === "workers") {
      navigate(`${ADMIN_ROUTE_PREFIX}/workforce`);
      return;
    }

    if (tab === "intelligence" || tab === "heatmap") {
      navigate(`${ADMIN_ROUTE_PREFIX}/intelligence/${routeZoneId || DEFAULT_INTELLIGENCE_ZONE}`);
      return;
    }

    if (tab === "finance") {
      navigate(`${ADMIN_ROUTE_PREFIX}/finance`);
      return;
    }

    if (tab === "bugs") {
      navigate(`${ADMIN_ROUTE_PREFIX}/observability?tool=bug-monitor`);
      return;
    }

    if (tab === "system" || tab === "audit") {
      navigate(`${ADMIN_ROUTE_PREFIX}/observability`);
      return;
    }

    navigate(`${ADMIN_ROUTE_PREFIX}/settings`);
  };

  const handleIntelligenceZoneChange = (zoneId: string) => {
    setActiveTab("intelligence");
    navigate(`${ADMIN_ROUTE_PREFIX}/intelligence/${zoneId}`);
  };

  /* ================= DATA FETCH ================= */

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const token = localStorage.getItem("adminToken");
    if (localStorage.getItem("adminDemoMode") === "true" || token === DEMO_ADMIN_TOKEN) {
      loadDemoDashboardData();
      return;
    }

    const headers = { Authorization: `Bearer ${token}` } as HeadersInit;
    try {
      const [usersRes, bookingsRes, workersRes] = await Promise.all([
        fetch(`${API}/admin/customers`, { headers }),
        fetch(`${API}/admin/bookings`, { headers }),
        fetch(`${API}/admin/workers`, { headers }),
      ]);

      const usersData = await usersRes.json();
      const bookingsData = await bookingsRes.json();
      const workersData = await workersRes.json();
      
      const users = usersData.data || (Array.isArray(usersData) ? usersData : []);
      const bookings: Booking[] = bookingsData.data || (Array.isArray(bookingsData) ? bookingsData : []);
      const workers = workersData.data || (Array.isArray(workersData) ? workersData : []);
      
      setUsersList(users);
      setBookingsList(bookings);
      setWorkersList(workers);

      const completed = bookings.filter(b => b.status === "completed");
      const active = bookings.filter(
        b => b.status === "pending" || b.status === "matched" || b.status === "in_progress"
      );

      const totalRevenue = completed.reduce(
        (sum, b) => sum + Number(b.total_price ?? 0),
        0
      );

      // Generate Chart Data (Last 7 Days)
      const last7Days = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.toDateString(),
          bookings: 0,
          revenue: 0
        };
      });

      bookings.forEach(b => {
        if (!b.createdAt && !b.date) return;
        const bDate = new Date((b.createdAt || b.date) as string).toDateString();
        const dayMatch = last7Days.find(d => d.date === bDate);
        if (dayMatch) {
          dayMatch.bookings++;
          if (b.status === 'completed' && b.total_price) {
            dayMatch.revenue += Number(b.total_price);
          }
        }
      });
      setChartData(last7Days);

      // Generate Live Operations Log
      const recentActivities: any[] = [];
      const sortedBookings = [...bookings].sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()).slice(0, 3);
      sortedBookings.forEach((b: any) => {
        recentActivities.push({
          type: 'booking',
          msg: `Booking ${b.service || 'Service'} is ${b.status}`,
          time: new Date(b.createdAt || Date.now()).toLocaleTimeString(),
          role: 'Operations'
        });
      });
      const sortedUsers = [...users].sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()).slice(0, 2);
      sortedUsers.forEach((u: any) => {
        recentActivities.push({
          type: 'user',
          msg: `New user joined: ${u.name || u.phone}`,
          time: new Date(u.createdAt || Date.now()).toLocaleTimeString(),
          role: 'Growth'
        });
      });
      setActivities(recentActivities.sort((a,b) => b.time.localeCompare(a.time)));

      setStats({
        totalUsers: users.length,
        totalBookings: bookings.length,
        totalWorkers: workers.length,
        totalRevenue,
        activeBookings: active.length,
        completedBookings: completed.length,
        pendingBookings:
          bookings.length - completed.length - active.length,
        systemHealth: "healthy",
      });
    } catch (err) {
      console.error(err);
      setStats(prev => ({ ...prev, systemHealth: "critical" }));
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const loadDemoDashboardData = () => {
    const completed = demoBookings.filter((booking) => booking.status === "completed");
    const active = demoBookings.filter(
      (booking) => booking.status === "pending" || booking.status === "matched" || booking.status === "in_progress"
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
  };

  const handleViewVerificationDocument = async (worker: any, type: "aadhaar" | "pan" = "aadhaar") => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setError("Admin session expired. Please log in again.");
      return;
    }

    setVerificationViewerLoadingId(`${worker._id}:${type}`);
    try {
      const res = await fetch(`${API}/admin/workers/${worker._id}/verification-document?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load verification document");
      }

      setVerificationViewerUrl(data.url);
      setVerificationViewerName(worker.name || "Worker");
      setVerificationViewerType(type);
      setVerificationViewerOpen(true);
    } catch (err: any) {
      setError(err.message || "Failed to load verification document");
    } finally {
      setVerificationViewerLoadingId(null);
    }
  };

  const zoneLabel = useMemo(() => (
    sectorLabelById(routeZoneId || "agra-cantt")
  ), [routeZoneId]);

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
    return Math.round(completed.reduce((sum, booking) => sum + Number(booking.total_price ?? 0), 0) / completed.length);
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
  const serviceRevenueData = useMemo(() => {
    const aggregated = bookingsList
      .filter((booking) => booking.status === "completed")
      .reduce<Record<string, number>>((accumulator, booking) => {
        const label = booking.service || "General";
        accumulator[label] = (accumulator[label] || 0) + Number(booking.total_price ?? 0);
        return accumulator;
      }, {});

    return Object.entries(aggregated)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);
  }, [bookingsList]);
  const healthRows = useMemo(() => ([
    {
      label: "Database Cluster",
      value: healthSnapshot?.database === "connected" ? "LOCKED" : "DEGRADED",
      tone: healthSnapshot?.database === "connected" ? "emerald" : "amber",
    },
    {
      label: "Secure Upload Rail",
      value: healthSnapshot?.media?.secureUploadsReady ? "ONLINE" : "FALLBACK",
      tone: healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber",
    },
    {
      label: "Cloud Brain",
      value: llmMode === "ready" ? "READY" : "FALLBACK",
      tone: llmMode === "ready" ? "emerald" : "amber",
    },
    {
      label: "Deploy Branch",
      value: String(healthSnapshot?.deployment?.branch || "main").toUpperCase(),
      tone: "indigo" as const,
    },
  ]), [healthSnapshot?.database, healthSnapshot?.deployment?.branch, healthSnapshot?.media?.secureUploadsReady, llmMode]);

  const userColumns = useMemo(() => ([
    { key: "name", label: "Callsign", render: (value: string) => <span className="font-mono text-slate-100">{value || "UNNAMED"}</span> },
    { key: "email", label: "Identity", render: (value: string) => <span className="font-mono text-slate-300">{value || "N/A"}</span> },
    { key: "phone", label: "Channel", render: (value: string) => <span className="font-mono text-slate-400">{value || "--"}</span> },
    { key: "createdAt", label: "Joined", render: (value: string) => <span className="font-mono text-slate-500">{value ? new Date(value).toLocaleDateString() : "--"}</span> },
  ]), []);

  const workerColumns = useMemo(() => ([
    { key: "name", label: "Operator", render: (value: string) => <span className="font-mono text-slate-100">{value || "UNASSIGNED"}</span> },
    { key: "profession", label: "Role", render: (value: string) => <span className="font-mono text-slate-300">{value || "General Ops"}</span> },
    {
      key: "logisticsScore",
      label: "Trust",
      render: (value: number, row: any) => (
        <span className={cn(
          "font-mono font-black",
          Number(value || 0) >= 85 ? "text-emerald-300" : Number(value || 0) >= 70 ? "text-amber-300" : "text-rose-300",
        )}
        >
          {Math.round(Number(value || row.reliabilityScore || 0))}%
        </span>
      ),
    },
    {
      key: "isAvailable",
      label: "Lane",
      render: (value: boolean) => (
        <span className={cn(
          "inline-flex rounded-full border px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em]",
          value ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200",
        )}
        >
          {value ? "ACTIVE" : "BUSY"}
        </span>
      ),
    },
    {
      key: "verificationDocument",
      label: "Audit",
      render: (_value: unknown, row: any) => {
        const hasAadhaar = Boolean(row?.aadhaar?.public_id || row?.aadhaar?.url || row?.aadhaar_url);
        return hasAadhaar ? (
          <button
            type="button"
            onClick={() => handleViewVerificationDocument(row, "aadhaar")}
            disabled={verificationViewerLoadingId === `${row._id}:aadhaar`}
            className="rounded-full border border-indigo-400/25 bg-indigo-400/12 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-indigo-100 transition hover:border-indigo-300/45 hover:text-white disabled:opacity-60"
          >
            {verificationViewerLoadingId === `${row._id}:aadhaar` ? "SYNCING" : "OPEN"}
          </button>
        ) : (
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">PENDING</span>
        );
      },
    },
  ]), [handleViewVerificationDocument, verificationViewerLoadingId]);

  const bookingColumns = useMemo(() => ([
    { key: "service", label: "Task", render: (value: string) => <span className="font-mono text-slate-100">{value || "General Service"}</span> },
    { key: "total_price", label: "Value", render: (value: number | string) => <span className="font-mono text-emerald-300">INR {Number(value || 0).toLocaleString("en-IN")}</span> },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <span className={cn(
          "inline-flex rounded-full border px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em]",
          value === "completed" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
          value === "pending" && "border-amber-400/30 bg-amber-400/10 text-amber-200",
          (value === "matched" || value === "in_progress") && "border-indigo-400/30 bg-indigo-400/10 text-indigo-100",
        )}
        >
          {String(value || "pending").replace("_", " ")}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Stamp",
      render: (value: string) => <span className="font-mono text-slate-500">{value ? new Date(value).toLocaleTimeString() : "--"}</span>,
    },
  ]), []);

  const activeDockPanel = useMemo(() => {
    if (activeTab === "users") {
      return (
        <DataTable
          title="USER DIRECTORY"
          description="Identity rails and onboarding flow from the active theater."
          columns={userColumns}
          data={usersList.slice(0, 8)}
          loading={loading}
          variant="hud"
          hideFooter
          viewportClassName="max-h-[calc(100vh-19rem)] overflow-auto"
        />
      );
    }

    if (activeTab === "workers") {
      return (
        <DataTable
          title="WORKER FLEET"
          description="Live operator trust and verification posture."
          columns={workerColumns}
          data={workersList.slice(0, 8)}
          loading={loading}
          variant="hud"
          hideFooter
          viewportClassName="max-h-[calc(100vh-19rem)] overflow-auto"
        />
      );
    }

    if (activeTab === "bookings") {
      return (
        <DataTable
          title="ORDER STREAM"
          description="Current task queue aligned to the Agra command radius."
          columns={bookingColumns}
          data={bookingsList.slice(0, 10)}
          loading={loading}
          variant="hud"
          hideFooter
          viewportClassName="max-h-[calc(100vh-19rem)] overflow-auto"
        />
      );
    }

    if (activeTab === "finance") {
      return (
        <div className="space-y-4">
          <HudBlock title="FINANCIAL CLARITY" eyebrow="MARGIN DEFENSE" icon={DollarSign}>
            <div className="grid gap-3 sm:grid-cols-2">
              <HudMetric label="Gross Volume" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="emerald" />
              <HudMetric label="Pending Payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
              <HudMetric label="Avg Ticket" value={`INR ${averageTicket.toLocaleString("en-IN")}`} tone="indigo" />
              <HudMetric label="Platform Share" value={`INR ${Math.round(stats.totalRevenue * 0.08).toLocaleString("en-IN")}`} tone="sky" />
            </div>
          </HudBlock>
          <HudBlock title="TOP SERVICE YIELD" eyebrow="SETTLEMENT MIX" icon={WalletCards}>
            <div className="space-y-3">
              {serviceRevenueData.length === 0 ? (
                <p className="font-mono text-xs text-slate-500">No completed settlements have cleared yet.</p>
              ) : serviceRevenueData.map((service) => (
                <SignalBar
                  key={service.label}
                  label={service.label}
                  value={`INR ${service.value.toLocaleString("en-IN")}`}
                  fill={Math.min(100, Math.round((service.value / Math.max(serviceRevenueData[0]?.value || 1, 1)) * 100))}
                  tone="emerald"
                />
              ))}
            </div>
          </HudBlock>
        </div>
      );
    }

    if (activeTab === "heatmap") {
      return (
        <div className="space-y-4">
          <HudBlock title="HEAT ORBIT" eyebrow="400K LOAD SURFACE" icon={Activity}>
            <p className="font-mono text-sm leading-6 text-slate-300">
              The map base is now the heatmap. Satellite imagery stays dimmed while Indigo demand plumes and Amber competitor pressure remain visible without obscuring the theater.
            </p>
          </HudBlock>
          <HudBlock title="THEATER LEGEND" eyebrow="READ BEFORE SCRUB" icon={MapPin}>
            <div className="space-y-3">
              <LegendLine color="bg-indigo-400" label="RAHI density plume" />
              <LegendLine color="bg-emerald-400" label="Active worker reticle" />
              <LegendLine color="bg-amber-400" label="Contested / surge lane" />
              <LegendLine color="bg-slate-500" label="Stable operational perimeter" />
            </div>
          </HudBlock>
        </div>
      );
    }

    if (activeTab === "system") {
      return (
        <div className="space-y-4">
          <HudBlock title="SYSTEM HEALTH" eyebrow="INFRASTRUCTURE RAILS" icon={Server}>
            <div className="space-y-3">
              {healthRows.map((row) => (
                <StatusLine key={row.label} label={row.label} value={row.value} tone={row.tone as HudTone} />
              ))}
            </div>
          </HudBlock>
          <HudBlock title="CLOUD ENGINE" eyebrow="RUNTIME STATUS" icon={BrainCircuit}>
            <p className={cn(
              "font-mono text-sm leading-6",
              llmMode === "ready" ? "text-emerald-200" : "text-amber-200",
            )}>
              {llmSummary}
            </p>
          </HudBlock>
        </div>
      );
    }

    if (activeTab === "bugs") {
      return (
        <div className="space-y-3">
          {[
            "Price war alert feed and Delhi market-entry console are now active.",
            "OTP trust path remains locked behind proof + verification gates.",
            "Provider cascade will fall through to Groq before local rule engine.",
          ].map((message, index) => (
            <HudLogEntry key={message} tone={index === 2 ? "amber" : "rose"} tag={index === 2 ? "RUNTIME" : "ALERT"} message={message} />
          ))}
        </div>
      );
    }

    if (activeTab === "intelligence") {
      return (
        <div className="space-y-4">
          <HudBlock title="MISSION CONTROL" eyebrow="GLOBAL OPS" icon={Radar}>
            <p className="font-mono text-sm leading-6 text-slate-300">
              {zoneLabel} is the active command pin. The hero map is handling load heat, operator trust, and pressure streams while the right dock keeps the steering brief live.
            </p>
          </HudBlock>
          <HudBlock title="NEXT PLAY" eyebrow="KEYNOTE READY" icon={Globe2}>
            <div className="space-y-3">
              <StatusLine label="Current Theater" value={zoneLabel.toUpperCase()} tone="indigo" />
              <StatusLine label="Cloud Brain" value={llmMode === "ready" ? "ONLINE" : "FALLBACK"} tone={llmMode === "ready" ? "emerald" : "amber"} />
              <StatusLine label="Market Mode" value="TRUST OVER PRICE" tone="amber" />
            </div>
          </HudBlock>
        </div>
      );
    }

    if (activeTab === "audit") {
      return (
        <HudBlock title="AUDIT SURFACE" eyebrow="TRUST DEFENSE" icon={FileLock2}>
          <p className="font-mono text-sm leading-6 text-slate-300">
            Verified proof, signed media URLs, and operator-level verification are all live. Use the map reticles to inspect workers and keep audit coverage visible during the investor walkthrough.
          </p>
        </HudBlock>
      );
    }

    if (activeTab === "settings") {
      return (
        <HudBlock title="SETTINGS DOCK" eyebrow="PRIME SHELL" icon={BarChart3}>
          <p className="font-mono text-sm leading-6 text-slate-300">
            The mission shell is locked to the viewport, tuned for a dark-matter theater, and polling live system health every 15 seconds.
          </p>
        </HudBlock>
      );
    }

    return (
      <div className="space-y-4">
        <HudBlock title="RAHI THEATER" eyebrow="LIVE STEERING" icon={Radar}>
          <div className="grid gap-3 sm:grid-cols-2">
            <HudMetric label="Users" value={stats.totalUsers.toLocaleString("en-IN")} tone="sky" />
            <HudMetric label="Bookings" value={stats.totalBookings.toLocaleString("en-IN")} tone="indigo" />
            <HudMetric label="Workers" value={stats.totalWorkers.toLocaleString("en-IN")} tone="emerald" />
            <HudMetric label="Completed" value={stats.completedBookings.toLocaleString("en-IN")} tone="amber" />
          </div>
        </HudBlock>
        <HudBlock title="ACTIVITY SPINE" eyebrow="NO SCROLL HQ" icon={Activity}>
          <div className="space-y-3">
            {activities.slice(0, 4).map((entry) => (
              <HudLogEntry
                key={`${entry.msg}-${entry.time}`}
                tone={entry.type === "booking" ? "indigo" : "emerald"}
                tag={entry.role || "OPS"}
                message={`${entry.msg} @ ${entry.time}`}
              />
            ))}
          </div>
        </HudBlock>
      </div>
    );
  }, [
    activeTab,
    averageTicket,
    bookingColumns,
    bookingsList,
    healthRows,
    llmMode,
    llmSummary,
    loading,
    pendingPayouts,
    serviceRevenueData,
    stats.completedBookings,
    stats.totalBookings,
    stats.totalRevenue,
    stats.totalUsers,
    stats.totalWorkers,
    usersList,
    userColumns,
    workerColumns,
    workersList,
    zoneLabel,
    activities,
    handleViewVerificationDocument,
    verificationViewerLoadingId,
  ]);

  const topOperators = useMemo(
    () => [...workersList]
      .sort((left, right) => Number(right.logisticsScore || right.reliabilityScore || 0) - Number(left.logisticsScore || left.reliabilityScore || 0))
      .slice(0, 4),
    [workersList],
  );

  const verificationCoverage = useMemo(() => {
    if (workersList.length === 0) return 0;
    const covered = workersList.filter((worker) => (
      Boolean(worker?.aadhaar?.public_id || worker?.aadhaar?.url || worker?.aadhaar_url)
    )).length;
    return Math.round((covered / workersList.length) * 100);
  }, [workersList]);

  const missionMeta = useMemo(() => {
    if (routeMission === "intelligence") {
      return {
        eyebrow: "LOGISTICS_CORE_AUDIT [STRICT_PERSISTENCE]",
        title: "War Room",
        copy: llmMode === "ready"
          ? `Density simulation, strategy logic, and geo-recalibration are armed for ${zoneLabel}.`
          : `Cloud cognition is degraded, but fallback strategy rails still cover ${zoneLabel}.`,
        chip: zoneLabel,
      };
    }

    if (routeMission === "workforce") {
      return {
        eyebrow: "WORKFORCE_COMMAND [VERIFIED_FLEET]",
        title: "Workforce Theater",
        copy: `Operator trust, availability, and proof coverage are now isolated from the strategy stack so staffing decisions stay readable.`,
        chip: `${activeWorkerRate}% active`,
      };
    }

    if (routeMission === "finance") {
      return {
        eyebrow: "FINANCIAL_COMMAND [UNIT_ECONOMICS]",
        title: "Finance Theater",
        copy: `Revenue posture, payout exposure, and margin defense are separated from map pressure so the burn story stays crisp for investors.`,
        chip: `INR ${stats.totalRevenue.toLocaleString("en-IN")}`,
      };
    }

    if (routeMission === "observability") {
      return {
        eyebrow: "OBSERVABILITY_OS [SOURCE_OF_TRUTH]",
        title: "Engine Room",
        copy: `Infrastructure, application performance, digital experience, and incident telemetry now live in one dedicated reliability surface.`,
        chip: toolAction === "bug-monitor" ? "Bug Monitor" : "System Green",
      };
    }

    if (routeMission === "settings") {
      return {
        eyebrow: "CONTROL_SURFACE [SYSTEM_POLICY]",
        title: "Settings",
        copy: `Shell governance, security posture, and admin access controls are broken out from the operational theaters.`,
        chip: "Admin Policy",
      };
    }

    return {
      eyebrow: "GLOBAL_PULSE [ROUTE_COMMAND]",
      title: "Overview",
      copy: `Bird's-eye metrics, live feed, and quick pivots now sit in a clean command hub instead of sharing space with the map.`,
      chip: "Hub",
    };
  }, [activeWorkerRate, llmMode, routeMission, stats.totalRevenue, toolAction, zoneLabel]);

  const routeCommandContent = useMemo(() => {
    if (routeMission === "overview") {
      return (
        <div className="mission-scrollbar h-full overflow-y-auto pr-1">
          <OverviewTab
            stats={stats}
            loading={loading}
            setActiveTab={handleTabChange}
            chartData={chartData}
            activities={activities}
          />
        </div>
      );
    }

    if (routeMission === "workforce") {
      return (
        <div className="mission-scrollbar h-full overflow-y-auto pr-1">
          <div className="space-y-4">
            <DataTable
              title="WORKFORCE ROSTER"
              description="Operator readiness, verification coverage, and trust scoring in one dedicated staffing theater."
              columns={workerColumns}
              data={workersList}
              loading={loading}
              variant="hud"
              viewportClassName="max-h-[30rem] overflow-auto"
            />
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <DataTable
                title="CUSTOMER INTAKE"
                description="New users entering the network."
                columns={userColumns}
                data={usersList.slice(0, 8)}
                loading={loading}
                variant="hud"
                hideFooter
                viewportClassName="max-h-[20rem] overflow-auto"
              />
              <DataTable
                title="ASSIGNMENT QUEUE"
                description="Jobs that will pressure workforce quality next."
                columns={bookingColumns}
                data={bookingsList.slice(0, 8)}
                loading={loading}
                variant="hud"
                hideFooter
                viewportClassName="max-h-[20rem] overflow-auto"
              />
            </div>
          </div>
        </div>
      );
    }

    if (routeMission === "finance") {
      return (
        <div className="mission-scrollbar h-full overflow-y-auto pr-1">
          <FinanceTab revenue={stats.totalRevenue} bookings={bookingsList} />
        </div>
      );
    }

    if (routeMission === "observability") {
      return (
        <div className="mission-scrollbar h-full overflow-y-auto pr-1">
          <SystemTab
            healthSnapshot={healthSnapshot}
            channelLatencyMs={channelLatencyMs}
            activeWorkerRate={activeWorkerRate}
            zoneLabel={zoneLabel}
          />
        </div>
      );
    }

    if (routeMission === "settings") {
      return (
        <div className="mission-scrollbar h-full overflow-y-auto pr-1">
          <div className="grid gap-4 xl:grid-cols-2">
            <HudBlock title="ACCESS GOVERNANCE" eyebrow="ADMIN POLICY" icon={ShieldCheck}>
              <div className="space-y-3">
                <StatusLine label="Session mode" value={localStorage.getItem("adminDemoMode") === "true" ? "DEMO" : "LIVE"} tone="indigo" />
                <StatusLine label="Document previews" value="SIGNED URL ONLY" tone="emerald" />
                <StatusLine label="Universal OTP guard" value="PHOTO LOCKED" tone="amber" />
                <StatusLine label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "ONLINE" : "FALLBACK"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
              </div>
            </HudBlock>
            <HudBlock title="CONTROL NOTES" eyebrow="OPERATOR MANUAL" icon={BarChart3}>
              <div className="space-y-3">
                <HudLogEntry tag="SHELL" tone="indigo" message="Route-based missions are active. The map only mounts inside the intelligence route." />
                <HudLogEntry tag="SECURITY" tone="emerald" message="Proof-photo gating and signed verification documents remain enforced in the worker trust path." />
                <HudLogEntry tag="DEPLOY" tone="sky" message={`Current branch ${String(healthSnapshot?.deployment?.branch || "main").toUpperCase()} is serving commit ${healthSnapshot?.deployment?.commit?.slice(0, 7) || "SYNCING"}.`} />
              </div>
            </HudBlock>
          </div>
        </div>
      );
    }

    return null;
  }, [
    activeWorkerRate,
    activities,
    bookingColumns,
    bookingsList,
    channelLatencyMs,
    chartData,
    handleTabChange,
    healthSnapshot,
    loading,
    routeMission,
    stats,
    userColumns,
    usersList,
    workerColumns,
    workersList,
    zoneLabel,
  ]);

  const activeAuditSurface = useMemo(() => {
    if (activeTab === "overview") {
      return (
        <OverviewTab
          stats={stats}
          loading={loading}
          setActiveTab={handleTabChange}
          chartData={chartData}
          activities={activities}
        />
      );
    }

    if (activeTab === "finance") {
      return <FinanceTab revenue={stats.totalRevenue} bookings={bookingsList} />;
    }

    if (activeTab === "heatmap") {
      return (
        <HeatmapTab
          token={localStorage.getItem("adminToken") || ""}
          embeddedMap={false}
        />
      );
    }

    if (activeTab === "intelligence") {
      return (
        <IntelligenceTab
          routeZoneId={routeZoneId || "agra-cantt"}
          onZoneChange={handleIntelligenceZoneChange}
        />
      );
    }

    if (activeTab === "system") {
      return (
        <SystemTab
          healthSnapshot={healthSnapshot}
          channelLatencyMs={channelLatencyMs}
          activeWorkerRate={activeWorkerRate}
          zoneLabel={zoneLabel}
        />
      );
    }

    if (activeTab === "bugs") {
      return <BugsTab />;
    }

    return null;
  }, [
    activeTab,
    activities,
    bookingsList,
    chartData,
    channelLatencyMs,
    handleTabChange,
    healthSnapshot,
    loading,
    routeZoneId,
    stats,
    zoneLabel,
    activeWorkerRate,
  ]);

  const routeDockTitle = useMemo(() => {
    if (routeMission === "overview") {
      return activeTab === "users" ? "User Directory" : activeTab === "bookings" ? "Order Stream" : "Live Feed";
    }
    if (routeMission === "workforce") return "Workforce Intel";
    if (routeMission === "finance") return "Margin Defense";
    if (routeMission === "observability") {
      if (toolAction === "bug-monitor") return "Bug Monitor";
      if (toolAction === "database-status") return "Database Status";
      if (toolAction === "api-telemetry") return "API Telemetry";
      return "Engine Toolkit";
    }
    return "Settings Dock";
  }, [activeTab, routeMission, toolAction]);

  const routeDockContent = useMemo(() => {
    if (routeMission === "overview" || routeMission === "finance") {
      return activeDockPanel;
    }

    if (routeMission === "workforce") {
      return (
        <div className="space-y-4">
          <HudBlock title="FLEET POSTURE" eyebrow="QUALITY + READINESS" icon={UsersRound}>
            <div className="grid gap-3 sm:grid-cols-2">
              <HudMetric label="Active workers" value={activeWorkersCount.toLocaleString("en-IN")} tone="emerald" />
              <HudMetric label="Coverage" value={`${verificationCoverage}%`} tone="indigo" />
              <HudMetric label="Live bookings" value={stats.activeBookings.toLocaleString("en-IN")} tone="amber" />
              <HudMetric label="Resolved jobs" value={stats.completedBookings.toLocaleString("en-IN")} tone="sky" />
            </div>
          </HudBlock>
          <HudBlock title="TOP OPERATORS" eyebrow="RELIABILITY SPINE" icon={ShieldCheck}>
            <div className="space-y-3">
              {topOperators.length === 0 ? (
                <p className="font-mono text-xs text-slate-500">No operator telemetry is available yet.</p>
              ) : topOperators.map((worker) => (
                <SignalBar
                  key={worker._id}
                  label={worker.name || "Operator"}
                  value={`${Math.round(Number(worker.logisticsScore || worker.reliabilityScore || 0))}%`}
                  fill={Math.round(Number(worker.logisticsScore || worker.reliabilityScore || 0))}
                  tone="emerald"
                />
              ))}
            </div>
          </HudBlock>
        </div>
      );
    }

    if (routeMission === "observability") {
      return (
        <div className="space-y-4">
          <HudBlock title="TOOL FOCUS" eyebrow="SYSTEM MENU" icon={Server}>
            <div className="space-y-3">
              <StatusLine label="Active tool" value={routeDockTitle.toUpperCase()} tone="indigo" />
              <StatusLine label="Provider rail" value={String(healthSnapshot?.llm?.primaryProvider || "GROQ").toUpperCase()} tone="sky" />
              <StatusLine label="Database" value={healthSnapshot?.database === "connected" ? "CONNECTED" : "WATCH"} tone={healthSnapshot?.database === "connected" ? "emerald" : "amber"} />
              <StatusLine label="Secure media" value={healthSnapshot?.media?.secureUploadsReady ? "TRUSTED" : "FALLBACK"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
            </div>
          </HudBlock>
          <BugsTab />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <HudBlock title="SYSTEM TOOLS" eyebrow="PREFERENCES" icon={Settings}>
          <div className="space-y-3">
            <StatusLine label="Route shell" value="MICRO-SYSTEM" tone="indigo" />
            <StatusLine label="Rendering mode" value="DOCKED BENTO" tone="sky" />
            <StatusLine label="Demo readiness" value={healthSnapshot?.status === "ok" ? "GREEN" : "WATCH"} tone={healthSnapshot?.status === "ok" ? "emerald" : "amber"} />
          </div>
        </HudBlock>
      </div>
    );
  }, [
    activeDockPanel,
    activeWorkersCount,
    healthSnapshot,
    routeDockTitle,
    routeMission,
    stats.activeBookings,
    stats.completedBookings,
    topOperators,
    verificationCoverage,
  ]);

  const routeAuditRail = useMemo(() => {
    if (routeMission === "overview" || routeMission === "finance" || routeMission === "workforce") {
      return (
        <div className="grid h-full gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
            <div className="border-b border-slate-800/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                    LOGISTICS_CORE_AUDIT
                  </p>
                  <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                    STRICT_PERSISTENCE
                  </h3>
                </div>
                <div className="rounded-full border border-slate-800 bg-slate-900/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {routeMission === "workforce" ? "Proof Vault" : llmMode === "ready" ? "Cloud Brain" : "Fallback Engine"}
                </div>
              </div>
            </div>

            <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {activities.slice(0, 5).map((entry, index) => (
                  <HudLogEntry
                    key={`${entry.msg}-${entry.time}-${index}`}
                    tone={entry.type === "booking" ? "indigo" : "emerald"}
                    tag={entry.role || "OPS"}
                    message={`${entry.msg} // ${entry.time}`}
                  />
                ))}
                <HudLogEntry
                  tone={llmMode === "ready" ? "emerald" : "amber"}
                  tag="ENGINE"
                  message={llmMode === "ready" ? llmSummary : "Cloud engine degraded. Fallback cognition path is active."}
                />
                {(error || stats.systemHealth === "critical") ? (
                  <HudLogEntry
                    tone="rose"
                    tag="ALERT"
                    message={error || "Realtime ingestion rail reported a critical health event."}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
            <div className="border-b border-slate-800/80 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Business Health
                  </p>
                  <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                    Tactical Readout
                  </h3>
                </div>
                <div className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]",
                  error || llmMode !== "ready"
                    ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
                    : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                )}>
                  {error || llmMode !== "ready" ? (
                    <TriangleAlert className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  {error || llmMode !== "ready" ? "Watch posture" : "System green"}
                </div>
              </div>
            </div>

            <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <HudMetric label="Settled Revenue" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="emerald" />
                <HudMetric label="Pending Payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
                <HudMetric label="7D Flow" value={`${sevenDayBookings.toLocaleString("en-IN")} jobs`} tone="indigo" />
                <HudMetric label="7D Revenue" value={`INR ${sevenDayRevenue.toLocaleString("en-IN")}`} tone="sky" />
              </div>

              <div className="mt-4 space-y-3">
                <StatusLine label="Queue velocity" value={bookingTrendDelta >= 0 ? `+${bookingTrendDelta}` : String(bookingTrendDelta)} tone="indigo" />
                <StatusLine label="Average ticket" value={`INR ${averageTicket.toLocaleString("en-IN")}`} tone="emerald" />
                <StatusLine label="Verification coverage" value={`${verificationCoverage}%`} tone={verificationCoverage >= 75 ? "emerald" : "amber"} />
                <StatusLine label="Deploy branch" value={String(healthSnapshot?.deployment?.branch || "main").toUpperCase()} tone="sky" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (routeMission === "observability") {
      return (
        <div className="grid h-full gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
            <div className="border-b border-slate-800/80 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">API Telemetry</p>
              <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">Latency + Health Rails</h3>
            </div>
            <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                <StatusLine label="Realtime latency" value={`${channelLatencyMs}ms`} tone={channelLatencyMs <= 60 ? "sky" : "amber"} />
                <StatusLine label="AI mode" value={llmMode === "ready" ? "LIVE" : "FALLBACK"} tone={llmMode === "ready" ? "emerald" : "amber"} />
                <StatusLine label="Provider" value={String(healthSnapshot?.llm?.primaryProvider || "GROQ").toUpperCase()} tone="indigo" />
                <StatusLine label="Zone lens" value={zoneLabel.toUpperCase()} tone="sky" />
              </div>
            </div>
          </div>

          <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
            <div className="border-b border-slate-800/80 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Database Status</p>
              <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">Persistence + Media Mesh</h3>
            </div>
            <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                <StatusLine label="Database" value={healthSnapshot?.database === "connected" ? "CONNECTED" : "WATCH"} tone={healthSnapshot?.database === "connected" ? "emerald" : "amber"} />
                <StatusLine label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "READY" : "FALLBACK"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
                <StatusLine label="Media provider" value={String(healthSnapshot?.media?.provider || "CLOUDINARY").toUpperCase()} tone="indigo" />
                <StatusLine label="Branch" value={String(healthSnapshot?.deployment?.branch || "main").toUpperCase()} tone="sky" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid h-full gap-4 lg:grid-cols-2">
        <HudBlock title="SHELL STATUS" eyebrow="ROUTE GOVERNANCE" icon={ShieldCheck}>
          <div className="space-y-3">
            <StatusLine label="Mission shell" value="DISTRIBUTED" tone="indigo" />
            <StatusLine label="Map mounting" value="INTELLIGENCE ONLY" tone="sky" />
            <StatusLine label="Health probe" value={healthSnapshot?.status === "ok" ? "GREEN" : "WATCH"} tone={healthSnapshot?.status === "ok" ? "emerald" : "amber"} />
          </div>
        </HudBlock>
        <HudBlock title="SECURITY NOTE" eyebrow="TRUST RAILS" icon={FileLock2}>
          <div className="space-y-3">
            <HudLogEntry tag="OTP" tone="amber" message="Universal OTP remains gated behind proof-photo capture in the worker flow." />
            <HudLogEntry tag="DOCS" tone="emerald" message="Verification documents are still delivered through signed URLs only." />
          </div>
        </HudBlock>
      </div>
    );
  }, [
    activities,
    averageTicket,
    bookingTrendDelta,
    channelLatencyMs,
    error,
    healthSnapshot,
    llmMode,
    llmSummary,
    pendingPayouts,
    routeMission,
    sevenDayBookings,
    sevenDayRevenue,
    stats.systemHealth,
    stats.totalRevenue,
    verificationCoverage,
    zoneLabel,
  ]);

  /* ================= LOGIN UI ================= */

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#07111f] p-4 text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8%] top-[10%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-6%] h-[28rem] w-[28rem] rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/40 to-transparent" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="px-2 py-8 md:px-6">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">
              <BarChart3 className="h-4 w-4" />
              RAHI Density Intelligence
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-tight md:text-7xl">
              The operating brain for RAHI's workforce density.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300">
              This console proves how RAHI can forecast demand, calculate area density, and decide where salaried workers protect service quality versus where freelancers reduce burn.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Formula</p>
                <p className="mt-4 text-2xl font-black">Orders / Workers</p>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-400">The density score behind every allocation decision.</p>
              </div>
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/70">High density</p>
                <p className="mt-4 text-2xl font-black text-emerald-100">Salaried Core</p>
                <p className="mt-2 text-xs font-bold leading-5 text-emerald-100/70">Reliability first in high-volume zones.</p>
              </div>
              <div className="rounded-3xl border border-sky-300/20 bg-sky-300/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-200/70">Low density</p>
                <p className="mt-4 text-2xl font-black text-sky-100">Freelancer Pool</p>
                <p className="mt-2 text-xs font-bold leading-5 text-sky-100/70">Lower fixed burn while demand matures.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#101827]/95 p-6 shadow-2xl shadow-black/40 md:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Secure admin access</p>
                <h2 className="mt-3 text-3xl font-black text-white">Open the intelligence console</h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                <ShieldCheck className="h-7 w-7" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleDemoBypass}
              className="mb-6 w-full rounded-2xl border border-emerald-300/25 bg-emerald-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-200"
            >
              Open Demo Density Console
            </button>

            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-black text-white">What the demo shows</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                A density-first dashboard with forecast demand, active worker supply, salaried/freelancer ratio, and investor-ready operating logic.
              </p>
            </div>

            <div className="relative my-6 flex items-center">
              <div className="h-px flex-1 bg-white/10" />
              <span className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">or use live admin</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Authorized emails
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ADMIN_EMAIL_OPTIONS.map((adminEmail) => (
                  <button
                    key={adminEmail}
                    type="button"
                    onClick={() => setEmail(adminEmail)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                      email === adminEmail
                        ? "border-emerald-300 bg-emerald-300/10 text-emerald-100"
                        : "border-white/10 bg-slate-950/30 text-slate-300 hover:border-white/25 hover:bg-white/10",
                    )}
                  >
                    {adminEmail}
                  </button>
                ))}
              </div>
            </div>

            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Admin email
            </label>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-emerald-300">
              <Mail className="h-5 w-5 text-slate-500" />
              <input
                className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                placeholder="admin@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword((value) => !value);
                  setRecoveryMessage("");
                }}
                className="text-xs font-bold text-emerald-200 hover:text-white"
              >
                Forgot password?
              </button>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-emerald-300">
              <KeyRound className="h-5 w-5 text-slate-500" />
              <input
                type="password"
                className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            {showForgotPassword && (
              <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                <p className="text-sm font-semibold text-amber-100">Password recovery</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/75">
                  Submit the admin email. For security, rotate the backend ADMIN_PASSWORD rather than exposing it in the browser.
                </p>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={recoveryLoading || !email.trim()}
                  className="mt-3 rounded-xl bg-amber-200 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {recoveryLoading ? "Sending request..." : "Send recovery request"}
                </button>
                {recoveryMessage && (
                  <p className="mt-3 text-xs font-semibold text-amber-50">{recoveryMessage}</p>
                )}
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-center text-sm font-bold text-red-200">
                {error}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 font-bold text-white transition hover:bg-white/15 disabled:bg-slate-700 disabled:text-slate-400"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {loading ? "Checking access..." : "Login with live backend"} <ChevronRight size={18} />
              </span>
            </button>
          </section>
        </div>
      </div>
    );
  }

  /* ================= DASHBOARD ================= */

  return (
    <div className="mission-control-shell fixed inset-0 isolate overflow-hidden bg-[#020617] text-slate-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');

        html, body, #root {
          height: 100%;
          overflow: hidden;
        }

        .mission-control-shell {
          font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar {
          width: 10px;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.48);
          border-radius: 999px;
        }

        .mission-control-shell .mission-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(99, 102, 241, 0.72), rgba(16, 185, 129, 0.56));
          border-radius: 999px;
          border: 2px solid rgba(2, 6, 23, 0.72);
        }

        .mission-control-shell .mission-grid {
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.28) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.28) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(circle at center, rgba(255,255,255,0.9), transparent 88%);
        }

        .mission-layout {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "top_hud"
            "command_theater"
            "intel_dock"
            "audit_rail";
          grid-template-rows: auto minmax(20rem, 1fr) minmax(18rem, auto) minmax(16rem, auto);
        }

        .mission-layout--intelligence {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "top_hud"
            "command_theater";
          grid-template-rows: auto minmax(0, 1fr);
        }

        .mission-cell-sidebar { grid-area: sidebar; }
        .mission-cell-top { grid-area: top_hud; }
        .mission-cell-theater { grid-area: command_theater; min-height: 0; }
        .mission-cell-dock { grid-area: intel_dock; min-height: 0; }
        .mission-cell-audit { grid-area: audit_rail; min-height: 0; }

        @media (min-width: 1024px) {
          .mission-layout {
            grid-template-columns: 4.5rem minmax(0, 1fr) minmax(24rem, 30rem);
            grid-template-rows: 4.75rem minmax(0, 1fr) minmax(13rem, 15rem);
            grid-template-areas:
              "sidebar top_hud top_hud"
              "sidebar command_theater intel_dock"
              "sidebar audit_rail intel_dock";
          }

          .mission-layout--intelligence {
            grid-template-columns: 4.5rem minmax(0, 1fr) minmax(0, 1fr);
            grid-template-rows: 4.75rem minmax(0, 1fr);
            grid-template-areas:
              "sidebar top_hud top_hud"
              "sidebar command_theater command_theater";
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.42),rgba(2,6,23,0.82)_52%,rgba(2,6,23,0.98))]" />
      <div className={cn(
        "mission-layout relative z-10 grid h-full gap-4 p-4",
        routeMission === "intelligence" ? "mission-layout--intelligence" : "mission-layout--mission",
      )}>
        <div className="mission-cell-sidebar min-h-0">
          <AdminSidebar
            activeMission={routeMission}
            onNavigate={handleMissionChange}
            onToolSelect={handleToolSelect}
            onLogout={handleLogout}
          />
        </div>

        <header className="mission-cell-top min-w-0">
          <div className="mission-ribbon h-full rounded-[1.45rem] border border-slate-800/90 bg-slate-950/72 shadow-[0_24px_80px_-42px_rgba(2,6,23,1)] backdrop-blur-xl">
            <div className="flex h-full flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                  <div className="flex items-center gap-2">
                    <Radar className="h-3.5 w-3.5" />
                    {missionMeta.eyebrow}
                  </div>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-600 xl:block" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-2.5 py-1 text-[9px] text-indigo-100">
                    <MapPin className="h-3 w-3" />
                    {missionMeta.chip}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-[9px] text-slate-300">
                    <BrainCircuit className="h-3 w-3 text-emerald-300" />
                    {healthSnapshot?.deployment?.commit ? `COMMIT ${healthSnapshot.deployment.commit.slice(0, 7)}` : "COMMIT SYNCING"}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {missionMeta.copy}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <HudTickerItem icon={Globe2} label="Uptime" value={globalUptime} tone="emerald" />
                <HudTickerItem icon={Clock3} label="Latency" value={`${channelLatencyMs}ms`} tone="sky" />
                <HudTickerItem icon={UsersRound} label="Active Fleet" value={`${activeWorkerRate}%`} tone="indigo" />
                <HudTickerItem
                  icon={Server}
                  label="Cloud Engine"
                  value={llmMode === "ready" ? "READY" : "FALLBACK"}
                  tone={llmMode === "ready" ? "emerald" : "amber"}
                />
              </div>
            </div>
          </div>
        </header>

        <section className="mission-cell-theater min-h-0">
          <MissionControlMap
            activeTab={activeTab}
            routeZoneId={routeZoneId}
            workers={workersList}
            bookings={bookingsList}
            onZoneSelect={handleIntelligenceZoneChange}
          />
        </section>

        <aside className="mission-cell-dock min-h-0">
          <div className="mission-panel h-full overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_30px_80px_-36px_rgba(2,6,23,1)] backdrop-blur-lg">
            <div className="border-b border-slate-800/80 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Intel Dock
                  </p>
                  <h2 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                    {activeTab.replace(/-/g, " ")}
                  </h2>
                </div>
                <div className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">
                  {zoneLabel}
                </div>
              </div>
            </div>

            <div className="mission-scrollbar h-[calc(100%-5rem)] overflow-y-auto p-4">
              {activeTab === "system" ? (
                <SystemTab
                  healthSnapshot={healthSnapshot}
                  channelLatencyMs={channelLatencyMs}
                  activeWorkerRate={activeWorkerRate}
                  zoneLabel={zoneLabel}
                />
              ) : activeTab === "bugs" ? (
                <BugsTab />
              ) : activeTab === "audit" || activeTab === "settings" ? (
                <div className="flex h-full min-h-[18rem] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-700 bg-slate-900/55 text-center">
                  <div>
                    <ShieldCheck className="mx-auto mb-4 h-7 w-7 text-slate-500" />
                    <h3 className="font-mono text-lg font-black uppercase tracking-[0.18em] text-slate-100">Module Initializing</h3>
                    <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Security systems syncing...
                    </p>
                  </div>
                </div>
              ) : (
                activeDockPanel
              )}
            </div>
          </div>
        </aside>

        <section className="mission-cell-audit min-h-0">
          {activeAuditSurface ? (
            <div className="mission-panel h-full overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/82 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
              <div className="mission-scrollbar h-full overflow-y-auto p-4 md:p-5">
                {activeAuditSurface}
              </div>
            </div>
          ) : (
            <div className="grid h-full gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
                <div className="border-b border-slate-800/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                        LOGISTICS_CORE_AUDIT
                      </p>
                      <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                        STRICT_PERSISTENCE
                      </h3>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {llmMode === "ready" ? "Cloud Brain" : "Fallback Engine"}
                    </div>
                  </div>
                </div>

                <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                    {activities.slice(0, 6).map((entry, index) => (
                      <HudLogEntry
                        key={`${entry.msg}-${entry.time}-${index}`}
                        tone={entry.type === "booking" ? "indigo" : "emerald"}
                        tag={entry.role || "OPS"}
                        message={`${entry.msg} // ${entry.time}`}
                      />
                    ))}
                    <HudLogEntry
                      tone={llmMode === "ready" ? "emerald" : "amber"}
                      tag="ENGINE"
                      message={llmMode === "ready" ? llmSummary : "Cloud engine degraded. Fallback cognition path is active."}
                    />
                    {(error || stats.systemHealth === "critical") && (
                      <HudLogEntry
                        tone="rose"
                        tag="ALERT"
                        message={error || "Realtime ingestion rail reported a critical health event."}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="mission-panel flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-800/90 bg-slate-950/80 shadow-[0_24px_70px_-34px_rgba(2,6,23,1)] backdrop-blur-lg">
                <div className="border-b border-slate-800/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Observability Edge
                      </p>
                      <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
                        Tactical Readout
                      </h3>
                    </div>
                    <div className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]",
                      error || llmMode !== "ready"
                        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
                        : "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
                    )}>
                      {error || llmMode !== "ready" ? (
                        <TriangleAlert className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      {error || llmMode !== "ready" ? "Watch posture" : "System green"}
                    </div>
                  </div>
                </div>

                <div className="mission-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HudMetric label="Settled Revenue" value={`INR ${stats.totalRevenue.toLocaleString("en-IN")}`} tone="emerald" />
                    <HudMetric label="Pending Payouts" value={`INR ${pendingPayouts.toLocaleString("en-IN")}`} tone="amber" />
                    <HudMetric label="7D Flow" value={`${sevenDayBookings.toLocaleString("en-IN")} jobs`} tone="indigo" />
                    <HudMetric label="7D Revenue" value={`INR ${sevenDayRevenue.toLocaleString("en-IN")}`} tone="sky" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <StatusLine label="Queue velocity" value={bookingTrendDelta >= 0 ? `+${bookingTrendDelta}` : String(bookingTrendDelta)} tone="indigo" />
                    <StatusLine label="Average ticket" value={`INR ${averageTicket.toLocaleString("en-IN")}`} tone="emerald" />
                    <StatusLine label="Deploy branch" value={String(healthSnapshot?.deployment?.branch || "main").toUpperCase()} tone="sky" />
                    <StatusLine label="Secure uploads" value={healthSnapshot?.media?.secureUploadsReady ? "ONLINE" : "FALLBACK"} tone={healthSnapshot?.media?.secureUploadsReady ? "emerald" : "amber"} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={verificationViewerOpen} onOpenChange={setVerificationViewerOpen}>
        <DialogContent className="max-w-4xl border border-slate-800 bg-slate-950/96 text-slate-100 shadow-[0_32px_90px_-44px_rgba(2,6,23,1)] backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              {verificationViewerName} · {verificationViewerType.toUpperCase()} Verification Document
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3">
              <p className="text-sm font-semibold text-slate-300">
                This preview uses a time-limited signed URL from the backend.
              </p>
              <a
                href={verificationViewerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:border-slate-500 hover:bg-slate-900"
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
                  className="h-[70vh] w-full rounded-xl border border-slate-800 bg-white"
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <img
                    src={verificationViewerUrl}
                    alt={`${verificationViewerType} verification document`}
                    className="max-h-[70vh] w-full object-contain"
                  />
                </div>
              )
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900 text-sm font-semibold text-slate-500">
                Unable to preview this document right now.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type HudTone = "emerald" | "amber" | "indigo" | "sky" | "rose" | "slate";

const hudToneClasses: Record<HudTone, string> = {
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  indigo: "border-indigo-400/25 bg-indigo-500/10 text-indigo-100",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-100",
  rose: "border-rose-400/25 bg-rose-400/10 text-rose-100",
  slate: "border-slate-700 bg-slate-900/90 text-slate-200",
};

function sectorLabelById(zoneId: string) {
  const match = sectorSeeds.find((sector) => sector.id === zoneId);
  if (match?.label) return match.label;

  return zoneId
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function HudBlock({
  title,
  eyebrow,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.45rem] border border-slate-800/85 bg-slate-950/66 p-4 shadow-[0_20px_60px_-38px_rgba(2,6,23,1)] backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-white">
            {title}
          </h3>
        </div>
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 text-slate-300">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function HudMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: HudTone;
}) {
  return (
    <div className={cn("rounded-2xl border px-3 py-3", hudToneClasses[tone])}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-lg font-black uppercase tracking-[0.08em]">
        {value}
      </p>
    </div>
  );
}

function HudTopChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: HudTone;
}) {
  return (
    <div className={cn("min-w-[11.5rem] rounded-[1.45rem] border px-4 py-3 shadow-[0_18px_50px_-36px_rgba(2,6,23,1)] backdrop-blur-xl", hudToneClasses[tone])}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-sm font-black uppercase tracking-[0.18em]">
        {value}
      </p>
    </div>
  );
}

function HudTickerItem({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: HudTone;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]", hudToneClasses[tone])}>
      <Icon className="h-3.5 w-3.5" />
      <span className="opacity-80">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function SignalBar({
  label,
  value,
  fill,
  tone,
}: {
  label: string;
  value: string;
  fill: number;
  tone: Exclude<HudTone, "rose" | "slate">;
}) {
  const barTone = tone === "amber"
    ? "from-amber-300 via-amber-400 to-amber-500"
    : tone === "indigo"
      ? "from-indigo-300 via-indigo-400 to-indigo-500"
      : tone === "sky"
        ? "from-sky-300 via-sky-400 to-sky-500"
        : "from-emerald-300 via-emerald-400 to-emerald-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">
        <span>{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-900">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", barTone)}
          style={{ width: `${Math.max(6, Math.min(100, fill))}%` }}
        />
      </div>
    </div>
  );
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: HudTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/72 px-3 py-3">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", hudToneClasses[tone])}>
        {value}
      </span>
    </div>
  );
}

function HudLogEntry({
  tag,
  message,
  tone,
}: {
  tag: string;
  message: string;
  tone: HudTone;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/72 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]", hudToneClasses[tone])}>
          {tag}
        </span>
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {message}
        </p>
      </div>
    </div>
  );
}

function LegendLine({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">
      <span className={cn("h-2.5 w-8 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
