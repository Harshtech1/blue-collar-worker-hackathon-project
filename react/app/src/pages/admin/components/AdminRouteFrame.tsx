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
        "h-full overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-slate-950/82 shadow-[0_30px_80px_-36px_rgba(2,6,23,1)] backdrop-blur-lg",
        className,
      )}
    >
      <div className={cn("mission-scrollbar h-full overflow-y-auto p-4 md:p-5", viewportClassName)}>
        {children}
      </div>
    </div>
  );
}
