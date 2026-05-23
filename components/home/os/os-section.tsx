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
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
