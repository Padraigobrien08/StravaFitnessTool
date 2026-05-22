"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Footprints,
  FileText,
  Dumbbell,
  Target,
  Settings,
  Upload,
  MessageCircle,
} from "lucide-react";

const links = [
  { href: "/home", label: "Home", icon: LayoutDashboard },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/runs", label: "Runs", icon: Footprints },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/report", label: "Reports", icon: FileText },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

const legacy = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trends", label: "Trends" },
  { href: "/effort", label: "Effort" },
  { href: "/records", label: "Records" },
];

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
  const isLegacy = legacy.some((l) => pathname === l.href);
  const isApp = variant === "app" || compact;

  if (isApp) {
    return (
      <nav
        className={cn(
          "flex gap-0.5 overflow-x-auto scrollbar-none",
          className
        )}
        aria-label="Main"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              pathname === href
                ? "bg-teal-500/12 text-teal-300"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("space-y-3 border-b border-white/10 pb-4", className)}>
      <div className="flex flex-wrap gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
      {isLegacy && (
        <p className="text-xs text-zinc-600">
          You&apos;re on a legacy chart page — use Performance or Training for
          insights-first views.
        </p>
      )}
    </nav>
  );
}
