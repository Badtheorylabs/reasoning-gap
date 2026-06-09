import { describe, it, expect } from "vitest";
import { generateQuestions } from "./generator";
import { chainGraph } from "./graphs/chain";
import { forkGraph } from "./graphs/fork";
import { colliderGraph } from "./graphs/collider";
import { mbiasGraph } from "./graphs/mbias";

describe("question generator (fixed graphs)", () => {
  const graphs = [chainGraph, forkGraph, colliderGraph, mbiasGraph];
  const questions = generateQuestions(graphs);

  it("generates questions for all graphs", () => {
    expect(questions.length).toBeGreaterThanOrEqual(10);
  });

  it("every question has 4 choices", () => {
    for (const q of questions) {
      expect(q.choices).toHaveLength(4);
    }
  });

  it("every question has a valid answer index", () => {
    for (const q of questions) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
    }
  });

  it("includes both observational and interventional kinds", () => {
    const kinds = new Set(questions.map((q) => q.kind));
    expect(kinds.has("observational")).toBe(true);
    expect(kinds.has("interventional")).toBe(true);
  });

  it("chain: observational P(P|T=yes) > P(P|T=no)", () => {
    const chainQs = questions.filter((q) => q.graph_id === "chain");
    const trainedHigh = chainQs.find((q) => q.query.includes("COMPLETED"))!;
    const untrainedHigh = chainQs.find((q) => q.query.includes("did NOT"))!;
    const trainedPct = parseInt(trainedHigh.choices[trainedHigh.answer]);
    const untrainedPct = parseInt(untrainedHigh.choices[untrainedHigh.answer]);
    expect(trainedPct).toBeGreaterThan(untrainedPct);
  });
});
