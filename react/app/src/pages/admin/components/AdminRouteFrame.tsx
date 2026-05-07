import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminRouteFrameProps {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}

export function AdminRouteFrame({
  children,
  className,
  viewportClassName,
}: AdminRouteFrameProps) {
  return (
    <div
      className={cn(
        "h-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className={cn("mission-scrollbar h-full overflow-y-auto p-8", viewportClassName)}>
        {children}
      </div>
    </div>
  );
}
