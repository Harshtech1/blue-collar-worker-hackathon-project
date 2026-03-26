import { 
  Users, 
  Briefcase, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { AdminTab } from './AdminSidebar';

interface OverviewProps {
  stats: any;
  loading: boolean;
  setActiveTab: (tab: AdminTab) => void;
  chartData?: any[];
  activities?: any[];
}

export const OverviewTab: React.FC<OverviewProps> = ({ stats, loading, setActiveTab, chartData = [], activities = [] }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
      {/* Premium Metric Cards - Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <button 
          onClick={() => setActiveTab('users')}
          className="text-left group perspective-1000"
        >
          <Card className="relative overflow-hidden border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(59,130,246,0.1)] transition-all duration-500 hover:-translate-y-2 cursor-pointer group-hover:ring-2 ring-blue-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
            <CardHeader className="pb-2 relative z-10">
              <CardDescription className="flex items-center gap-2 font-bold text-slate-400 uppercase text-[10px] tracking-[0.15em]">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                  <Users size={14} />
                </div>
                Platform Reach
              </CardDescription>
              <CardTitle className="text-4xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : stats.totalUsers.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-black bg-blue-50 w-fit px-2.5 py-1 rounded-full">
                <TrendingUp size={12} /> 12.4% GROWTH
              </div>
            </CardContent>
          </Card>
        </button>

        <button 
          onClick={() => setActiveTab('bookings')}
          className="text-left group perspective-1000"
        >
          <Card className="relative overflow-hidden border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(168,85,247,0.1)] transition-all duration-500 hover:-translate-y-2 cursor-pointer group-hover:ring-2 ring-purple-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
            <CardHeader className="pb-2 relative z-10">
              <CardDescription className="flex items-center gap-2 font-bold text-slate-400 uppercase text-[10px] tracking-[0.15em]">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                  <Activity size={14} />
                </div>
                Live Pulse
              </CardDescription>
              <CardTitle className="text-4xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : stats.totalBookings.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-center gap-1.5 text-[11px] text-purple-600 font-black bg-purple-50 w-fit px-2.5 py-1 rounded-full">
                <Clock size={12} /> {stats.activeBookings} IN-FLIGHT
              </div>
            </CardContent>
          </Card>
        </button>

        <button 
          onClick={() => setActiveTab('workers')}
          className="text-left group perspective-1000"
        >
          <Card className="relative overflow-hidden border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(249,115,22,0.1)] transition-all duration-500 hover:-translate-y-2 cursor-pointer group-hover:ring-2 ring-orange-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
            <CardHeader className="pb-2 relative z-10">
              <CardDescription className="flex items-center gap-2 font-bold text-slate-400 uppercase text-[10px] tracking-[0.15em]">
                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md">
                  <Briefcase size={14} />
                </div>
                Workforce Capacity
              </CardDescription>
              <CardTitle className="text-4xl font-black text-slate-900 mt-2 tracking-tight">
                {loading ? '...' : stats.totalWorkers.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-center gap-1.5 text-[11px] text-green-600 font-black bg-green-50 w-fit px-2.5 py-1 rounded-full">
                <CheckCircle size={12} /> 94% UTILIZATION
              </div>
            </CardContent>
          </Card>
        </button>

        <button 
          onClick={() => setActiveTab('finance')}
          className="text-left group perspective-1000"
        >
          <Card className="relative overflow-hidden border-none bg-slate-900 shadow-2xl hover:shadow-[0_20px_40px_rgba(34,197,94,0.15)] transition-all duration-500 hover:-translate-y-2 cursor-pointer group-hover:ring-2 ring-green-500/40">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mb-16 transition-transform duration-1000 group-hover:scale-150 blur-3xl" />
            <CardHeader className="pb-2 relative z-10">
              <CardDescription className="flex items-center gap-2 font-bold text-slate-400 uppercase text-[10px] tracking-[0.15em]">
                <div className="p-1.5 bg-green-500/20 text-green-400 rounded-md">
                  <DollarSign size={14} />
                </div>
                Gross Revenue
              </CardDescription>
              <CardTitle className="text-4xl font-black text-white mt-2 tracking-tight">
                ₹{loading ? '...' : stats.totalRevenue.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-center gap-1.5 text-[11px] text-green-400 font-black bg-green-500/10 w-fit px-2.5 py-1 rounded-full border border-green-500/20">
                <TrendingUp size={12} /> +2.1% THIS WEEK
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Modern Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-2xl border-none bg-white overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-50/30 border-b border-slate-100/50 pb-6 px-8 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Market Velocity</CardTitle>
                <CardDescription className="font-bold text-slate-400 text-xs">Transactional throughput analysis</CardDescription>
              </div>
              <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                {['Daily', 'Weekly'].map((label) => (
                  <button 
                    key={label}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      label === 'Daily' ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-10 px-8 pb-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length ? chartData : [{name:'', bookings:0}]}>
                  <defs>
                    <linearGradient id="colorBookingsMaster" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', background: '#fff'}}
                    itemStyle={{fontWeight: 900, color: '#1e293b'}}
                    cursor={{stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '4 4'}}
                  />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorBookingsMaster)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none bg-white overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-50/30 border-b border-slate-100/50 pb-6 px-8 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Revenue Breakdown</CardTitle>
                <CardDescription className="font-bold text-slate-400 text-xs">Settlement status and growth yield</CardDescription>
              </div>
              <button className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                <TrendingUp size={18} className="text-slate-600" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-10 px-8 pb-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.length ? chartData : [{name:'', revenue:0}]}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 8}}
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', background: '#fff'}}
                  />
                  <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                    {(chartData.length ? chartData : [{name:''}]).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === (chartData.length || 1) - 1 ? '#4f46e5' : '#e2e8f0'} 
                        className="transition-all duration-300 hover:fill-indigo-500"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Feed & Infrastructure Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        <Card className="lg:col-span-2 shadow-2xl border-none rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-white pb-6 pt-8 px-8">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Operational Log
              </CardTitle>
              <button className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 hover:text-slate-900 transition-colors">
                Export Data
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <div className="divide-y divide-slate-50">
              {activities.length > 0 ? activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-6 p-6 hover:bg-slate-50/50 transition-all cursor-default group">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                    activity.type === 'booking' ? "bg-indigo-50 text-indigo-600" :
                    activity.type === 'finance' ? "bg-green-50 text-green-600" :
                    activity.type === 'security' ? "bg-slate-900 text-white" : "bg-orange-50 text-orange-600"
                  )}>
                    <Activity size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{activity.role}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span className="text-[10px] font-bold text-slate-400">{activity.time}</span>
                    </div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">{activity.msg}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-1" />
                </div>
              )) : (
                <div className="p-6 text-sm text-slate-500 text-center italic">No recent activities available. Waiting for data...</div>
              )}
            </div>
          </CardContent>
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-center">
             <button className="text-[11px] font-black text-slate-400 hover:text-slate-950 uppercase tracking-[0.2em] transition-all">
                Access Audit Logs
             </button>
          </div>
        </Card>

        <div className="space-y-8">
          <Card className="shadow-2xl border-none bg-indigo-600 text-white rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl transition-transform duration-1000 group-hover:scale-150" />
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 flex items-center gap-2">
                <CheckCircle size={16} /> Global Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2 tracking-tighter">99.9%</div>
              <div className="h-10 w-full flex items-end gap-1.5 overflow-hidden">
                {Array.from({length: 12}).map((_, i) => (
                  <div 
                    key={i} 
                    className="flex-1 rounded-t-sm bg-white/20 transition-all cursor-crosshair hover:bg-white" 
                    style={{height: `${Math.random() * 60 + 40}%`}}
                  />
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest mt-4 flex items-center gap-1.5">
                <ShieldCheck size={12} /> Infrastructure Stable
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-none border-slate-200 bg-white rounded-2xl px-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <TrendingUp size={16} /> Channel Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Latency', value: '42ms', pct: 20, color: 'bg-indigo-600' },
                { label: 'DB Load', value: '18%', pct: 18, color: 'bg-green-500' },
                { label: 'AI Error %', value: '0.04%', pct: 5, color: 'bg-orange-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-black text-slate-800 uppercase tracking-tight">{item.label}</span>
                    <span className="font-mono font-bold text-slate-400">{item.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000", item.color)} style={{width: `${item.pct}%`}} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

