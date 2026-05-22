import { cn } from "@/lib/utils";

export function IntelligenceWorkspace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "intelligence-workspace -mx-4 w-[calc(100%+2rem)] max-w-none sm:-mx-5 sm:w-[calc(100%+2.5rem)] lg:-mx-6 lg:w-[calc(100%+3rem)]",
        className
      )}
    >
      {children}
    </div>
  );
}
