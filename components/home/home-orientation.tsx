"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  CalendarRange,
  Footprints,
  Brain,
  MessageCircle,
  X,
  type LucideIcon,
} from "lucide-react";

const STORAGE_KEY = "strideiq-home-orientation-dismissed-v1";

const SURFACES: { href: string; label: string; blurb: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Home", blurb: "today's state and week", icon: LayoutDashboard },
  { href: "/plan", label: "Plan", blurb: "build your week and race goal", icon: CalendarRange },
  { href: "/runs", label: "Activities", blurb: "every run, explored", icon: Footprints },
  { href: "/intelligence", label: "Intelligence", blurb: "what StrideIQ believes", icon: Brain },
  { href: "/coach", label: "Coach", blurb: "ask why, investigate", icon: MessageCircle },
];

/**
 * First-run orientation: teaches the five-surface model in one glance, then
 * gets out of the way. Shown once per browser (dismissal persisted), never
 * blocks the dashboard. Not a modal — inline, dismissable, low ceremony.
 */
export function HomeOrientation() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
  };

  if (!mounted || dismissed) return null;

  return (
    <section
      aria-label="How StrideIQ is organized"
      className="relative rounded-xl border border-teal-500/15 bg-teal-500/[0.04] px-4 py-3.5 ring-1 ring-teal-500/10"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss orientation"
        className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <p className="font-display text-sm font-semibold text-zinc-100">Find your way around</p>
      <p className="mt-0.5 text-[12px] text-zinc-400">
        Five places, one job each. Deeper analysis lives one click into any card, or press{" "}
        <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 text-[10px] text-zinc-400">
          ⌘K
        </kbd>{" "}
        to jump anywhere.
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map(({ href, label, blurb, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400/80" />
              <span className="min-w-0">
                <span className="text-[12px] font-medium text-zinc-200 group-hover:text-zinc-100">
                  {label}
                </span>
                <span className="text-[11px] text-zinc-500"> · {blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={dismiss}
        className="mt-2.5 text-[11px] font-medium text-teal-300/90 hover:text-teal-200"
      >
        Got it
      </button>
    </section>
  );
}
