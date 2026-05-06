import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  DollarSign, 
  Activity, 
  AlertCircle, 
  ShieldCheck, 
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Map,
  BrainCircuit
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminTab = 'overview' | 'users' | 'workers' | 'bookings' | 'finance' | 'heatmap' | 'intelligence' | 'system' | 'bugs' | 'audit' | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  onLogout: () => void;
}

const menuItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User Directory', icon: Users },
  { id: 'workers', label: 'Worker Fleet', icon: Briefcase },
  { id: 'bookings', label: 'Order Stream', icon: Activity },
  { id: 'finance', label: 'Revenue & Payouts', icon: DollarSign },
  { id: 'heatmap', label: 'Job Heatmap', icon: Map },
  { id: 'intelligence', label: 'Intelligence Engine', icon: BrainCircuit },
  { id: 'system', label: 'System Health', icon: Settings },
  { id: 'bugs', label: 'Bug Monitor', icon: AlertCircle },
  { id: 'audit', label: 'Platform Audit', icon: ShieldCheck },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Trigger - Premium Style */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-[0_10px_40px_rgba(79,70,229,0.4)] flex items-center justify-center transition-all active:scale-90"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-slate-400 border-r border-slate-900 transition-all duration-500 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-8 pb-4">
            <div className="flex items-center gap-3 group px-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-transform group-hover:rotate-12">
                <BarChart3 className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-white text-xl font-black tracking-tighter">RAHI HQ</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">v2.4 Prime</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as AdminTab);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                  activeTab === item.id
                    ? "bg-indigo-600/10 text-white shadow-[0_0_20px_rgba(79,70,229,0.1)]"
                    : "hover:bg-slate-900/50 hover:text-slate-200"
                )}
              >
                {/* Active Indicator Bar */}
                {activeTab === item.id && (
                  <div className="absolute left-0 w-1 h-5 bg-indigo-500 rounded-r-full animate-in slide-in-from-left-2" />
                )}
                
                <item.icon 
                  size={18} 
                  className={cn(
                    "transition-transform duration-300 group-hover:scale-110",
                    activeTab === item.id ? "text-indigo-400" : "text-slate-500"
                  )} 
                />
                <span className="text-sm font-black tracking-tight">{item.label}</span>
                
                {activeTab === item.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}
              </button>
            ))}
          </nav>

          {/* Bottom Actions - Master Look */}
          <div className="p-4 mt-auto border-t border-slate-900/50">
            <div className="p-4 rounded-2xl bg-indigo-600/5 mb-4 border border-indigo-500/10 group cursor-help">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <ShieldCheck size={14} className="text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Admin Safe</span>
               </div>
               <p className="text-[10px] text-slate-500 font-bold leading-tight group-hover:text-slate-400 transition-colors">
                 Your session is encrypted and monitored for security.
               </p>
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-300 font-black text-sm group"
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              Sign Out Session
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
