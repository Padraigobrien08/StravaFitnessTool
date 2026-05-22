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
        "coach-workspace flex h-full min-h-0 flex-1 flex-col",
        "-mx-4 w-[calc(100%+2rem)] max-w-none sm:-mx-5 sm:w-[calc(100%+2.5rem)] lg:-mx-6 lg:w-[calc(100%+3rem)]",
        className
      )}
    >
      {children}
    </div>
  );
}
