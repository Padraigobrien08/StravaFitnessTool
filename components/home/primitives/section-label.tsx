import { cn } from "@/lib/utils";
import { dash } from "./tokens";

export function SectionLabel({
  children,
  action,
  className,
  accent,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("mb-1.5 flex items-center justify-between gap-2", className)}>
      <h2 className={accent ? dash.labelAccent : dash.label}>{children}</h2>
      {action}
    </div>
  );
}
