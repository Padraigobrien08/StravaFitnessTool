import Link from "next/link";
import { DashboardPanel } from "./dashboard-panel";
import { dash, ops } from "./tokens";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function PanelChrome({
  title,
  href,
  accent,
  subdued,
  elevated,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  href?: string;
  accent?: boolean;
  subdued?: boolean;
  elevated?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(ops.panelShell, className)}>
      <div className={ops.panelHeader}>
        <span className={accent ? dash.labelAccent : dash.label}>{title}</span>
        {href ? (
          <Link
            href={href}
            className="text-[11px] text-zinc-500 transition-colors hover:text-accent"
          >
            Open <ArrowRight className="inline h-3 w-3" />
          </Link>
        ) : null}
      </div>
      <DashboardPanel
        padding="compact"
        subdued={subdued}
        elevated={elevated}
        className={cn("flex flex-col", bodyClassName)}
      >
        {children}
      </DashboardPanel>
    </section>
  );
}
