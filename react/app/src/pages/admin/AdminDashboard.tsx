import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronRight,
  Mail,
  KeyRound,
} from "lucide-react";

import { AdminSidebar, AdminTab } from "./components/AdminSidebar";
import { OverviewTab } from "./components/OverviewTab";
import { DataTable } from "./components/DataTable";
import { SystemTab } from "./components/SystemTab";
import { BugsTab } from "./components/BugsTab";
import { FinanceTab } from "./components/FinanceTab";
import { HeatmapTab } from "./components/HeatmapTab";
import { IntelligenceTab } from "./components/IntelligenceTab";
import { API } from '@/lib/constants';

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

const ADMIN_EMAIL_OPTIONS = [
  "rahiforbharat@gmail.com",
  "admin@rahi.local",
];

const DEMO_ADMIN_TOKEN = "rahi-demo-admin-token";

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
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("adminToken"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => (
    localStorage.getItem("adminDemoMode") === "true" ? "intelligence" : "overview"
  ));

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  /* ================= AUTH ================= */

  useEffect(() => {
    // Check for existing admin session token
    const token = localStorage.getItem("adminToken");
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData();
      
      // Fast polling every 5 seconds for real-time dashboard feel
      const intervalId = setInterval(() => {
        fetchDashboardData(true);
      }, 5000);
      return () => clearInterval(intervalId);
    } else {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 lg:ml-72">
        <header className="sticky top-0 bg-white/80 backdrop-blur border-b px-8 py-4 flex justify-between">
          <div>
            <h2 className="text-2xl font-black capitalize">
              {activeTab.replace("-", " ")}
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest">
              Real-time platform data
            </p>
          </div>
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
            <Settings size={18} />
          </div>
        </header>

        <div className="p-8">
          {activeTab === "overview" && (
            <OverviewTab stats={stats} loading={loading} setActiveTab={setActiveTab} chartData={chartData} activities={activities} />
          )}
          {activeTab === "users" && (
            <DataTable 
              title="User Directory" 
              description="Manage platform customers"
              data={usersList}
              columns={[
                { key: '_id', label: 'ID', render: (val) => val?.substring(0, 8) + "..." },
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'role', label: 'Role', render: (val) => <span className="uppercase text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{val || 'customer'}</span> },
              ]}
              loading={loading}
            />
          )}
          {activeTab === "workers" && (
            <DataTable 
              title="Worker Fleet" 
              description="Manage registered workers"
              data={workersList}
              columns={[
                { key: '_id', label: 'ID', render: (val) => val?.substring(0, 8) + "..." },
                { key: 'name', label: 'Name' },
                { key: 'profession', label: 'Profession' },
                { key: 'phone', label: 'Phone' },
                { key: 'logisticsScore', label: 'Logistics MatchScore', render: (val, row) => {
                  const score = Number(val ?? 0);
                  const color = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : 'bg-rose-500';
                  return (
                    <div className="min-w-[160px]">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-slate-900">{score || 'N/A'}%</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {row?.completedJobs ?? 0} jobs
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-400">
                        Accept {row?.acceptanceRate ?? 0}% · Reliable {row?.reliabilityScore ?? 0}%
                      </div>
                    </div>
                  );
                } },
                { key: 'status', label: 'Status', render: (val) => <span className={`uppercase text-xs font-bold px-2 py-1 rounded ${val === 'verified' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>{val}</span> },
                { key: 'isAvailable', label: 'Availability', render: (val) => <span className={`uppercase text-xs font-bold px-2 py-1 rounded ${val ? 'text-green-600 bg-green-50' : 'text-rose-600 bg-rose-50'}`}>{val ? 'Available' : 'Busy'}</span> },
              ]}
              loading={loading}
            />
          )}
          {activeTab === "bookings" && (
            <DataTable 
              title="Order Stream" 
              description="Monitor active and past bookings"
              data={bookingsList}
              columns={[
                { key: '_id', label: 'Booking ID', render: (val) => val?.substring(0, 8) + "..." },
                { key: 'service', label: 'Service' },
                { key: 'total_price', label: 'Price (₹)', render: (val) => val ? `₹${val}` : 'N/A' },
                { key: 'status', label: 'Status', render: (val) => {
                  let color = 'text-slate-600 bg-slate-50';
                  if (val === 'completed') color = 'text-green-600 bg-green-50';
                  if (val === 'pending') color = 'text-orange-600 bg-orange-50';
                  if (val === 'matched' || val === 'in_progress') color = 'text-indigo-600 bg-indigo-50';
                  return <span className={`uppercase text-xs font-bold px-2 py-1 rounded ${color}`}>{val}</span>;
                }},
                { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
              ]}
              loading={loading}
            />
          )}
          {activeTab === "finance" && <FinanceTab revenue={stats.totalRevenue} bookings={bookingsList} />}
          {activeTab === "heatmap" && <HeatmapTab token={localStorage.getItem("adminToken") || ""} />}
          {activeTab === "intelligence" && <IntelligenceTab />}
          {activeTab === "system" && <SystemTab />}
          {activeTab === "bugs" && <BugsTab />}


          {(activeTab === "audit" || activeTab === "settings") && (
            <div className="py-20 bg-white rounded-2xl border border-dashed text-center">
              <ShieldCheck className="mx-auto text-slate-400 mb-4" />
              <h3 className="font-black">Module Initializing</h3>
              <p className="text-slate-500 text-sm">
                Security systems syncing…
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
