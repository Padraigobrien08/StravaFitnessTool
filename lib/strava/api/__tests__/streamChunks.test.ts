import { describe, expect, it } from "vitest";
import { chunkCompactStreams, selectStreamChunk } from "../streamChunks";
import type { CompactActivityStreams } from "../compactStreams";

describe("streamChunks", () => {
  const payload: CompactActivityStreams = {
    activityId: 1,
    pointCount: 3,
    streams: {
      time: [0, 1, 2],
      heartrate: [140, 145, 150],
    },
    meta: {
      time: { unit: "s", description: "time" },
      heartrate: { unit: "bpm", description: "hr" },
    },
  };

  it("returns single chunk for small payload", () => {
    const chunks = chunkCompactStreams(payload);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkCount).toBe(1);
  });

  it("selects chunk by index", () => {
    const chunks = chunkCompactStreams(payload);
    const one = selectStreamChunk(chunks, "0");
    expect(one).toEqual(chunks[0]);
  });

  it("returns all chunks", () => {
    const chunks = chunkCompactStreams(payload);
    expect(selectStreamChunk(chunks, "all")).toEqual(chunks);
  });
});
