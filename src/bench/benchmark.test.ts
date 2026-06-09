import { describe, it, expect } from "vitest";
import { generateQuestions, generateBenchmark } from "./generator";
import { generateChainInstance } from "./graphs/chain";
import { generateForkInstance } from "./graphs/fork";
import { generateColliderInstance } from "./graphs/collider";
import { generateMbiasInstance } from "./graphs/mbias";

describe("parametric benchmark", () => {
  it("generates all question types for parametric instances", () => {
    const graphs = [
      generateChainInstance(42),
      generateForkInstance(43),
      generateColliderInstance(44),
      generateMbiasInstance(45),
    ];
    const questions = generateQuestions(graphs);
    expect(questions.length).toBeGreaterThanOrEqual(12);

    const kinds = new Set(questions.map((q) => q.kind));
    expect(kinds.has("observational")).toBe(true);
    expect(kinds.has("interventional")).toBe(true);

    for (const q of questions) {
      expect(q.graph_id).toBeTruthy();
      expect(q.choices).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
    }

    console.log(`\nGenerated ${questions.length} questions from parametric instances:\n`);
    for (const q of questions) {
      console.log(`[${q.id}] ${q.kind} \u2014 ${q.graph_id}`);
      console.log(`  ${q.scenario.substring(0, 80)}...`);
      console.log(`  Q: ${q.query.substring(0, 80)}...`);
      console.log(`  Answer: ${"ABCD"[q.answer]} (${q.choices[q.answer]})`);
      console.log();
    }
  });

  it("different seeds produce different answers", () => {
    const q1 = generateQuestions([generateChainInstance(0)]);
    const q2 = generateQuestions([generateChainInstance(999)]);
    const answers1 = q1.map((q) => q.choices[q.answer]);
    const answers2 = q2.map((q) => q.choices[q.answer]);
    expect(answers1).not.toEqual(answers2);
  });

  it("generateBenchmark alias works", () => {
    const graphs = [generateChainInstance(100), generateForkInstance(101)];
    const questions = generateBenchmark(graphs);
    expect(questions.length).toBe(7);
  });
});
