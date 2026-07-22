import type { StravaStreamSet } from "./types";

/** Minimal GPX 1.1 from activity latlng + time streams. */
export function buildActivityGpx(
  activityId: number,
  activityName: string,
  streams: StravaStreamSet | null,
): string {
  const latlng = streams?.latlng?.data as [number, number][] | undefined;
  const time = streams?.time?.data as number[] | undefined;
  if (!latlng?.length) {
    throw new Error("No GPS latlng stream on activity — cannot build GPX");
  }

  const name = escapeXml(activityName || `Activity ${activityId}`);
  const trkpts = latlng
    .map((ll, i) => {
      const ele =
        (streams?.altitude?.data as number[] | undefined)?.[i] != null
          ? `<ele>${(streams!.altitude!.data as number[])[i]}</ele>`
          : "";
      const t = time?.[i] != null ? `<time>${new Date(time[i]! * 1000).toISOString()}</time>` : "";
      return `<trkpt lat="${ll[0]}" lon="${ll[1]}">${ele}${t}</trkpt>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="StrideIQ">
  <trk><name>${name}</name><trkseg>${trkpts}</trkseg></trk>
</gpx>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function activityGpxExport(
  activityId: number,
  activityName: string,
  streams: StravaStreamSet | null,
): { filename: string; contentBase64: string; mimeType: string } {
  const gpx = buildActivityGpx(activityId, activityName, streams);
  return {
    filename: `activity-${activityId}.gpx`,
    contentBase64: Buffer.from(gpx, "utf-8").toString("base64"),
    mimeType: "application/gpx+xml",
  };
}
