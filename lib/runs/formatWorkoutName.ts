export interface WorkoutTitleSegment {
  label: string;
  detail: string;
}

export interface FormattedWorkoutTitle {
  /** Short display line */
  primary: string;
  segments: WorkoutTitleSegment[];
  isStructured: boolean;
}

function formatPaceToken(pace: string): string {
  const p = pace.replace(/\s/g, "");
  if (/^\d+:\d{2}$/.test(p)) return `${p}/km`;
  if (/^\d+\.\d+$/.test(p)) {
    const sec = Math.round(parseFloat(p) * 60);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}/km`;
  }
  return `${pace}/km`;
}

function normalizeWorkoutTitle(name: string): string {
  return name
    .replace(/⬆️|↑|🔼|\bwu\b/gi, "warm-up")
    .replace(/⬇️|↓|🔽|\bcd\b/gi, "cool-down")
    .replace(/\s+/g, " ")
    .trim();
}

function segmentLabel(index: number, total: number, detail: string): string {
  if (/warm[- ]?up/i.test(detail)) return "Warm-up";
  if (/cool[- ]?down/i.test(detail)) return "Cool-down";
  if (total === 1) return "Session";
  if (index === 0) return "Warm-up";
  if (index === total - 1) return "Cool-down";
  if (total === 3 && index === 1) return "Main set";
  return "Interval block";
}

function parsePart(part: string, index: number, total: number): WorkoutTitleSegment {
  const t = part.trim();
  if (/^warm[- ]?up$/i.test(t)) {
    return { label: "Warm-up", detail: "Easy progressive start" };
  }
  if (/^cool[- ]?down$/i.test(t)) {
    return { label: "Cool-down", detail: "Easy finish" };
  }

  const durPace = t.match(/^(\d+:\d+(?::\d+)?|\d+)\s*@\s*([\d:.]+)$/);
  if (durPace) {
    const dur = durPace[1].includes(":") ? durPace[1] : `${durPace[1]} min`;
    return {
      label: segmentLabel(index, total, t),
      detail: `${dur} @ ${formatPaceToken(durPace[2])}`,
    };
  }

  const reps = t.match(/^(\d+)\s*[x×]\s*([\d:.]+(?:\s*km)?|\d+:\d+)/i);
  if (reps) {
    const isMiddle = index > 0 && index < total - 1;
    return {
      label: segmentLabel(index, total, t),
      detail: isMiddle
        ? `${reps[1]} × threshold intervals @ ${formatPaceToken(reps[2].replace(/\s*km/i, ""))}`
        : `${reps[1]} × ${reps[2]}`,
    };
  }

  const countPace = t.match(/^(\d+)\s*@\s*([\d:.]+)$/);
  if (countPace) {
    const isMiddle = index > 0 && index < total - 1;
    return {
      label: segmentLabel(index, total, t),
      detail: isMiddle
        ? `${countPace[1]} × intervals @ ${formatPaceToken(countPace[2])}`
        : `${countPace[1]} × ${formatPaceToken(countPace[2])}`,
    };
  }

  return { label: segmentLabel(index, total, t), detail: t };
}

/** Turn noisy Strava titles into scannable workout structure. */
export function formatWorkoutTitle(name: string): FormattedWorkoutTitle {
  const trimmed = normalizeWorkoutTitle(name.trim());
  if (!trimmed) {
    return { primary: "Untitled run", segments: [], isStructured: false };
  }

  const hasStructure =
    /@/.test(trimmed) ||
    /\d+\s*[x×]\s*\d/i.test(trimmed) ||
    (trimmed.includes(",") && trimmed.length > 12);

  if (!hasStructure) {
    const short = trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
    return { primary: short, segments: [], isStructured: false };
  }

  const parts = trimmed
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const segments = parts.map((p, i) => parsePart(p, i, parts.length));
  const primary =
    segments.length === 1 ? segments[0].detail : segments.map((s) => s.detail).join(" · ");

  return {
    primary: primary.length > 56 ? `${primary.slice(0, 53)}…` : primary,
    segments,
    isStructured: true,
  };
}

/** Expand search queries to workout types and markers */
export function semanticSearchTokens(query: string): {
  types: string[];
  markers: string[];
  text: string;
} {
  const q = query.trim().toLowerCase();
  const types: string[] = [];
  const markers: string[] = [];

  if (/\b(tempo|threshold|cruise|lt)\b/.test(q)) types.push("tempo");
  if (/\b(interval|fartlek|repeat|vo2)\b/.test(q)) types.push("interval");
  if (/\b(long|lsd|endurance)\b/.test(q)) types.push("long");
  if (/\b(recovery|shakeout|easy)\b/.test(q)) types.push("recovery", "easy");
  if (/\b(race|parkrun)\b/.test(q)) types.push("race");
  if (/\b(pr|record|best)\b/.test(q)) markers.push("pr");
  if (/\b(long run|long-run)\b/.test(q)) markers.push("long");

  return { types, markers, text: q };
}
