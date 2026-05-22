export function ConfidenceBadge({
  level,
}: {
  level: "low" | "medium" | "high";
}) {
  const labels = {
    low: "Limited data — trends are indicative",
    medium: "Moderate sample — trends are reasonably reliable",
    high: "Solid sample — trends are reliable",
  };
  const colors = {
    low: "text-amber-400/90 border-amber-500/30 bg-amber-500/10",
    medium: "text-sky-400/90 border-sky-500/30 bg-sky-500/10",
    high: "text-emerald-400/90 border-emerald-500/30 bg-emerald-500/10",
  };

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs ${colors[level]}`}
    >
      {labels[level]}
    </span>
  );
}
