import { describe, expect, it } from "vitest";
import { alreadyStated, dedupeByText, isTrainingCurrent, stalenessClause } from "../consistency";
import type { FatigueSnapshot } from "@/lib/analytics/fatigue";

const fatigue = (
  currency: FatigueSnapshot["readiness"]["currency"],
  restDays = 1,
): Pick<FatigueSnapshot, "readiness" | "restDaysSinceLastRun"> => ({
  readiness: { balance: "neutral", currency, volumeRatio: null },
  restDaysSinceLastRun: restDays,
});

describe("isTrainingCurrent", () => {
  it("holds while training is recent", () => {
    expect(isTrainingCurrent(fatigue("current"))).toBe(true);
    expect(isTrainingCurrent(fatigue("light-gap"))).toBe(true);
  });

  it("fails once the data is stale", () => {
    expect(isTrainingCurrent(fatigue("rusty"))).toBe(false);
    expect(isTrainingCurrent(fatigue("detrained"))).toBe(false);
    expect(isTrainingCurrent(fatigue("returning"))).toBe(false);
  });

  it("assumes current when readiness is absent, so old callers do not change behaviour", () => {
    expect(isTrainingCurrent({ readiness: undefined } as unknown as FatigueSnapshot)).toBe(true);
  });
});

describe("stalenessClause", () => {
  it("names the gap, singular and plural", () => {
    expect(stalenessClause({ restDaysSinceLastRun: 1 })).toBe("1 day without a run");
    expect(stalenessClause({ restDaysSinceLastRun: 10 })).toBe("10 days without a run");
  });
});

describe("dedupeByText", () => {
  it("drops repeats regardless of case or trailing punctuation", () => {
    const items = [
      { text: "Efficiency has dipped." },
      { text: "efficiency has dipped" },
      { text: "Freshness supports quality" },
    ];
    expect(dedupeByText(items, (i) => i.text)).toHaveLength(2);
  });

  it("skips empty text rather than treating it as a value", () => {
    expect(dedupeByText([{ text: "  " }, { text: "real" }], (i) => i.text)).toEqual([
      { text: "real" },
    ]);
  });
});

describe("alreadyStated", () => {
  // The live failure: one sentence filled the hero's "Why this", a Risks bullet
  // and the Primary action at once.
  it("recognises a sentence already shown elsewhere", () => {
    const shown = ["Protect the aerobic adaptation trend with polarized easy days."];
    expect(
      alreadyStated("protect the aerobic adaptation trend with polarized easy days", shown),
    ).toBe(true);
    expect(alreadyStated("Freshness supports a quality session window", shown)).toBe(false);
  });

  it("never suppresses on empty text", () => {
    expect(alreadyStated("", ["anything"])).toBe(false);
  });
});
