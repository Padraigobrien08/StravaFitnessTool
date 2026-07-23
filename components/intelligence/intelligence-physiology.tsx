"use client";

import Link from "next/link";
import type { AthletePhysiology } from "@/lib/analytics/physiology";
import { formatPace } from "@/lib/utils";
import { signalCoachLink } from "@/lib/coach/domainLinks";

export function IntelligencePhysiology({ data }: { data: AthletePhysiology }) {
  const cs = data.criticalSpeed;
  // Nothing to show until the athlete has enough spread of efforts to fit.
  if (!cs.available) return null;

  return (
    <section className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[11px] font-medium text-zinc-500">
        Physiology
        <span className="ml-1.5 text-zinc-600">fitted to your own efforts, not a lookup table</span>
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric
          label="Critical speed"
          value={cs.csPaceSecPerKm != null ? formatPace(cs.csPaceSecPerKm) : "—"}
          sub="aerobic ceiling"
        />
        <Metric
          label="Anaerobic reserve D′"
          value={cs.dPrimeMeters != null ? `${cs.dPrimeMeters} m` : "—"}
          sub="distance bank above CS"
        />
      </div>

      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        {cs.evidence[1] ?? cs.interpretation}
      </p>

      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
        <span className="capitalize">{cs.confidence} confidence</span>
        {cs.rSquared != null ? <span>· R²={cs.rSquared.toFixed(2)}</span> : null}
        <span>· {cs.n} efforts</span>
      </div>

      {cs.limitations.length > 0 ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-700">{cs.limitations[0]}</p>
      ) : null}

      <Link
        href={signalCoachLink("Explain my critical speed and anaerobic reserve.")}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md bg-white/[0.025] px-2.5 py-2">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium tabular-nums text-zinc-200">{value}</p>
      <p className="text-[9px] text-zinc-600">{sub}</p>
    </div>
  );
}
