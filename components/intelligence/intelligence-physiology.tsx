"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AthletePhysiology } from "@/lib/analytics/physiology";
import { formatPace } from "@/lib/utils";
import { signalCoachLink } from "@/lib/coach/domainLinks";
import { JargonTerm } from "@/components/jargon-term";
import { Panel } from "@/components/ui/panel";
import { TrendingDown, TrendingUp } from "lucide-react";

export function IntelligencePhysiology({ data }: { data: AthletePhysiology }) {
  const cs = data.criticalSpeed;
  const fr = data.fatigueResistance;
  const dur = data.durability;
  const te = data.thresholdEconomy;
  const cn = data.conditionNormalization;
  // Nothing to show until the athlete has enough spread of efforts to fit.
  if (!cs.available && !fr.available && !dur.available && !te.available && !cn.available)
    return null;
  const showDivider = cs.available || fr.available;
  const showDividerBeforeTe = cs.available || fr.available || dur.available;
  const showDividerBeforeCn = showDividerBeforeTe || te.available;

  return (
    <Panel title="Physiology" hint="fitted to your own efforts, not a lookup table">
      {cs.available ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric
              label={<JargonTerm term="cs">Critical speed</JargonTerm>}
              value={cs.csPaceSecPerKm != null ? formatPace(cs.csPaceSecPerKm) : "—"}
              sub="aerobic ceiling"
            />
            <Metric
              label={<JargonTerm term="dprime">Anaerobic reserve D′</JargonTerm>}
              value={cs.dPrimeMeters != null ? `${cs.dPrimeMeters} m` : "—"}
              sub="distance bank above CS"
            />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            {cs.evidence[1] ?? cs.interpretation}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="capitalize">{cs.confidence} confidence</span>
            {cs.rSquared != null && cs.rSquared >= 0 ? (
              <span>
                · <JargonTerm term="rsquared">R²</JargonTerm>={cs.rSquared.toFixed(2)}
              </span>
            ) : null}
            <span>· {cs.n} efforts</span>
          </div>
          {cs.limitations.length > 0 ? (
            <p className="mt-1.5 text-[10px] leading-snug text-zinc-700">{cs.limitations[0]}</p>
          ) : null}
        </>
      ) : null}

      {fr.available && fr.exponent != null ? (
        <div className={cs.available ? "mt-3 border-t border-white/[0.05] pt-3" : "mt-2"}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-zinc-600">Fatigue resistance</p>
            <TrendGlyph trend={fr.trend} />
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
            Exponent{" "}
            <span className="font-medium tabular-nums text-zinc-100">{fr.exponent.toFixed(2)}</span>{" "}
            <span className="text-zinc-600">vs ~{fr.referenceExponent} reference</span>
            {fr.extraFadePerDoublingPct != null && fr.extraFadePerDoublingPct !== 0 ? (
              <span className="text-zinc-500">
                {" "}
                · {fr.extraFadePerDoublingPct > 0 ? "+" : ""}
                {fr.extraFadePerDoublingPct}% fade / doubling
              </span>
            ) : null}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="capitalize">{fr.confidence} confidence</span>
            {fr.rSquared != null && fr.rSquared >= 0 ? (
              <span>
                · <JargonTerm term="rsquared">R²</JargonTerm>={fr.rSquared.toFixed(2)}
              </span>
            ) : null}
            <span>· {fr.n} efforts</span>
          </div>
        </div>
      ) : null}

      {dur.available && dur.score != null ? (
        <div className={showDivider ? "mt-3 border-t border-white/[0.05] pt-3" : "mt-2"}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-zinc-600">Durability</p>
            <TrendGlyph trend={dur.trend} />
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
            <span className="font-medium tabular-nums text-zinc-100">{dur.score}</span>
            <span className="text-zinc-600">/100</span>
            <span className="ml-1.5 capitalize text-zinc-500">{dur.label}</span>
            <span className="text-zinc-600"> · holding pace deep into long runs</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-600">
            {dur.decouplingMedianPct != null ? (
              <span>
                HR drift {dur.decouplingMedianPct > 0 ? "+" : ""}
                {dur.decouplingMedianPct}%
              </span>
            ) : null}
            {dur.lateFadeMedianPct != null ? (
              <span>
                · late fade {dur.lateFadeMedianPct > 0 ? "+" : ""}
                {dur.lateFadeMedianPct}%
              </span>
            ) : null}
            <span className="capitalize">· {dur.confidence} confidence</span>
            <span>· {dur.sampleSize} runs</span>
          </div>
        </div>
      ) : null}

      {te.available ? (
        <div className={showDividerBeforeTe ? "mt-3 border-t border-white/[0.05] pt-3" : "mt-2"}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-zinc-600">Threshold &amp; economy</p>
            {te.economyTrend ? <TrendGlyph trend={te.economyTrend} /> : null}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
            {te.ltPaceSecPerKm != null ? (
              <>
                Threshold{" "}
                <span className="font-medium tabular-nums text-zinc-100">
                  {formatPace(te.ltPaceSecPerKm)}
                </span>
                {te.ltHr != null ? <span className="text-zinc-600"> @ {te.ltHr} bpm</span> : null}
                {te.ltPctMaxHr != null ? (
                  <span className="text-zinc-600"> ({Math.round(te.ltPctMaxHr * 100)}% max)</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">Economy tracked; threshold pending tempo work</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-600">
            {te.economyIndex != null ? (
              <span>
                economy {te.economyIndex.toFixed(3)}
                {te.economyTrend ? ` · ${te.economyTrend}` : ""}
              </span>
            ) : null}
            <span className="capitalize">· {te.confidence} confidence</span>
          </div>
        </div>
      ) : null}

      {cn.available ? (
        <div className={showDividerBeforeCn ? "mt-3 border-t border-white/[0.05] pt-3" : "mt-2"}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] text-zinc-600">Condition-adjusted</p>
            {cn.normalizedEfficiencyTrend ? (
              <TrendGlyph trend={cn.normalizedEfficiencyTrend} />
            ) : null}
          </div>
          {cn.example ? (
            <p className="mt-0.5 text-[13px] leading-snug text-zinc-300">
              {cn.example.runName} at{" "}
              <span className="tabular-nums text-zinc-100">{cn.example.tempC}°C</span> reads{" "}
              <span className="font-medium tabular-nums text-zinc-100">
                {cn.example.normalizedZScore >= 0 ? "+" : ""}
                {cn.example.normalizedZScore}σ
              </span>{" "}
              <span className="text-zinc-600">
                (not {cn.example.rawZScore >= 0 ? "+" : ""}
                {cn.example.rawZScore}σ) once heat is removed
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
              Efficiency normalized for heat &amp; grade
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-600">
            <span>
              {cn.hotRunCount} runs above {cn.referenceTempC}°C
            </span>
            <span className="capitalize">· {cn.confidence} confidence</span>
          </div>
        </div>
      ) : null}

      <Link
        href={signalCoachLink(
          "Explain my physiology: critical speed, fatigue resistance, durability, threshold, and heat-adjusted efficiency.",
        )}
        className="mt-2 inline-block text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        Ask Coach
      </Link>
    </Panel>
  );
}

function TrendGlyph({ trend }: { trend: "improving" | "declining" | "stable" | null }) {
  // Improving = fading less = a good direction (rendered subtly, not loud).
  if (trend === "improving") return <TrendingDown className="h-3 w-3 text-[var(--home-good)]" />;
  if (trend === "declining") return <TrendingUp className="h-3 w-3 text-amber-400/70" />;
  return null;
}

function Metric({ label, value, sub }: { label: ReactNode; value: string; sub: string }) {
  return (
    <div className="rounded-md bg-white/[0.025] px-2.5 py-2">
      <p className="text-[10px] text-zinc-600">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium tabular-nums text-zinc-200">{value}</p>
      <p className="text-[9px] text-zinc-600">{sub}</p>
    </div>
  );
}
