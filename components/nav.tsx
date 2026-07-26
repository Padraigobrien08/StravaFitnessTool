"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  CalendarRange,
  Footprints,
  FileText,
  Target,
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
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdvancedMenu({ pathname }: { pathname: string }) {
  const advancedActive = advancedLinks.some((l) => isActive(pathname, l.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-auto shrink-0 gap-1.5 px-2.5 py-1.5 text-xs font-medium",
              advancedActive
                ? "bg-accent/12 text-accent hover:bg-accent/12 hover:text-accent"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
            )}
          />
        }
      >
        <span className="hidden md:inline">Analytics</span>
        <span className="md:hidden">More</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(70vh,420px)] min-w-[200px] overflow-y-auto border-white/[0.1] bg-[#0c0d10] ring-black/40"
      >
        <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Deeper analysis
        </DropdownMenuLabel>
        {advancedLinks.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem
            key={href}
            render={
              <Link
                href={href}
                className={cn(
                  "flex w-full items-center gap-2",
                  isActive(pathname, href) ? "text-accent" : "text-zinc-300",
                )}
              />
            }
            nativeButton={false}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
      "type-nav inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
      isActive(pathname, href)
        ? prominent
          ? "bg-accent/15 text-accent"
          : "bg-accent/12 text-accent"
        : prominent
          ? "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-100"
          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
    );

  if (isApp) {
    return (
      <nav className={cn("flex min-w-0 flex-1 items-center gap-1", className)} aria-label="Main">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {primaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href, href === "/plan")}
              aria-label={label}
              title={label}
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
                ? "bg-accent/15 text-accent"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
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
