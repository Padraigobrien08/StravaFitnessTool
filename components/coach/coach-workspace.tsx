import { cn } from "@/lib/utils";

/** Full-bleed coach shell — parent must be a fixed-height flex column */
export function CoachWorkspace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "coach-workspace flex h-full min-h-0 w-full min-w-0 flex-1 flex-col",
        className,
      )}
    >
      {children}
    </div>
  );
}
