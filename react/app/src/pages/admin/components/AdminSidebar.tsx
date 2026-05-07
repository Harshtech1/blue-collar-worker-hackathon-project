import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Database,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  Settings,
  ShieldCheck,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  | "intelligence"
  | "workforce"
  | "finance"
  | "observability"
  | "settings";

export type AdminToolAction =
  | "bug-monitor"
  | "api-telemetry"
  | "database-status"
  | "settings";

interface AdminSidebarProps {
  activeMission: AdminMission;
  onNavigate: (mission: AdminMission) => void;
  onToolSelect: (tool: AdminToolAction) => void;
  onLogout: () => void;
}

const primaryItems: Array<{
  id: AdminMission;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "intelligence", label: "War Room", icon: BrainCircuit },
  { id: "workforce", label: "Workforce", icon: Briefcase },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "observability", label: "Engine Room", icon: Activity },
];

const toolItems: Array<{
  id: AdminToolAction;
  label: string;
  note: string;
  icon: typeof AlertCircle;
}> = [
  {
    id: "bug-monitor",
    label: "Bug Monitor",
    note: "Exception rail and incident traces",
    icon: AlertCircle,
  },
  {
    id: "api-telemetry",
    label: "API Telemetry",
    note: "Latency, provider, and service rails",
    icon: Waypoints,
  },
  {
    id: "database-status",
    label: "Database Status",
    note: "Persistence mesh and secure media state",
    icon: Database,
  },
  {
    id: "settings",
    label: "Settings",
    note: "Shell controls and platform preferences",
    icon: Settings,
  },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeMission,
  onNavigate,
  onToolSelect,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!toolsRef.current) return;
      if (toolsRef.current.contains(event.target as Node)) return;
      setToolsOpen(false);
    };

    if (toolsOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [toolsOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_10px_40px_rgba(79,70,229,0.4)] transition-all active:scale-90 lg:hidden"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside
        className={cn(
          "fixed inset-y-4 left-4 z-40 w-[18rem] rounded-[1.8rem] border border-slate-800/90 bg-slate-950/84 text-slate-400 shadow-[0_28px_60px_-30px_rgba(2,6,23,0.95)] backdrop-blur-2xl transition-all duration-500 ease-in-out lg:relative lg:inset-y-0 lg:left-0 lg:z-10 lg:h-full lg:w-[4.75rem] lg:rounded-[1.45rem] lg:bg-slate-950/72 lg:translate-x-0",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="px-5 pb-4 pt-5 lg:px-2 lg:pb-3 lg:pt-4">
            <div className="hidden items-center justify-center lg:flex lg:flex-col lg:gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/14 shadow-[0_0_0_1px_rgba(99,102,241,0.16)]">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-emerald-300">
                HQ
              </p>
            </div>

            <div className="flex items-center gap-3 px-1 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/14 shadow-[0_0_0_1px_rgba(99,102,241,0.16)]">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-black tracking-tight text-white">
                  RAHI HQ
                </h1>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300 leading-none">
                  Route Console
                </p>
              </div>
            </div>
          </div>

          <nav className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3 py-4 lg:px-2">
            {primaryItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setIsOpen(false);
                  setToolsOpen(false);
                }}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 lg:justify-center lg:px-0",
                  activeMission === item.id
                    ? "border border-indigo-400/25 bg-indigo-500/12 text-white shadow-[0_18px_45px_-24px_rgba(79,70,229,0.6)]"
                    : "border border-transparent hover:border-slate-800 hover:bg-slate-900/50 hover:text-slate-200",
                )}
                title={item.label}
              >
                {activeMission === item.id ? (
                  <div className="absolute left-0 h-5 w-1 rounded-r-full bg-emerald-400 lg:left-auto lg:bottom-0 lg:h-1 lg:w-7 lg:rounded-t-full lg:rounded-r-none" />
                ) : null}

                <item.icon
                  size={18}
                  className={cn(
                    "transition-transform duration-300 group-hover:scale-110",
                    activeMission === item.id ? "text-emerald-300" : "text-slate-500",
                  )}
                />
                <span className="font-mono text-[13px] font-black uppercase tracking-[0.14em] lg:hidden">
                  {item.label}
                </span>

                <span className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-700 bg-slate-950/96 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-100 opacity-0 shadow-[0_18px_40px_-24px_rgba(2,6,23,1)] transition-all duration-200 group-hover:opacity-100 lg:block">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-800/80 p-4 lg:px-2 lg:py-3">
            <div className="mb-3 hidden justify-center lg:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/18 bg-emerald-400/10 text-emerald-300 shadow-[0_12px_30px_-20px_rgba(16,185,129,0.75)]">
                <ShieldCheck size={16} />
              </div>
            </div>

            <div ref={toolsRef} className="relative">
              <button
                onClick={() => setToolsOpen((value) => !value)}
                className={cn(
                  "group relative mb-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.14em] transition-all duration-300 lg:justify-center lg:px-0",
                  activeMission === "observability" || activeMission === "settings"
                    ? "border border-indigo-400/25 bg-indigo-500/10 text-white"
                    : "text-slate-500 hover:bg-slate-900/60 hover:text-slate-200",
                )}
                title="System Tools"
              >
                <MoreVertical size={18} className="transition-transform group-hover:scale-110" />
                <span className="lg:hidden">System Tools</span>
                <span className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-700 bg-slate-950/96 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-100 opacity-0 shadow-[0_18px_40px_-24px_rgba(2,6,23,1)] transition-all duration-200 group-hover:opacity-100 lg:block">
                  More
                </span>
              </button>

              {toolsOpen ? (
                <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 rounded-[1.5rem] border border-slate-800/90 bg-slate-950/96 p-3 shadow-[0_28px_70px_-36px_rgba(2,6,23,1)] backdrop-blur-2xl lg:left-[calc(100%+0.9rem)] lg:right-auto lg:w-[18rem]">
                  <div className="mb-3 px-2">
                    <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      System Tools
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                      Deep diagnostics, audit rails, and infrastructure controls.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {toolItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onToolSelect(item.id);
                          setIsOpen(false);
                          setToolsOpen(false);
                        }}
                        className="flex w-full items-start gap-3 rounded-2xl border border-transparent bg-slate-900/70 px-3 py-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
                      >
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-emerald-300">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-white">
                            {item.label}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                            {item.note}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={onLogout}
              className="group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-slate-500 transition-all duration-300 hover:bg-red-400/5 hover:text-red-400 lg:justify-center lg:px-0"
              title="Sign Out Session"
            >
              <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
              <span className="lg:hidden">Sign Out Session</span>
              <span className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-700 bg-slate-950/96 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-100 opacity-0 shadow-[0_18px_40px_-24px_rgba(2,6,23,1)] transition-all duration-200 group-hover:opacity-100 lg:block">
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => {
            setIsOpen(false);
            setToolsOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
