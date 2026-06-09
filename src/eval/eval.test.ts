import { describe, it, expect } from "vitest";
import { generateQuestions } from "../bench/generator";
import { generateChainInstance } from "../bench/graphs/chain";
import { generateForkInstance } from "../bench/graphs/fork";
import { generateColliderInstance } from "../bench/graphs/collider";
import { generateMbiasInstance } from "../bench/graphs/mbias";
import { generateInstrumentInstance } from "../bench/graphs/instrument";
import { generateFrontdoorInstance } from "../bench/graphs/frontdoor";
import { generateBackdoorInstance } from "../bench/graphs/backdoor";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { OpenAIProvider } from "./openai";
import { ExactSolverProvider } from "./solver";
import { runEval, formatSummary } from "./runner";
import { writeFileSync } from "fs";
import { join } from "path";

const N_PER_FAMILY = 35;
// chain:3, fork:4, collider:3, mbias:4, instrument:4, frontdoor:3, backdoor:3 = 24 per family-set
const Q_PER_SET = 24;
const TOTAL_Q = N_PER_FAMILY * Q_PER_SET;

const INSTANCE_GENERATORS = [
  generateChainInstance,
  generateForkInstance,
  generateColliderInstance,
  generateMbiasInstance,
  generateInstrumentInstance,
  generateFrontdoorInstance,
  generateBackdoorInstance,
];

function generateBenchmarkInstance(seedOffset: number): ReturnType<typeof generateChainInstance>[] {
  return INSTANCE_GENERATORS.map((gen, i) => gen(seedOffset + i * 7));
}

function generateAllInstances(baseSeed: number): ReturnType<typeof generateChainInstance>[] {
  const all: ReturnType<typeof generateChainInstance>[] = [];
  for (let i = 0; i < N_PER_FAMILY; i++) {
    all.push(...generateBenchmarkInstance(baseSeed + i * 100));
  }
  return all;
}

describe("eval benchmark", () => {
  it("generates 200+ parametric questions across 7 graph families", () => {
    const instances = generateAllInstances(0);
    const questions = generateQuestions(instances);
    expect(questions.length).toBeGreaterThanOrEqual(200);
    expect(questions.length).toBe(TOTAL_Q);

    const kinds = new Set(questions.map((q) => q.kind));
    expect(kinds.has("observational")).toBe(true);
    expect(kinds.has("interventional")).toBe(true);
    expect(kinds.has("counterfactual")).toBe(true);

    const graphIds = new Set(questions.map((q) => q.graph_id));
    expect(graphIds.size).toBe(7);

    console.log(`\n  Generated ${questions.length} parametric questions`);
    const kindCounts: Record<string, number> = {};
    const graphCounts: Record<string, number> = {};
    for (const q of questions) {
      kindCounts[q.kind] = (kindCounts[q.kind] || 0) + 1;
      graphCounts[q.graph_id] = (graphCounts[q.graph_id] || 0) + 1;
    }
    for (const [k, v] of Object.entries(kindCounts)) {
      console.log(`    ${k}: ${v}`);
    }
    for (const [k, v] of Object.entries(graphCounts)) {
      console.log(`    ${k}: ${v}`);
    }
  });

  it("exact solver scores 100% on full benchmark", async () => {
    const instances = generateAllInstances(100);
    const questions = generateQuestions(instances);
    const solver = new ExactSolverProvider();
    const { results, summary } = await runEval(solver, questions);
    expect(summary.accuracy).toBe(1);
    expect(results.every((r) => r.correct)).toBe(true);

    const outPath = join(process.cwd(), "results", "solver-baseline.json");
    writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\n  Solver baseline: ${summary.correct}/${summary.total} correct`);
    console.log(`  Saved to ${outPath}`);
  });

  it("runs full Gemini 2.0 Flash benchmark (840 questions)", { timeout: 3_600_000 }, async () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.log("\n  No GEMINI_API_KEY set. Skipping.");
      return;
    }
    const instances = generateAllInstances(900);
    const questions = generateQuestions(instances);
    const provider = new GeminiProvider({ model: "2.0-flash", apiKey: key });
    console.log(`\n  Running ${provider.name} on ${questions.length} questions...`);
    const { results, summary } = await runEval(provider, questions, 2);
    console.log(formatSummary(summary));
    const outPath = join(process.cwd(), "results", "gemini-2.0-flash.json");
    writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\n  Saved to ${outPath}`);
  });

  it("runs against GPT-4o mini if API key is set", { timeout: 600_000 }, async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      console.log("\n  No OPENAI_API_KEY set. Skipping.");
      return;
    }
    const instances = generateAllInstances(600);
    const questions = generateQuestions(instances);
    const provider = new OpenAIProvider({ model: "gpt-4o-mini", apiKey: key });
    console.log(`\n  Running ${provider.name} on ${questions.length} questions...`);
    const { results, summary } = await runEval(provider, questions, 5);
    console.log(formatSummary(summary));
    const outPath = join(process.cwd(), "results", "openai-gpt-4o-mini.json");
    writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\n  Saved to ${outPath}`);
  });

  it("runs against GPT-5.4 if API key is set", { timeout: 600_000 }, async () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      console.log("\n  No OPENAI_API_KEY set. Skipping.");
      return;
    }
    const instances = generateAllInstances(700);
    const questions = generateQuestions(instances);
    const provider = new OpenAIProvider({ model: "gpt-5.4", apiKey: key });
    console.log(`\n  Running ${provider.name} on ${questions.length} questions...`);
    const { results, summary } = await runEval(provider, questions, 5);
    console.log(formatSummary(summary));
    const outPath = join(process.cwd(), "results", "openai-gpt-5.4.json");
    writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\n  Saved to ${outPath}`);
  });

  it("runs against Groq if API key is set", async () => {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      console.log("\n  No GROQ_API_KEY set. Skipping.");
      return;
    }

    const instances = [];
    for (let i = 0; i < 5; i++) {
      instances.push(...generateBenchmarkInstance(i * 100 + 300));
    }
    const questions = generateQuestions(instances);
    const model = GroqProvider.listFreeModels()[0];
    const provider = new GroqProvider({ model, apiKey: key });
    console.log(`\n  Running ${provider.name} on ${questions.length} questions...`);
    const { results, summary } = await runEval(provider, questions);
    console.log(formatSummary(summary));

    const outPath = join(process.cwd(), "results", `groq-${model}.json`);
    writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\n  Saved to ${outPath}`);
  });
});
