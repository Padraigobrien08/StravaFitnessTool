import { cn } from "@/lib/utils";
import { ops } from "@/components/home/primitives/tokens";

export function PerformanceWorkspace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ops.dashboard, "dashboard-enter w-full pb-6", className)}>{children}</div>
  );
}

export function PerformanceIntelRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-5 lg:items-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
