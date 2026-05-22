import { cn } from "@/lib/utils";
import { ops } from "@/components/home/primitives/tokens";

export function RunsWorkspace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ops.dashboard, "dashboard-enter w-full pb-6", className)}>
      {children}
    </div>
  );
}
