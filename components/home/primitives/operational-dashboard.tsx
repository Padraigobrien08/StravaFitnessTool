import { cn } from "@/lib/utils";
import { ops } from "./tokens";

export function OperationalDashboard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(ops.dashboard, className)}>{children}</div>;
}

export function OpsWeekRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(ops.weekRow, className)}>{children}</div>;
}

export function OpsIntelRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(ops.intelRow, className)}>{children}</div>;
}
