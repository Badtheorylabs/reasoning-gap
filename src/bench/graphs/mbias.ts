import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

export const mbiasGraph: CausalGraph = {
  id: "mbias",
  name: "M-Bias: Treatment \u2192 Outcome with collider M",
  description: "A study measures treatment (X), outcome (Y), and a mediator M that is affected by two independent factors Z1 and Z2. Z1 also affects X. Z2 also affects Y. M is a collider \u2014 conditioning on it opens a backdoor path between X and Y.",
  variables: [
    { id: "Z1", name: "Factor1", values: ["low", "high"], parents: [], role: "auxiliary" },
    { id: "Z2", name: "Factor2", values: ["low", "high"], parents: [], role: "auxiliary" },
    { id: "X", name: "Treatment", values: ["none", "drug"], parents: ["Z1"], role: "exposure" },
    { id: "M", name: "Biomarker", values: ["negative", "positive"], parents: ["Z1", "Z2"], role: "collider" },
    { id: "Y", name: "Recovery", values: ["no", "partial", "full"], parents: ["Z2", "X"], role: "outcome" },
  ],
  edges: [
    { from: "Z1", to: "X" },
    { from: "Z1", to: "M" },
    { from: "Z2", to: "M" },
    { from: "Z2", to: "Y" },
    { from: "X", to: "Y" },
  ],
  cpts: {
    Z1: { "": [0.5, 0.5] },
    Z2: { "": [0.5, 0.5] },
    X: { "Z1=low": [0.7, 0.3], "Z1=high": [0.3, 0.7] },
    M: { "Z1=low,Z2=low": [0.9, 0.1], "Z1=low,Z2=high": [0.3, 0.7], "Z1=high,Z2=low": [0.4, 0.6], "Z1=high,Z2=high": [0.8, 0.2] },
    Y: { "Z2=low,X=none": [0.7, 0.2, 0.1], "Z2=low,X=drug": [0.5, 0.3, 0.2], "Z2=high,X=none": [0.4, 0.3, 0.3], "Z2=high,X=drug": [0.2, 0.3, 0.5] },
  },
};

type MbiasTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obs: string;
  ivnExposed: string;
  ivnUnexposed: string;
  cfScenario: string;
  cfQuery: string;
};

const THEMES: MbiasTheme[] = [
  {
    varNames: { Z1: "Genetics", Z2: "Lifestyle", X: "Drug", M: "Biomarker", Y: "Recovery" },
    valNames: { Z1: { low: "Low", high: "High" }, Z2: { low: "Poor", high: "Good" }, X: { none: "PLACEBO", drug: "DRUG" }, M: { negative: "NEGATIVE", positive: "POSITIVE" }, Y: { no: "None", partial: "Partial", full: "FULL" } },
    scenario: "A clinical trial tracks a new drug, a biomarker, and patient recovery.",
    obs: "Among patients who TOOK the drug and had a POSITIVE biomarker, what percentage achieved FULL recovery?",
    ivnExposed: "If the trial GAVE the drug to ALL patients, what percentage would achieve FULL recovery?",
    ivnUnexposed: "If the trial gave NO patients the drug, what percentage would achieve FULL recovery?",
    cfScenario: "A patient took the drug and made a FULL recovery.",
    cfQuery: "If that patient had NOT taken the drug, would they still have recovered?",
  },
  {
    varNames: { Z1: "Budget", Z2: "Season", X: "Campaign", M: "Engagement", Y: "Sales" },
    valNames: { Z1: { low: "LOW", high: "HIGH" }, Z2: { low: "OFF", high: "PEAK" }, X: { none: "NONE", drug: "ACTIVE" }, M: { negative: "LOW", positive: "HIGH" }, Y: { no: "Decline", partial: "Flat", full: "Growth" } },
    scenario: "A company runs marketing campaigns and tracks engagement and sales.",
    obs: "Among campaigns that were ACTIVE with HIGH engagement, what percentage saw SALES growth?",
    ivnExposed: "If ALL campaigns were ACTIVE, what percentage would see SALES growth?",
    ivnUnexposed: "If NO campaigns were active, what percentage would see SALES growth?",
    cfScenario: "A campaign was ACTIVE and saw Sales GROWTH.",
    cfQuery: "If that campaign had been INACTIVE, would it still have grown?",
  },
  {
    varNames: { Z1: "Mentorship", Z2: "Team", X: "Training", M: "Satisfaction", Y: "Promotion" },
    valNames: { Z1: { low: "NONE", high: "STRONG" }, Z2: { low: "WEAK", high: "STRONG" }, X: { none: "NO", drug: "YES" }, M: { negative: "LOW", positive: "HIGH" }, Y: { no: "None", partial: "Later", full: "Now" } },
    scenario: "HR analyzes training programs, employee satisfaction, and promotion rates.",
    obs: "Among employees who TOOK training and had HIGH satisfaction, what percentage were promoted NOW?",
    ivnExposed: "If ALL employees took the training, what percentage would be promoted NOW?",
    ivnUnexposed: "If NO employees took the training, what percentage would be promoted NOW?",
    cfScenario: "An employee took training and was promoted NOW.",
    cfQuery: "If that employee had NOT taken training, would they still have been promoted?",
  },
  {
    varNames: { Z1: "Testing", Z2: "Complexity", X: "Review", M: "Coverage", Y: "Bug" },
    valNames: { Z1: { low: "MINIMAL", high: "EXTENSIVE" }, Z2: { low: "SIMPLE", high: "COMPLEX" }, X: { none: "SKIPPED", drug: "DONE" }, M: { negative: "LOW", positive: "HIGH" }, Y: { no: "Present", partial: "Minor", full: "None" } },
    scenario: "A dev team tracks code reviews, test coverage, and bug rates.",
    obs: "Among commits WITH a review and HIGH test coverage, what percentage had NO bugs?",
    ivnExposed: "If ALL commits had a review, what percentage would have NO bugs?",
    ivnUnexposed: "If NO commits had a review, what percentage would have NO bugs?",
    cfScenario: "A commit had a review and NO bugs.",
    cfQuery: "If that commit had NOT been reviewed, would it still have had no bugs?",
  },
  {
    varNames: { Z1: "Content", Z2: "Platform", X: "Boost", M: "Impressions", Y: "Clicks" },
    valNames: { Z1: { low: "BORING", high: "VIRAL" }, Z2: { low: "NICHE", high: "MAINSTREAM" }, X: { none: "ORGANIC", drug: "BOOSTED" }, M: { negative: "LOW", positive: "HIGH" }, Y: { no: "Zero", partial: "Few", full: "Many" } },
    scenario: "A social media team boosts posts and tracks impressions and clicks.",
    obs: "Among BOOSTED posts with HIGH impressions, what percentage got MANY clicks?",
    ivnExposed: "If ALL posts were BOOSTED, what percentage would get MANY clicks?",
    ivnUnexposed: "If NO posts were boosted, what percentage would get MANY clicks?",
    cfScenario: "A post was boosted and got MANY clicks.",
    cfQuery: "If that post had NOT been boosted, would it still have gotten many clicks?",
  },
];

function buildMbiasCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pZ1 = randomProbs(rng, 2);
  const pZ2 = randomProbs(rng, 2);
  const pX_given = { "Z1=low": randomProbs(rng, 2), "Z1=high": randomProbs(rng, 2) };
  const pM_given = {
    "Z1=low,Z2=low": randomProbs(rng, 2),
    "Z1=low,Z2=high": randomProbs(rng, 2),
    "Z1=high,Z2=low": randomProbs(rng, 2),
    "Z1=high,Z2=high": randomProbs(rng, 2),
  };
  const pY_given = {
    "Z2=low,X=none": randomProbs(rng, 3),
    "Z2=low,X=drug": randomProbs(rng, 3),
    "Z2=high,X=none": randomProbs(rng, 3),
    "Z2=high,X=drug": randomProbs(rng, 3),
  };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    Z1: { "": round(pZ1) },
    Z2: { "": round(pZ2) },
    X: { "Z1=low": round(pX_given["Z1=low"]), "Z1=high": round(pX_given["Z1=high"]) },
    M: {
      "Z1=low,Z2=low": round(pM_given["Z1=low,Z2=low"]),
      "Z1=low,Z2=high": round(pM_given["Z1=low,Z2=high"]),
      "Z1=high,Z2=low": round(pM_given["Z1=high,Z2=low"]),
      "Z1=high,Z2=high": round(pM_given["Z1=high,Z2=high"]),
    },
    Y: {
      "Z2=low,X=none": round(pY_given["Z2=low,X=none"]),
      "Z2=low,X=drug": round(pY_given["Z2=low,X=drug"]),
      "Z2=high,X=none": round(pY_given["Z2=high,X=none"]),
      "Z2=high,X=drug": round(pY_given["Z2=high,X=drug"]),
    },
  };
}

export function generateMbiasInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildMbiasCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "Y", targetVal: "full", evidence: { X: "drug", M: "positive" }, scenario: theme.scenario, query: theme.obs },
    { kind: "interventional", targetVar: "Y", targetVal: "full", interventionVar: "X", interventionVal: "drug", scenario: theme.scenario, query: theme.ivnExposed },
    { kind: "interventional", targetVar: "Y", targetVal: "full", interventionVar: "X", interventionVal: "none", scenario: theme.scenario, query: theme.ivnUnexposed },
    { kind: "counterfactual", targetVar: "Y", targetVal: "no", evidence: { X: "drug", Y: "full" }, interventionVar: "X", interventionVal: "none", scenario: theme.cfScenario, query: theme.cfQuery },
  ];
  return {
    id: "mbias",
    name: `M-Bias: ${theme.varNames.X} ${theme.varNames.Y}`,
    description: `${theme.varNames.X} ← ${theme.varNames.Z1} → ${theme.varNames.M} ← ${theme.varNames.Z2} → ${theme.varNames.Y}. Conditioning on ${theme.varNames.M} opens a backdoor path.`,
    variables: [
      { id: "Z1", name: theme.varNames.Z1, values: ["low", "high"], parents: [], role: "auxiliary" as const },
      { id: "Z2", name: theme.varNames.Z2, values: ["low", "high"], parents: [], role: "auxiliary" as const },
      { id: "X", name: theme.varNames.X, values: ["none", "drug"], parents: ["Z1"], role: "exposure" as const },
      { id: "M", name: theme.varNames.M, values: ["negative", "positive"], parents: ["Z1", "Z2"], role: "collider" as const },
      { id: "Y", name: theme.varNames.Y, values: ["no", "partial", "full"], parents: ["Z2", "X"], role: "outcome" as const },
    ],
    edges: [
      { from: "Z1", to: "X" }, { from: "Z1", to: "M" },
      { from: "Z2", to: "M" }, { from: "Z2", to: "Y" },
      { from: "X", to: "Y" },
    ],
    cpts,
    questionSpecs: specs,
  };
}
