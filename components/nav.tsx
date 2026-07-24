"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, CalendarRange, Footprints, MessageCircle, Brain } from "lucide-react";

// Five destinations, one job each. Depth (Performance, Training, Reports,
// Activity context) is reached by drilling into Home tiles or via ⌘K — it is
// deliberately not top-level chrome. See docs/COACH_AND_INTELLIGENCE.md.
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
                  ? "bg-teal-500/15 text-teal-300"
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
                ? "bg-teal-500/15 text-teal-300"
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
