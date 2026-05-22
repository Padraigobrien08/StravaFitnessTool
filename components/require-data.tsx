"use client";

import Link from "next/link";
import { useStrava } from "@/lib/context/strava-context";
import { Button } from "@/components/ui/button";

export function RequireData({ children }: { children: React.ReactNode }) {
  const { importData } = useStrava();

  if (!importData) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-lg text-zinc-300">No Strava data loaded yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Connect Strava or upload a bulk export folder to see insights.
        </p>
        <Link
          href="/import"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-500 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
        >
          Go to import
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
