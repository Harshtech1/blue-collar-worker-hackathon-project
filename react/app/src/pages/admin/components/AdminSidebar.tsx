import React, { useState } from "react";
import {
  Activity,
  Briefcase,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminMission, AdminToolAction } from "../adminRoutes";

export type { AdminMission, AdminTab, AdminToolAction } from "../adminRoutes";

interface AdminSidebarProps {
  activeMission: AdminMission;
  onNavigate: (mission: AdminMission) => void;
  onToolSelect: (tool: AdminToolAction) => void;
  onLogout: () => void;
}

const primaryItems: Array<{
  id: AdminMission;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Morning brief and business snapshot",
    icon: LayoutDashboard,
  },
  {
    id: "war-room",
    label: "Operations Center",
    description: "Map, market signals, and delivery coverage",
    icon: Map,
  },
  {
    id: "workforce",
    label: "Workforce",
    description: "Workers, customers, and bookings",
    icon: Briefcase,
  },
  {
    id: "finance",
    label: "Finance",
    description: "Revenue, payouts, and unit economics",
    icon: DollarSign,
  },
];

const secondaryItems: Array<{
  id: AdminToolAction;
  label: string;
  description: string;
  icon: typeof Activity;
}> = [
  {
    id: "system-health",
    label: "System Health",
    description: "Uptime, APIs, and provider status",
    icon: Activity,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Admin access and platform controls",
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

  const isSecondaryActive = activeMission === "observability" || activeMission === "settings";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] transition active:scale-95 lg:hidden"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-4 left-4 z-40 flex w-[18.5rem] flex-col rounded-[2rem] border border-slate-200 bg-white/96 p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.28)] backdrop-blur transition-transform duration-300 lg:relative lg:inset-auto lg:z-10 lg:h-full lg:w-[18rem] lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-[120%]",
        )}
      >
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                RAHI Admin
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                Operations Suite
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            A simplified control surface aligned to the Karigar 360 customer experience.
          </p>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto pr-1">
          <div className="space-y-6">
            <div>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Navigation
              </p>
              <div className="mt-3 space-y-2">
                {primaryItems.map((item) => (
                  <NavButton
                    key={item.id}
                    active={activeMission === item.id}
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Platform
              </p>
              <div className="mt-3 space-y-2">
                {secondaryItems.map((item) => (
                  <NavButton
                    key={item.id}
                    active={isSecondaryActive && ((item.id === "settings" && activeMission === "settings") || (item.id === "system-health" && activeMission === "observability"))}
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                    onClick={() => {
                      onToolSelect(item.id);
                      setIsOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="mt-4 inline-flex items-center gap-3 rounded-[1.15rem] border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>
    </>
  );
};

function NavButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof LayoutDashboard;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-[1.15rem] border px-3.5 py-3 text-left transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl",
          active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700",
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">{label}</p>
        <p className={cn("mt-1 text-xs leading-5", active ? "text-slate-300" : "text-slate-500")}>
          {description}
        </p>
      </div>
    </button>
  );
}
