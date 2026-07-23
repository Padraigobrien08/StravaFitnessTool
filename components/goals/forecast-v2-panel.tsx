"use client";

import { PanelChrome } from "@/components/home/primitives/panel-chrome";
import { dash } from "@/components/home/primitives/tokens";
import type { ForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import { cn, formatDuration } from "@/lib/utils";

const effectStyle = {
  improves: "text-teal-400/90",
  weakens: "text-amber-400/85",
  neutral: "text-zinc-500",
};

const magnitudeDot = {
  small: "w-1.5",
  medium: "w-2",
  large: "w-2.5",
};

export function ForecastV2Panel({ forecast }: { forecast: ForecastV2View }) {
  return (
    <div className="space-y-4">
      <PanelChrome title="Forecast summary (V2)" accent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={dash.label}>Most likely</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white">
              {forecast.mostLikely}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {forecast.distanceLabel} · capability base {forecast.capabilityBase}
            </p>
          </div>
          <div>
            <p className={dash.label}>Realistic range (p25–p75)</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-200">
              {forecast.rangeDisplay}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              Conservative {forecast.conservative} · Optimistic {forecast.optimistic}
            </p>
          </div>
          <div>
            <p className={dash.label}>Confidence</p>
            <p className="text-lg font-semibold text-zinc-200">{forecast.confidence}</p>
            <p className="mt-0.5 text-xs text-zinc-600">Score {forecast.confidenceScore}/100</p>
          </div>
          {forecast.targetGapDisplay ? (
            <div>
              <p className={dash.label}>Target path</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  forecast.targetRealistic ? "text-teal-400/90" : "text-amber-400/85",
                )}
              >
                {forecast.targetGapDisplay}
              </p>
              {forecast.targetChance ? (
                <p className="mt-1 text-xs text-zinc-600">{forecast.targetChance}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </PanelChrome>

      <PanelChrome title="How we got this number" subdued>
        <p className="mb-3 text-xs text-zinc-500">
          From raw capability to the most-likely time — each step and what it added.
        </p>
        <ul className="space-y-1.5">
          {forecast.raw.derivation.map((step, i) => {
            const delta = step.deltaSec;
            const deltaLabel =
              i === 0
                ? "base"
                : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatDuration(Math.abs(delta))}${delta > 0 ? " slower" : delta < 0 ? " faster" : ""}`;
            return (
              <li key={step.key} className="flex items-baseline gap-3 text-xs">
                <span className="w-32 shrink-0 font-medium text-zinc-300">
                  {step.label}
                  {step.factor != null ? (
                    <span className="ml-1 text-zinc-600">×{step.factor.toFixed(3)}</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "w-28 shrink-0 tabular-nums",
                    i === 0
                      ? "text-zinc-500"
                      : delta > 0
                        ? "text-amber-400/85"
                        : delta < 0
                          ? "text-teal-400/90"
                          : "text-zinc-500",
                  )}
                >
                  {deltaLabel}
                </span>
                <span className="w-20 shrink-0 tabular-nums font-semibold text-zinc-200">
                  {formatDuration(step.cumulativeSec)}
                </span>
                {step.evidence ? <span className="text-zinc-600">{step.evidence}</span> : null}
              </li>
            );
          })}
        </ul>
      </PanelChrome>

      {forecast.sensitivity.some((s) => s.direction !== "none") ? (
        <PanelChrome title="What would move your time most" subdued>
          <p className="mb-3 text-xs text-zinc-500">
            Each lever changed on its own, holding everything else fixed.
          </p>
          {(() => {
            const maxAbs = Math.max(...forecast.sensitivity.map((s) => Math.abs(s.deltaSec)), 1);
            return (
              <ul className="space-y-2">
                {forecast.sensitivity.map((s) => {
                  const pct = (Math.abs(s.deltaSec) / maxAbs) * 100;
                  const faster = s.deltaSec < 0;
                  return (
                    <li key={s.id} className="flex items-center gap-3 text-xs">
                      <span className="w-36 shrink-0 text-zinc-400">
                        {s.label}
                        <span className="ml-1 text-zinc-600">{s.change}</span>
                      </span>
                      <div className="relative h-3 flex-1 rounded bg-white/[0.03]">
                        <div
                          className={cn(
                            "absolute top-0 h-full rounded",
                            faster ? "bg-teal-500/55" : "bg-amber-500/55",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "w-16 shrink-0 text-right tabular-nums",
                          s.direction === "none"
                            ? "text-zinc-600"
                            : faster
                              ? "text-teal-400/90"
                              : "text-amber-400/85",
                        )}
                      >
                        {s.direction === "none"
                          ? "—"
                          : `${faster ? "−" : "+"}${formatDuration(Math.abs(s.deltaSec))}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </PanelChrome>
      ) : null}

      <PanelChrome title="Performance state breakdown" subdued>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forecast.components.map((c) => (
            <div
              key={c.key}
              className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{c.label}</span>
                <span className="font-display text-lg font-bold tabular-nums text-white">
                  {c.score}
                </span>
              </div>
              <p className={cn("mt-1 text-[11px]", effectStyle[c.effect])}>
                {c.effect === "improves"
                  ? "Supports forecast"
                  : c.effect === "weakens"
                    ? "Weakens confidence"
                    : "Neutral"}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{c.explanation}</p>
            </div>
          ))}
        </div>
      </PanelChrome>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelChrome title="What helps the forecast" accent>
          {forecast.positiveContributors.length === 0 ? (
            <p className="text-sm text-zinc-500">No strong positive signals identified.</p>
          ) : (
            <ul className="space-y-3">
              {forecast.positiveContributors.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 shrink-0 rounded-full bg-teal-500/70",
                      magnitudeDot[c.magnitude as keyof typeof magnitudeDot] ?? "w-1.5",
                    )}
                  />
                  <div>
                    <p className="text-sm text-zinc-300">{c.label}</p>
                    <p className="text-xs text-zinc-600">{c.evidence}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelChrome>

        <PanelChrome title="What weakens the forecast" subdued>
          {forecast.negativeContributors.length === 0 ? (
            <p className="text-sm text-zinc-500">No major negative contributors.</p>
          ) : (
            <ul className="space-y-3">
              {forecast.negativeContributors.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 shrink-0 rounded-full bg-amber-500/60",
                      magnitudeDot[c.magnitude as keyof typeof magnitudeDot] ?? "w-1.5",
                    )}
                  />
                  <div>
                    <p className="text-sm text-zinc-300">{c.label}</p>
                    <p className="text-xs text-zinc-600">{c.evidence}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelChrome>
      </div>

      <PanelChrome title="Model agreement" accent>
        <p className={`${dash.muted} mb-3`}>
          {forecast.modelAgreement.explanation} Spread: {forecast.modelAgreement.spread} (
          {forecast.modelAgreement.label} agreement).
        </p>
        <div className="space-y-2.5">
          {forecast.modelRows.map((row) => (
            <div
              key={row.name}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-300">{row.name}</p>
                <p className="text-[11px] text-zinc-600 truncate">{row.reason}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold tabular-nums text-white">{row.time}</p>
                <p className="text-[11px] text-zinc-600">Weight {row.weightPct}%</p>
              </div>
            </div>
          ))}
        </div>
      </PanelChrome>

      <PanelChrome title="Scenario forecasts" subdued>
        <div className="grid gap-3 sm:grid-cols-2">
          {forecast.scenarios.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{s.name}</span>
                <span className="font-display text-xl font-bold tabular-nums text-white">
                  {s.time}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{s.description}</p>
            </div>
          ))}
        </div>
      </PanelChrome>

      <PanelChrome title="Why the system believes this" accent>
        <p className="text-sm leading-relaxed text-zinc-400">{forecast.observability.summary}</p>
        {forecast.observability.changeDrivers?.length ? (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className={dash.label}>What changed</p>
            <ul className="mt-1 space-y-1 text-xs text-zinc-500">
              {forecast.observability.changeDrivers.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={`${dash.label} mt-4`}>Evidence chain</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-600">
          {forecast.observability.evidenceChain.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
        {forecast.observability.warnings.length > 0 ? (
          <>
            <p className={`${dash.label} mt-4`}>Warnings</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-400/80">
              {forecast.observability.warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          </>
        ) : null}
        <>
          <p className={`${dash.label} mt-4`}>Why your range is this wide</p>
          <p className="mt-1 text-xs text-zinc-500">
            Prediction spread ±{formatDuration(Math.round(forecast.raw.uncertaintyWidthSec / 2))},
            built from:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-baseline gap-3 text-xs">
              <span className="w-16 shrink-0 tabular-nums text-zinc-500">
                +{forecast.raw.uncertaintyBaseWidthSec}s
              </span>
              <span className="text-zinc-500">Baseline model variability (irreducible)</span>
            </li>
            {[...forecast.raw.uncertaintyDrivers]
              .sort((a, b) => b.widthSec - a.widthSec)
              .map((u) => (
                <li key={u.label} className="flex items-baseline gap-3 text-xs">
                  <span className="w-16 shrink-0 tabular-nums text-amber-400/85">
                    +{u.widthSec}s
                  </span>
                  <span className="text-zinc-500">
                    <span className="text-zinc-400">{u.label}</span> — {u.explanation}
                  </span>
                </li>
              ))}
          </ul>
        </>
        {forecast.targetPath ? (
          <p className="mt-4 text-sm text-teal-400/85">{forecast.targetPath}</p>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-zinc-600">{forecast.recommendation}</p>
        {forecast.limitations.length > 0 ? (
          <p className="mt-3 text-[11px] text-zinc-600">
            Limitations: {forecast.limitations.slice(0, 3).join(" · ")}
          </p>
        ) : null}
      </PanelChrome>
    </div>
  );
}
