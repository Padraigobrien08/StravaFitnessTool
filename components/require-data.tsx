"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStrava } from "@/lib/context/strava-context";

export function RequireData({ children }: { children: React.ReactNode }) {
  const { importData, loadDemo } = useStrava();
  const router = useRouter();

  if (!importData) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-lg text-zinc-300">No data loaded yet</p>
        <p className="mt-2 text-sm text-zinc-500">
          Explore a full sample athlete instantly — no account, no setup — or
          bring your own Strava data.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              loadDemo();
              router.push("/home");
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-teal-300"
          >
            Try the demo
          </button>
          <Link
            href="/import"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-medium text-zinc-200 hover:bg-white/5"
          >
            Import your data
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
