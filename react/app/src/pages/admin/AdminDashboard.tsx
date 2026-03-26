import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

import { AdminSidebar, AdminTab } from "./components/AdminSidebar";
import { OverviewTab } from "./components/OverviewTab";
import { DataTable } from "./components/DataTable";
import { SystemTab } from "./components/SystemTab";
import { BugsTab } from "./components/BugsTab";
import { FinanceTab } from "./components/FinanceTab";

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

/* ================= COMPONENT ================= */

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("adminToken"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

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

  const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
  };

  /* ================= DATA FETCH ================= */

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const token = localStorage.getItem("adminToken");
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

  /* ================= LOGIN UI ================= */

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <BarChart3 className="text-white w-8 h-8" />
            </div>
          </div>

          <h2 className="text-center text-3xl font-black text-white mb-8">
            RAHI Admin
          </h2>

          <input
            className="w-full mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            placeholder="Admin Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />

          {error && (
            <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            Login <ChevronRight size={18} />
          </button>
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
