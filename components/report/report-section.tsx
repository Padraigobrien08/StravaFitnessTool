import { cn } from "@/lib/utils";

export function ReportSection({
  title,
  subtitle,
  number,
  children,
  className,
  breakBefore,
}: {
  title: string;
  subtitle?: string;
  number?: number;
  children: React.ReactNode;
  className?: string;
  breakBefore?: boolean;
}) {
  return (
    <section className={cn("report-section", breakBefore && "print:break-before-page", className)}>
      <header className="report-section-header mb-5 border-b border-zinc-200/80 pb-4 print:border-zinc-300">
        {number != null ? (
          <span className="report-section-num mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700/80 print:text-teal-800">
            Section {number}
          </span>
        ) : null}
        <h2 className="font-display text-xl font-bold tracking-tight text-zinc-900 print:text-black sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-600 print:text-zinc-700">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
