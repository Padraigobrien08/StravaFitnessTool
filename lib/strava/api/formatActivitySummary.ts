import type { StravaActivityDetail } from "./fetchActivity";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPaceMps(mps: number | null | undefined): string {
  if (!mps || mps <= 0) return "—";
  const secPerKm = 1000 / mps;
  return formatDuration(secPerKm) + "/km";
}

/** Human-readable activity block for LLM tools. */
export function formatActivitySummary(activity: StravaActivityDetail): string {
  const lines: string[] = [
    `# ${activity.name}`,
    `- ID: ${activity.id}`,
    `- Type: ${activity.sport_type ?? activity.type}`,
    `- Date: ${activity.start_date_local ?? activity.start_date}`,
    `- Distance: ${((activity.distance ?? 0) / 1000).toFixed(2)} km`,
    `- Moving time: ${formatDuration(activity.moving_time ?? 0)}`,
    `- Elevation: ${(activity.total_elevation_gain ?? 0).toFixed(0)} m`,
  ];
  if (activity.average_speed != null) {
    lines.push(`- Avg pace/speed: ${formatPaceMps(activity.average_speed)}`);
  }
  if (activity.average_heartrate != null) {
    lines.push(`- Avg HR: ${Math.round(activity.average_heartrate)} bpm`);
  }
  if (activity.max_heartrate != null) {
    lines.push(`- Max HR: ${Math.round(activity.max_heartrate)} bpm`);
  }
  if (activity.average_watts != null) {
    lines.push(`- Avg power: ${Math.round(activity.average_watts)} W`);
  }
  if (activity.calories != null) {
    lines.push(`- Calories: ${activity.calories}`);
  }
  if (activity.description) {
    lines.push(`- Description: ${activity.description}`);
  }
  return lines.join("\n");
}
