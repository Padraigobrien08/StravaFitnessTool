"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarRange,
  Footprints,
  FileText,
  Target,
  Settings,
  Upload,
  MessageCircle,
  Brain,
  ChevronDown,
  Dumbbell,
  TrendingUp,
  Layers,
} from "lucide-react";

const primaryLinks = [
  { href: "/home", label: "Home", icon: LayoutDashboard },
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/intelligence", label: "Intelligence", icon: Brain },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/runs", label: "Activities", icon: Footprints },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/import", label: "Import", icon: Upload },
] as const;

const advancedLinks = [
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/report", label: "Reports", icon: FileText },
  { href: "/context", label: "Activity context", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const legacyLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/trends", label: "Trends" },
  { href: "/effort", label: "Effort" },
  { href: "/records", label: "Records" },
  { href: "/activity-mix", label: "Activity mix" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdvancedMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const advancedActive = advancedLinks.some((l) => isActive(pathname, l.href));
  const legacyActive = legacyLinks.some((l) => pathname === l.href);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          advancedActive
            ? "bg-teal-500/12 text-teal-300"
            : legacyActive
              ? "bg-white/[0.06] text-zinc-300"
              : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="hidden md:inline">Advanced</span>
        <span className="md:hidden">More</span>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[100] mt-1.5 max-h-[min(70vh,420px)] min-w-[200px] overflow-y-auto rounded-lg border border-white/[0.1] bg-[#0c0d10] py-1.5 shadow-2xl ring-1 ring-black/40"
        >
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Analytics
          </p>
          {advancedLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                isActive(pathname, href)
                  ? "bg-teal-500/10 text-teal-300"
                  : "text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100"
              )}
              onClick={() => setOpen(false)}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              {label}
            </Link>
          ))}
          <div className="my-1.5 border-t border-white/[0.08]" />
          <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Legacy pages
          </p>
          {legacyLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={cn(
                "block px-3 py-2 text-xs transition-colors",
                pathname === href
                  ? "bg-white/[0.06] text-zinc-200"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              )}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
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

  const linkClass = (href: string, prominent?: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
      isActive(pathname, href)
        ? prominent
          ? "bg-teal-500/15 text-teal-300"
          : "bg-teal-500/12 text-teal-300"
        : prominent
          ? "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
    );

  if (isApp) {
    return (
      <nav
        className={cn("flex min-w-0 flex-1 items-center gap-1", className)}
        aria-label="Main"
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href, href === "/plan")}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </div>
        <AdvancedMenu pathname={pathname} />
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
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
        <AdvancedMenu pathname={pathname} />
      </div>
    </nav>
  );
}
