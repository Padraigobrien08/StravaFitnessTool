import { describe, expect, it } from "vitest";
import { bestEffortFromPaceStream } from "../bestEfforts";

describe("bestEffortFromPaceStream", () => {
  it("finds fast 5K segment inside a slower long run", () => {
    const stream: { elapsedSec: number; paceSecPerKm: number }[] = [];
    // 30 min easy at 6:00/km
    for (let t = 0; t <= 1800; t += 10) {
      stream.push({ elapsedSec: t, paceSecPerKm: 360 });
    }
    // 25 min fast at 4:00/km (~6.25 km)
    for (let t = 1810; t <= 3310; t += 10) {
      stream.push({ elapsedSec: t, paceSecPerKm: 240 });
    }
    // cool down
    for (let t = 3320; t <= 4000; t += 10) {
      stream.push({ elapsedSec: t, paceSecPerKm: 360 });
    }

    const effort = bestEffortFromPaceStream(stream, 5000, "5k", "5K");
    expect(effort).not.toBeNull();
    expect(effort!.timeSec).toBeLessThan(1500);
    expect(effort!.paceSecPerKm).toBeLessThan(280);
  });
});
