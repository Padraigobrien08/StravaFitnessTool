import { cn } from "@/lib/utils";

/** Full-bleed endurance reasoning workspace — breaks default page rhythm */
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
        "coach-workspace -mx-4 w-[calc(100%+2rem)] max-w-none sm:-mx-5 sm:w-[calc(100%+2.5rem)] lg:-mx-6 lg:w-[calc(100%+3rem)]",
        className
      )}
    >
      {children}
    </div>
  );
}
