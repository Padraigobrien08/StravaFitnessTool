import { describe, expect, it } from "vitest";
import { parseWeeklyTrainingPlan, WEEKLY_TRAINING_PLAN_JSON_SCHEMA } from "../weeklyPlanSchema";

/**
 * The JSON schema sent to OpenAI and the Zod schema used to parse the reply are two
 * descriptions of one contract, maintained by hand, in the same file. When they drifted
 * the failure was silent and total: OpenAI rejected every request with
 *
 *   400 ... 'required' is required to be supplied and to be an array including every
 *   key in properties. Missing 'durationMin'.
 *
 * and `generateWeeklyPlanFromContext` swallowed it, returning the deterministic
 * fallback. Every AI plan was rule-based, indefinitely, while the only visible symptom
 * was a plan that said "This is a fallback plan".
 *
 * These tests hold both halves of the contract without spending an API call, so CI can
 * run them. Only a live request can prove the schema is *accepted* — see
 * docs/LIMITATIONS.md on what that check does and does not establish.
 */

// The schema is declared `as const`, so every array on it is readonly.
type JsonSchemaNode = {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchemaNode;
};

/** Every object node, depth-first, with a path for readable failures. */
function objectNodes(node: JsonSchemaNode, path = "root"): [string, JsonSchemaNode][] {
  const found: [string, JsonSchemaNode][] = [];
  if (node.properties) {
    found.push([path, node]);
    for (const [key, child] of Object.entries(node.properties)) {
      found.push(...objectNodes(child, `${path}.${key}`));
    }
  }
  if (node.items) found.push(...objectNodes(node.items, `${path}[]`));
  return found;
}

describe("OpenAI strict structured-output rules", () => {
  const root = WEEKLY_TRAINING_PLAN_JSON_SCHEMA.schema as JsonSchemaNode;

  it("is declared strict, which is what imposes the rules below", () => {
    expect(WEEKLY_TRAINING_PLAN_JSON_SCHEMA.strict).toBe(true);
  });

  it("lists every property in `required`, at every level", () => {
    for (const [path, node] of objectNodes(root)) {
      const properties = Object.keys(node.properties ?? {}).sort();
      const required = [...(node.required ?? [])].sort();
      expect(required, `${path}: required must include every key in properties`).toEqual(
        properties,
      );
    }
  });

  it("expresses optional fields as nullable rather than by omission", () => {
    // Strict mode has no optional keys, so anything the model may leave out has to
    // accept null. These five are the ones the Zod schema treats as optional.
    const nullable = [
      "root.totalRunDistanceKm",
      "root.totalTrainingMinutes",
      "root.alternatives",
      "root.workouts[].durationMin",
      "root.workouts[].distanceKm",
    ];
    const typeAt = (path: string): string | readonly string[] | undefined => {
      let node: JsonSchemaNode | undefined = root;
      for (const seg of path.split(".").slice(1)) {
        const key = seg.replace("[]", "");
        node = node?.properties?.[key];
        if (seg.endsWith("[]")) node = node?.items;
      }
      return node?.type;
    };
    for (const path of nullable) {
      expect(typeAt(path), `${path} must accept null`).toContain("null");
    }
  });
});

describe("the parser accepts what the schema permits", () => {
  const workout = {
    day: "Monday",
    modality: "run",
    type: "easy",
    title: "Easy run",
    durationMin: 40,
    distanceKm: 8,
    intensity: "easy",
    purpose: "Aerobic maintenance",
    constraintsApplied: [],
    reasoning: "Keeps volume steady.",
  };
  const plan = {
    weekStart: "2026-08-10",
    planType: "maintain",
    summary: "A steady week of aerobic running with one quality session.",
    totalRunDistanceKm: 40,
    totalTrainingMinutes: 240,
    hardSessionCount: 1,
    workouts: [workout, workout, workout],
    rationale: {
      primaryGoal: "Maintain aerobic base",
      evidenceUsed: ["Recent volume steady"],
      tradeoffs: [],
      risksManaged: [],
    },
    confidence: "medium",
    limitations: ["Adjust to feel."],
    alternatives: [],
  };

  it("parses a fully populated plan", () => {
    const parsed = parseWeeklyTrainingPlan(plan);
    expect(parsed.success).toBe(true);
  });

  // The half that was broken: strict mode sends null for an omitted field, and
  // `.optional()` alone rejects null, which would have failed the parse the moment
  // the API call started succeeding.
  it("parses nulls in every optional field, and erases them", () => {
    const withNulls = {
      ...plan,
      totalRunDistanceKm: null,
      totalTrainingMinutes: null,
      alternatives: null,
      workouts: [{ ...workout, durationMin: null, distanceKm: null }, workout, workout],
    };
    const parsed = parseWeeklyTrainingPlan(withNulls);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.totalRunDistanceKm).toBeUndefined();
    expect(parsed.data.totalTrainingMinutes).toBeUndefined();
    expect(parsed.data.alternatives).toBeUndefined();
    expect(parsed.data.workouts[0].durationMin).toBeUndefined();
    expect(parsed.data.workouts[0].distanceKm).toBeUndefined();
  });

  it("still rejects a plan that breaks the contract", () => {
    expect(parseWeeklyTrainingPlan({ ...plan, workouts: [workout] }).success).toBe(false);
    expect(parseWeeklyTrainingPlan({ ...plan, confidence: "certain" }).success).toBe(false);
    expect(parseWeeklyTrainingPlan({ ...plan, weekStart: "10th August" }).success).toBe(false);
  });
});
