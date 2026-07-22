import { afterEach, describe, expect, it } from "vitest";
import { formatDistanceKm, formatKm, formatKmRange, formatKmValue, formatPace } from "../utils";
import { useSettingsStore } from "@/stores/settings-store";

// Verifies the store-read wiring: with no explicit unit argument, the lib/utils
// formatters honor the athlete's saved preference (metric by default — which is
// also what server paths get, since the store never hydrates there).
const reset = () => useSettingsStore.setState({ distanceUnit: "km", paceUnit: "min/km" });

afterEach(reset);

describe("lib/utils formatters read the settings store", () => {
  it("default to metric", () => {
    reset();
    expect(formatKm(10)).toBe("10 km");
    expect(formatPace(300)).toBe("5:00/km");
    expect(formatDistanceKm(5000)).toBe("5 km");
    expect(formatKmValue(8)).toBe("8");
    expect(formatKmRange(6, 8)).toBe("6–8 km");
  });

  it("switch to imperial when the saved preference is miles", () => {
    useSettingsStore.setState({ distanceUnit: "mi", paceUnit: "min/mi" });
    expect(formatKm(10)).toBe("6.2 mi");
    expect(formatPace(300)).toBe("8:03/mi");
    expect(formatDistanceKm(1609.344)).toBe("1 mi");
    expect(formatKmRange(16.09344, 32.18688)).toBe("10–20 mi");
  });

  it("still honors an explicit unit override regardless of the store", () => {
    useSettingsStore.setState({ distanceUnit: "mi", paceUnit: "min/mi" });
    expect(formatKm(10, "km")).toBe("10 km");
    expect(formatPace(300, "min/km")).toBe("5:00/km");
  });
});
