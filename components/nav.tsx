"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarRange, Footprints, MessageCircle, Brain } from "lucide-react";

// Five destinations, one job each. Depth is deliberately not top-level chrome, but it
// does have to be reachable, and for a while this comment claimed a drill-in path that
// did not exist: /training, /report and /context had no inbound link anywhere in the
// app, and /performance was linked only from /training, which was itself unreachable.
// The command palette was the sole route to all four.
//
//   /training     ← Readiness panel on Home ("Load detail")
//   /report       ← change feed on Home ("Full report")
//   /performance  ← load and adaptation panels on /training
//   /context      ← ⌘K only, and that is the honest description of it
//
// The palette is not a hidden shortcut: the header carries a visible ⌘K button
// (components/workspace/shell.tsx) that opens it by click.
const primaryLinks = [
  { href: "/home", label: "Home", icon: LayoutDashboard },
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/runs", label: "Activities", icon: Footprints },
  { href: "/intelligence", label: "Intelligence", icon: Brain },
  { href: "/coach", label: "Coach", icon: MessageCircle },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  compact = false,
  variant = "default",
  className,
}: {
  compact?: boolean;
  variant?: "default" | "app";
  className?: string;
}) {
  const pathname = usePathname();
  const isApp = variant === "app" || compact;

  if (isApp) {
    return (
      <nav className={cn("flex min-w-0 flex-1 items-center gap-1", className)} aria-label="Main">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "type-nav inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
                isActive(pathname, href)
                  ? "bg-accent/15 text-accent"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
              )}
              aria-label={label}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className={cn("space-y-3 border-b border-white/10 pb-4", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {primaryLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(pathname, href)
                ? "bg-accent/15 text-accent"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
