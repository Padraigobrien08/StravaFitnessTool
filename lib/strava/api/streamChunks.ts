import type { CompactActivityStreams } from "./compactStreams";

const TARGET_CHUNK_BYTES = 50_000;

export interface StreamChunk {
  chunkIndex: number;
  chunkCount: number;
  activityId: number;
  data: CompactActivityStreams;
}

/** Split compact stream payload into ~50KB JSON chunks for MCP / serverless limits. */
export function chunkCompactStreams(
  payload: CompactActivityStreams
): StreamChunk[] {
  const full = JSON.stringify(payload);
  if (full.length <= TARGET_CHUNK_BYTES) {
    return [
      {
        chunkIndex: 0,
        chunkCount: 1,
        activityId: payload.activityId,
        data: payload,
      },
    ];
  }

  const keys = Object.keys(payload.streams);
  const chunks: StreamChunk[] = [];
  let current: CompactActivityStreams = {
    activityId: payload.activityId,
    pointCount: payload.pointCount,
    streams: {},
    meta: { ...payload.meta },
    ...(payload.laps ? { laps: [] } : {}),
  };
  let currentSize = JSON.stringify(current).length;

  for (const key of keys) {
    const series = payload.streams[key];
    const piece = JSON.stringify({ [key]: series });
    if (currentSize + piece.length > TARGET_CHUNK_BYTES && Object.keys(current.streams).length > 0) {
      chunks.push(wrapChunk(payload.activityId, chunks.length, current));
      current = {
        activityId: payload.activityId,
        pointCount: payload.pointCount,
        streams: {},
        meta: key in payload.meta ? { [key]: payload.meta[key] } : {},
      };
      currentSize = JSON.stringify(current).length;
    }
    current.streams[key] = series;
    if (key in payload.meta) current.meta[key] = payload.meta[key];
    currentSize = JSON.stringify(current).length;
  }

  if (Object.keys(current.streams).length > 0) {
    chunks.push(wrapChunk(payload.activityId, chunks.length, current));
  }

  if (payload.laps?.length && chunks.length > 0) {
    chunks[chunks.length - 1]!.data.laps = payload.laps;
  }

  const total = chunks.length;
  return chunks.map((c, i) => ({ ...c, chunkIndex: i, chunkCount: total }));
}

function wrapChunk(
  activityId: number,
  index: number,
  data: CompactActivityStreams
): StreamChunk {
  return { chunkIndex: index, chunkCount: 0, activityId, data };
}

export function selectStreamChunk(
  chunks: StreamChunk[],
  chunkParam: string | undefined
): StreamChunk | StreamChunk[] {
  if (!chunkParam || chunkParam === "all") return chunks;
  const idx = parseInt(chunkParam, 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= chunks.length) {
    throw new Error(`Invalid chunk index. Use 0-${chunks.length - 1} or 'all'.`);
  }
  return chunks[idx]!;
}
