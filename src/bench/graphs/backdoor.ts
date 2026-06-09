import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

type BackdoorTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsTreated: string;
  obsControl: string;
  ivnTreated: string;
};

const THEMES: BackdoorTheme[] = [
  {
    varNames: { Z1: "Age", Z2: "Severity", X: "Drug", Y: "Recovery" },
    valNames: { Z1: { low: "YOUNG", high: "ELDERLY" }, Z2: { low: "MILD", high: "SEVERE" }, X: { no: "PLACEBO", yes: "DRUG" }, Y: { low: "POOR", high: "GOOD" } },
    scenario: "A hospital studies a new drug. Older patients and severe cases are more likely to get the drug, but also have worse recovery.",
    obsTreated: "Among patients who TOOK the drug, what percentage had GOOD recovery?",
    obsControl: "Among patients given a PLACEBO, what percentage had GOOD recovery?",
    ivnTreated: "If the hospital GAVE the drug to ALL patients, what percentage would have GOOD recovery?",
  },
  {
    varNames: { Z1: "Season", Z2: "Brand", X: "Promotion", Y: "Sales" },
    valNames: { Z1: { low: "OFF", high: "PEAK" }, Z2: { low: "UNKNOWN", high: "POPULAR" }, X: { no: "NO PROMO", yes: "PROMO" }, Y: { low: "LOW", high: "HIGH" } },
    scenario: "A retailer studies promotions. Peak season and popular brands get more promotions but also have higher baseline sales.",
    obsTreated: "Among products WITH a promotion, what percentage had HIGH sales?",
    obsControl: "Among products WITH NO promotion, what percentage had HIGH sales?",
    ivnTreated: "If the retailer offered a PROMOTION on every product, what percentage would have HIGH sales?",
  },
  {
    varNames: { Z1: "Soil", Z2: "Rainfall", X: "Fertilizer", Y: "Yield" },
    valNames: { Z1: { low: "POOR", high: "RICH" }, Z2: { low: "DROUGHT", high: "AMPLE" }, X: { no: "NONE", yes: "APPLIED" }, Y: { low: "LOW", high: "HIGH" } },
    scenario: "Agricultural researchers study fertilizer. Rich soil and ample rainfall increase both fertilizer use and crop yield.",
    obsTreated: "Among fields where fertilizer was APPLIED, what percentage had HIGH yield?",
    obsControl: "Among fields with NO fertilizer, what percentage had HIGH yield?",
    ivnTreated: "If fertilizer were APPLIED to every field, what percentage would have HIGH yield?",
  },
];

function buildCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pZ1 = randomProbs(rng, 2);
  const pZ2 = randomProbs(rng, 2);
  const pX_given = {
    "Z1=low,Z2=low": randomProbs(rng, 2), "Z1=low,Z2=high": randomProbs(rng, 2),
    "Z1=high,Z2=low": randomProbs(rng, 2), "Z1=high,Z2=high": randomProbs(rng, 2),
  };
  const pY_given = {
    "X=no,Z1=low,Z2=low": randomProbs(rng, 2), "X=no,Z1=low,Z2=high": randomProbs(rng, 2),
    "X=no,Z1=high,Z2=low": randomProbs(rng, 2), "X=no,Z1=high,Z2=high": randomProbs(rng, 2),
    "X=yes,Z1=low,Z2=low": randomProbs(rng, 2), "X=yes,Z1=low,Z2=high": randomProbs(rng, 2),
    "X=yes,Z1=high,Z2=low": randomProbs(rng, 2), "X=yes,Z1=high,Z2=high": randomProbs(rng, 2),
  };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    Z1: { "": round(pZ1) },
    Z2: { "": round(pZ2) },
    X: {
      "Z1=low,Z2=low": round(pX_given["Z1=low,Z2=low"]), "Z1=low,Z2=high": round(pX_given["Z1=low,Z2=high"]),
      "Z1=high,Z2=low": round(pX_given["Z1=high,Z2=low"]), "Z1=high,Z2=high": round(pX_given["Z1=high,Z2=high"]),
    },
    Y: {
      "X=no,Z1=low,Z2=low": round(pY_given["X=no,Z1=low,Z2=low"]), "X=no,Z1=low,Z2=high": round(pY_given["X=no,Z1=low,Z2=high"]),
      "X=no,Z1=high,Z2=low": round(pY_given["X=no,Z1=high,Z2=low"]), "X=no,Z1=high,Z2=high": round(pY_given["X=no,Z1=high,Z2=high"]),
      "X=yes,Z1=low,Z2=low": round(pY_given["X=yes,Z1=low,Z2=low"]), "X=yes,Z1=low,Z2=high": round(pY_given["X=yes,Z1=low,Z2=high"]),
      "X=yes,Z1=high,Z2=low": round(pY_given["X=yes,Z1=high,Z2=low"]), "X=yes,Z1=high,Z2=high": round(pY_given["X=yes,Z1=high,Z2=high"]),
    },
  };
}

export function generateBackdoorInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "yes" }, scenario: theme.scenario, query: theme.obsTreated },
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "no" }, scenario: theme.scenario, query: theme.obsControl },
    { kind: "interventional", targetVar: "Y", targetVal: "high", interventionVar: "X", interventionVal: "yes", scenario: theme.scenario, query: theme.ivnTreated },
  ];
  return {
    id: "backdoor",
    name: `${theme.varNames.Z1}, ${theme.varNames.Z2} \u2192 ${theme.varNames.X} \u2192 ${theme.varNames.Y}`,
    description: `${theme.varNames.Z1} and ${theme.varNames.Z2} both confound the relationship between ${theme.varNames.X} and ${theme.varNames.Y}.`,
    variables: [
      { id: "Z1", name: theme.varNames.Z1, values: ["low", "high"], parents: [], role: "confounder" as const },
      { id: "Z2", name: theme.varNames.Z2, values: ["low", "high"], parents: [], role: "confounder" as const },
      { id: "X", name: theme.varNames.X, values: ["no", "yes"], parents: ["Z1", "Z2"], role: "exposure" as const },
      { id: "Y", name: theme.varNames.Y, values: ["low", "high"], parents: ["X", "Z1", "Z2"], role: "outcome" as const },
    ],
    edges: [
      { from: "Z1", to: "X" }, { from: "Z1", to: "Y" },
      { from: "Z2", to: "X" }, { from: "Z2", to: "Y" },
      { from: "X", to: "Y" },
    ],
    cpts,
    questionSpecs: specs,
  };
}

export const backdoorGraph: CausalGraph = generateBackdoorInstance(0);
