import { TypographySectionLabel } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export function OsSection({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("os-section", className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <TypographySectionLabel>{title}</TypographySectionLabel>
        {action}
      </div>
      {children}
    </section>
  );
}
