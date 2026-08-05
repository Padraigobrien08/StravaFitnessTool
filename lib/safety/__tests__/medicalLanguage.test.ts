import { describe, expect, it } from "vitest";
import {
  containsMedicalClaim,
  medicalClaimMatches,
  softenMedicalLanguage,
} from "../medicalLanguage";

/**
 * Regression corpus. This is a safety denylist, so it is tested as one: every
 * clinical phrasing must be caught, and every benign coaching phrase must not be.
 */
const MUST_FLAG = [
  // Clinical verbs — the whole class that previously scored 100/100.
  "This plan will treat your injury.",
  "This will cure your stress fracture.",
  "These sessions heal your tendinitis.",
  "We will rehab your IT band syndrome.",
  "Start physiotherapy alongside this block.",
  "Combine with therapy twice a week.",
  "Take medication before the long run.",
  // Named conditions.
  "Your tendinopathy should settle by week three.",
  "Expect the tendonitis to improve.",
  "This addresses your plantar fasciitis.",
  "Good for shin splints.",
  "Helps with runner's knee.",
  "Manages your patellofemoral pain.",
  "Your bursitis will settle.",
  "Eases sciatica.",
  "Watch for compartment syndrome.",
  "You have overtraining syndrome.",
  "Signs of RED-S.",
  "Your anemia explains the fatigue.",
  "A stress reaction in the tibia.",
  // Diagnosis / prescription.
  "I diagnose overtraining.",
  "Here is your diagnosis.",
  "I prescribe three rest days.",
  "Follow this prescription.",
  // Medical certainty.
  "This is medical advice.",
  "You are medically ready to race.",
  "You are cleared for racing.",
  "An injury-free guarantee.",
  "This guarantees no injury.",
  "This prevents injury.",
  "There is no risk of injury with this plan.",
];

const MUST_NOT_FLAG = [
  // Ordinary training language.
  "Keep most runs easy and hold one quality session.",
  "Build volume gradually across the block.",
  "Add mobility work for your achilles and IT band.",
  "Expect some soreness and general strain in the legs.",
  "Focus on recovery between hard days.",
  "Your aerobic base is improving.",
  "Reduce load if the legs feel heavy.",
  "A healthy dose of easy running.",
  // Benign coaching idiom that borrows a clinical word.
  "Treat this as a recovery week.",
  "Treat that as your key session.",
  "Treat the long run as a rehearsal.",
  // The disclaimers the system itself generates on repair.
  "Not medical advice: consult a professional for injury or health concerns.",
  "This is not a substitute for professional guidance.",
  "Seek medical advice if pain persists.",
  "If you suspect an injury, see a medical professional.",
];

describe("containsMedicalClaim", () => {
  it.each(MUST_FLAG)("flags: %s", (text) => {
    expect(containsMedicalClaim(text)).toBe(true);
  });

  it.each(MUST_NOT_FLAG)("allows: %s", (text) => {
    expect(containsMedicalClaim(text), medicalClaimMatches(text).join(", ")).toBe(false);
  });
});

describe("softenMedicalLanguage", () => {
  it("rewrites diagnosis and prescription wording", () => {
    expect(softenMedicalLanguage("I diagnose overtraining and prescribe rest")).toBe(
      "I assess overtraining and suggest rest",
    );
    expect(softenMedicalLanguage("Your diagnosis is clear")).toBe("Your assessment is clear");
    expect(softenMedicalLanguage("Follow this prescription")).toBe("Follow this suggestion");
  });

  it("rewrites clinical verbs with correct grammar", () => {
    expect(softenMedicalLanguage("This plan treats your legs")).toBe(
      "This plan supports your legs",
    );
    expect(softenMedicalLanguage("treating the issue")).toBe("supporting the issue");
    expect(softenMedicalLanguage("this cures it")).toBe("this helps it");
    expect(softenMedicalLanguage("healing takes time")).toBe("recovery takes time");
    expect(softenMedicalLanguage("rehab your calf")).toBe("recovery work your calf");
  });

  it("downgrades guarantees", () => {
    expect(softenMedicalLanguage("You are guaranteed to improve")).toBe(
      "You are likely to improve",
    );
  });

  it("leaves the benign idiom intact", () => {
    expect(softenMedicalLanguage("Treat this as a recovery week")).toBe(
      "Treat this as a recovery week",
    );
  });

  it("leaves ordinary training prose untouched", () => {
    const text = "Keep most runs easy, build volume gradually, and add achilles mobility.";
    expect(softenMedicalLanguage(text)).toBe(text);
  });
});
