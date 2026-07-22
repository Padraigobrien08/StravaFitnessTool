import type { ElevationSegment, TimelinePoint } from "./types";

const MIN_GRADE_PCT = 2.5;
const MIN_SEGMENT_SEC = 30;

export function analyzeElevationSegments(timeline: TimelinePoint[]): ElevationSegment[] {
  const withEle = timeline.filter((p) => p.elevationM != null && Number.isFinite(p.elevationM));
  if (withEle.length < 4) return [];

  const segments: ElevationSegment[] = [];
  let i = 0;
  let segId = 0;

  while (i < withEle.length - 1) {
    const start = withEle[i];
    let j = i + 1;
    let gain = 0;
    let loss = 0;
    let distApprox = 0;

    while (j < withEle.length) {
      const prev = withEle[j - 1];
      const cur = withEle[j];
      const dEle = (cur.elevationM ?? 0) - (prev.elevationM ?? 0);
      const dt = cur.elapsedSec - prev.elapsedSec;
      if (dt <= 0) {
        j++;
        continue;
      }
      distApprox += dt * 3;
      if (dEle > 0) gain += dEle;
      else loss += Math.abs(dEle);

      const grade = distApprox > 0 ? ((gain - loss) / distApprox) * 100 : 0;
      const duration = cur.elapsedSec - start.elapsedSec;

      if (duration >= MIN_SEGMENT_SEC && (grade >= MIN_GRADE_PCT || grade <= -MIN_GRADE_PCT)) {
        const kind =
          grade >= MIN_GRADE_PCT ? "climb" : grade <= -MIN_GRADE_PCT ? "descent" : "flat";
        if (kind !== "flat") {
          segments.push({
            id: `ele-${segId++}`,
            kind,
            startSec: start.elapsedSec,
            endSec: cur.elapsedSec,
            gainM: Math.round((kind === "climb" ? gain : loss) * 10) / 10,
            avgGradePct: Math.round(Math.abs(grade) * 10) / 10,
            label:
              kind === "climb" ? `Climb +${Math.round(gain)}m` : `Descent −${Math.round(loss)}m`,
          });
        }
        i = j;
        break;
      }
      j++;
    }
    if (j >= withEle.length) break;
    i = Math.max(i + 1, j - 1);
  }

  return segments.slice(0, 16);
}
