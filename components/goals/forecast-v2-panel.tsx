"use client";

import { Eyebrow, Panel, Readout } from "@/components/console/console-kit";
import type { ForecastV2View } from "@/lib/goals/forecastV2ViewModel";
import { cn, formatDuration } from "@/lib/utils";

const effectStyle = {
  improves: "text-accent",
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
      <Panel>
        <Eyebrow className="mb-3">Forecast summary (V2)</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Eyebrow>Most likely</Eyebrow>
            <Readout value={forecast.mostLikely} className="mt-1 text-2xl" />
            <p className="mt-0.5 text-xs text-zinc-500">
              {forecast.distanceLabel} · capability base {forecast.capabilityBase}
            </p>
          </div>
          <div>
            <Eyebrow>Realistic range (p25–p75)</Eyebrow>
            <Readout value={forecast.rangeDisplay} className="mt-1 text-lg text-zinc-200" />
            <p className="mt-0.5 text-xs text-zinc-500">
              Conservative {forecast.conservative} · Optimistic {forecast.optimistic}
            </p>
          </div>
          <div>
            <Eyebrow>Confidence</Eyebrow>
            <p className="mt-1 text-lg font-semibold text-zinc-200">{forecast.confidence}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Score <span className="font-mono tabular-nums">{forecast.confidenceScore}/100</span>
            </p>
          </div>
          {forecast.targetGapDisplay ? (
            <div>
              <Eyebrow>Target path</Eyebrow>
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  forecast.targetRealistic ? "text-accent" : "text-amber-400/85",
                )}
              >
                {forecast.targetGapDisplay}
              </p>
              {forecast.targetChance ? (
                <p className="mt-1 text-xs text-zinc-500">{forecast.targetChance}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <Eyebrow className="mb-2.5">How we got this number</Eyebrow>
        <p className="mb-3 text-xs text-zinc-500">
          From raw capability to the most-likely time — each step and what it added.
        </p>
        <div className="overflow-x-auto">
          <ul className="min-w-[420px] space-y-1.5">
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
                      <span className="ml-1 font-mono text-zinc-500">
                        ×{step.factor.toFixed(3)}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "w-28 shrink-0 font-mono tabular-nums",
                      i === 0
                        ? "text-zinc-500"
                        : delta > 0
                          ? "text-amber-400/85"
                          : delta < 0
                            ? "text-accent"
                            : "text-zinc-500",
                    )}
                  >
                    {deltaLabel}
                  </span>
                  <span className="w-20 shrink-0 font-mono font-semibold tabular-nums text-zinc-200">
                    {formatDuration(step.cumulativeSec)}
                  </span>
                  {step.evidence ? <span className="text-zinc-500">{step.evidence}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      {forecast.sensitivity.some((s) => s.direction !== "none") ? (
        <Panel>
          <Eyebrow className="mb-2.5">What would move your time most</Eyebrow>
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
                        <span className="ml-1 text-zinc-500">{s.change}</span>
                      </span>
                      <div className="relative h-3 flex-1 rounded bg-[var(--surface-subdued)] ring-1 ring-inset ring-[var(--border-subtle)]">
                        <div
                          className={cn(
                            "absolute top-0 h-full rounded",
                            faster ? "bg-accent/60" : "bg-amber-500/55",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "w-16 shrink-0 text-right font-mono tabular-nums",
                          s.direction === "none"
                            ? "text-zinc-500"
                            : faster
                              ? "text-accent"
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
        </Panel>
      ) : null}

      <Panel>
        <Eyebrow className="mb-2.5">Performance state breakdown</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forecast.components.map((c) => (
            <div
              key={c.key}
              className="rounded-xl bg-[var(--surface-subdued)] px-3.5 py-3 ring-1 ring-[var(--border-subtle)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{c.label}</span>
                <Readout value={c.score} className="text-lg" />
              </div>
              <p className={cn("mt-1 text-[11px]", effectStyle[c.effect])}>
                {c.effect === "improves"
                  ? "Supports forecast"
                  : c.effect === "weakens"
                    ? "Weakens confidence"
                    : "Neutral"}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{c.explanation}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <Eyebrow className="mb-2.5">What helps the forecast</Eyebrow>
          {forecast.positiveContributors.length === 0 ? (
            <p className="text-sm text-zinc-500">No strong positive signals identified.</p>
          ) : (
            <ul className="space-y-3">
              {forecast.positiveContributors.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 shrink-0 rounded-full bg-accent/70",
                      magnitudeDot[c.magnitude as keyof typeof magnitudeDot] ?? "w-1.5",
                    )}
                  />
                  <div>
                    <p className="text-sm text-zinc-300">{c.label}</p>
                    <p className="text-xs text-zinc-500">{c.evidence}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <Eyebrow className="mb-2.5">What weakens the forecast</Eyebrow>
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
                    <p className="text-xs text-zinc-500">{c.evidence}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <Eyebrow className="mb-2.5">Model agreement</Eyebrow>
        <p className="mb-3 text-xs text-zinc-500">
          {forecast.modelAgreement.explanation} Spread: {forecast.modelAgreement.spread} (
          {forecast.modelAgreement.label} agreement).
        </p>
        <div className="space-y-2.5">
          {forecast.modelRows.map((row) => (
            <div
              key={row.name}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-300">{row.name}</p>
                <p className="truncate text-[11px] text-zinc-500">{row.reason}</p>
              </div>
              <div className="text-right">
                <Readout value={row.time} className="text-lg" />
                <p className="text-[11px] text-zinc-500">
                  Weight <span className="font-mono tabular-nums">{row.weightPct}%</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Eyebrow className="mb-2.5">Scenario forecasts</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2">
          {forecast.scenarios.map((s) => (
            <div
              key={s.name}
              className="rounded-xl bg-[var(--surface-subdued)] px-4 py-3 ring-1 ring-[var(--border-subtle)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">{s.name}</span>
                <Readout value={s.time} className="text-xl" />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{s.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Eyebrow className="mb-2.5">Why the system believes this</Eyebrow>
        <p className="text-sm leading-relaxed text-zinc-400">{forecast.observability.summary}</p>
        {forecast.observability.changeDrivers?.length ? (
          <div className="mt-3 rounded-lg bg-[var(--surface-subdued)] px-3 py-2.5 ring-1 ring-[var(--border-subtle)]">
            <Eyebrow>What changed</Eyebrow>
            <ul className="mt-1 space-y-1 text-xs text-zinc-500">
              {forecast.observability.changeDrivers.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Eyebrow className="mt-4">Evidence chain</Eyebrow>
        <ul className="mt-1 space-y-1 text-xs text-zinc-500">
          {forecast.observability.evidenceChain.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
        {forecast.observability.warnings.length > 0 ? (
          <>
            <Eyebrow className="mt-4">Warnings</Eyebrow>
            <ul className="mt-1 space-y-1 text-xs text-amber-400/80">
              {forecast.observability.warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          </>
        ) : null}
        <>
          <Eyebrow className="mt-4">Why your range is this wide</Eyebrow>
          <p className="mt-1 text-xs text-zinc-500">
            Prediction spread ±{formatDuration(Math.round(forecast.raw.uncertaintyWidthSec / 2))},
            built from:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-baseline gap-3 text-xs">
              <span className="w-16 shrink-0 font-mono tabular-nums text-zinc-500">
                +{forecast.raw.uncertaintyBaseWidthSec}s
              </span>
              <span className="text-zinc-500">Baseline model variability (irreducible)</span>
            </li>
            {[...forecast.raw.uncertaintyDrivers]
              .sort((a, b) => b.widthSec - a.widthSec)
              .map((u) => (
                <li key={u.label} className="flex items-baseline gap-3 text-xs">
                  <span className="w-16 shrink-0 font-mono tabular-nums text-amber-400/85">
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
          <p className="mt-4 text-sm text-accent/85">{forecast.targetPath}</p>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">{forecast.recommendation}</p>
        {forecast.limitations.length > 0 ? (
          <p className="mt-3 text-[11px] text-zinc-500">
            Limitations: {forecast.limitations.slice(0, 3).join(" · ")}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
