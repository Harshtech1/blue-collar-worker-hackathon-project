import React from 'react';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  label: string;
  render?: (value: any, item: any) => React.ReactNode;
}

interface DataTableProps {
  title: string;
  description: string;
  columns: Column[];
  data: any[];
  onSearch?: (term: string) => void;
  onFilter?: () => void;
  loading?: boolean;
  variant?: "default" | "hud";
  viewportClassName?: string;
  hideFooter?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({ 
  title, 
  description, 
  columns, 
  data, 
  onSearch, 
  onFilter,
  loading,
  variant = "default",
  viewportClassName,
  hideFooter = false,
}) => {
  const isHud = variant === "hud";

  return (
    <div className={cn(
      "overflow-hidden animate-in fade-in duration-500",
      isHud
        ? "rounded-[1.4rem] border border-slate-700/70 bg-slate-950/68 shadow-[0_28px_60px_-30px_rgba(2,6,23,0.95)] backdrop-blur-xl"
        : "rounded-xl border border-slate-200 bg-white shadow-lg",
    )}>
      <div className={cn(
        "border-b",
        isHud ? "border-slate-800/80 px-5 py-4" : "border-slate-100 p-6",
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className={cn(
              "text-[10px] font-black uppercase tracking-[0.22em]",
              isHud ? "font-mono text-slate-500" : "text-slate-400",
            )}>
              {isHud ? "DOCKED DATA PANEL" : "DATA TABLE"}
            </p>
            <h2 className={cn(
              "mt-2 font-black",
              isHud ? "font-mono text-lg text-slate-50" : "text-xl text-slate-900",
            )}>
              {title}
            </h2>
            <p className={cn(
              "mt-1 text-sm",
              isHud ? "font-mono text-slate-400" : "font-medium text-slate-500",
            )}>
              {description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2",
                isHud ? "text-slate-500" : "text-slate-400",
              )} size={16} />
              <input 
                type="text" 
                placeholder="Search records..." 
                className={cn(
                  "w-full rounded-lg border pl-9 pr-4 py-2 text-sm outline-none transition-all md:w-64",
                  isHud
                    ? "border-slate-700 bg-slate-900/80 font-mono text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/70 focus:ring-1 focus:ring-indigo-400/40"
                    : "bg-slate-50 focus:ring-2 focus:ring-primary",
                )}
                onChange={(e) => onSearch?.(e.target.value)}
              />
            </div>
            <button 
              onClick={onFilter}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all",
                isHud
                  ? "border-slate-700 bg-slate-900/80 font-mono text-slate-300 hover:border-indigo-400/45 hover:text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Filter size={16} /> Filters
            </button>
          </div>
        </div>
      </div>

      <div className={cn("overflow-x-auto", viewportClassName)}>
        <table className="w-full text-left">
          <thead className={cn(
            "border-b",
            isHud ? "bg-slate-900/92 border-slate-800/80" : "bg-slate-50 border-slate-100",
          )}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-4 text-[10px] font-black uppercase tracking-widest",
                    isHud ? "font-mono text-slate-500" : "text-slate-500",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    <ArrowUpDown size={12} className={isHud ? "text-slate-700" : "text-slate-300"} />
                  </div>
                </th>
              ))}
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className={cn(
            "divide-y",
            isHud ? "divide-slate-800/70" : "divide-slate-50",
          )}>
            {loading ? (
              Array.from({length: 5}).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className={cn(
                        "h-4 w-full rounded",
                        isHud ? "bg-slate-800" : "bg-slate-100",
                      )}></div>
                    </td>
                  ))}
                  <td className="px-6 py-4"></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className={cn(
                    "px-6 py-12 text-center italic",
                    isHud ? "font-mono text-slate-500" : "font-medium text-slate-500",
                  )}
                >
                  No records found matching your criteria
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    "group transition-colors",
                    isHud ? "hover:bg-slate-900/80" : "hover:bg-slate-50/80",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-6 py-4 text-sm font-bold",
                        isHud ? "font-mono text-slate-200" : "text-slate-700",
                      )}
                    >
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <button className={cn(
                      "rounded-md p-1 transition-colors opacity-0 group-hover:opacity-100",
                      isHud ? "hover:bg-slate-800" : "hover:bg-slate-200",
                    )}>
                      <MoreVertical size={16} className={isHud ? "text-slate-500" : "text-slate-400"} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!hideFooter && (
        <div className={cn(
          "flex items-center justify-between border-t p-4",
          isHud ? "border-slate-800/80 bg-slate-950/82" : "border-slate-100 bg-slate-50/50",
        )}>
          <p className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isHud ? "font-mono text-slate-500" : "text-slate-500",
          )}>
            Showing <span className={isHud ? "text-slate-100" : "text-slate-900"}>{data.length}</span> of <span className={isHud ? "text-slate-100" : "text-slate-900"}>1,234</span> results
          </p>
          <div className="flex items-center gap-2">
            <button className={cn(
              "rounded border p-1 disabled:opacity-50",
              isHud ? "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-white hover:bg-slate-50",
            )} disabled>
              <ChevronLeft size={18} />
            </button>
            <button className={cn(
              "rounded border p-1",
              isHud ? "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800" : "bg-white hover:bg-slate-50",
            )}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
