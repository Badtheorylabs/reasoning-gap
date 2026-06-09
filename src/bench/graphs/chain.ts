import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

export const chainGraph: CausalGraph = {
  id: "chain",
  name: "Training \u2192 Skill \u2192 Performance",
  description: "A company trains some employees. Training improves skill. Skill improves performance.",
  variables: [
    { id: "T", name: "Training", values: ["no", "yes"], parents: [], role: "exposure" },
    { id: "S", name: "Skill", values: ["low", "medium", "high"], parents: ["T"], role: "mediator" },
    { id: "P", name: "Performance", values: ["low", "medium", "high"], parents: ["S"], role: "outcome" },
  ],
  edges: [
    { from: "T", to: "S" },
    { from: "S", to: "P" },
  ],
  cpts: {
    T: { "": [0.5, 0.5] },
    S: {
      "T=no": [0.7, 0.25, 0.05],
      "T=yes": [0.1, 0.35, 0.55],
    },
    P: {
      "S=low": [0.8, 0.15, 0.05],
      "S=medium": [0.3, 0.5, 0.2],
      "S=high": [0.05, 0.2, 0.75],
    },
  },
};

type ChainTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsTrained: string;
  obsUntrained: string;
  ivn: string;
};

const THEMES: ChainTheme[] = [
  {
    varNames: { T: "Training", S: "Skill", P: "Performance" },
    valNames: { T: { yes: "COMPLETED", no: "did NOT take" }, S: { low: "Low", medium: "Medium", high: "High" }, P: { low: "Low", medium: "Medium", high: "High" } },
    scenario: "A company offers optional Training to employees and tracks their Performance.",
    obsTrained: "Among employees who COMPLETED the training, what percentage achieved HIGH performance?",
    obsUntrained: "Among employees who did NOT take the training, what percentage achieved HIGH performance?",
    ivn: "If the company FORCED every employee to complete the training, what percentage would achieve HIGH performance?",
  },
  {
    varNames: { T: "Lecture", S: "Knowledge", P: "Grade" },
    valNames: { T: { yes: "ATTENDED", no: "SKIPPED" }, S: { low: "Poor", medium: "Adequate", high: "Excellent" }, P: { low: "Failing", medium: "Passing", high: "Excellent" } },
    scenario: "A university offers optional Lectures to students and tracks their final Grades.",
    obsTrained: "Among students who ATTENDED the lectures, what percentage earned an EXCELLENT grade?",
    obsUntrained: "Among students who SKIPPED the lectures, what percentage earned an EXCELLENT grade?",
    ivn: "If the university MANDATED attendance for all students, what percentage would earn an EXCELLENT grade?",
  },
  {
    varNames: { T: "Exercise", S: "Fitness", P: "Health" },
    valNames: { T: { yes: "REGULAR", no: "SEDENTARY" }, S: { low: "Low", medium: "Moderate", high: "High" }, P: { low: "Poor", medium: "Fair", high: "Excellent" } },
    scenario: "A health clinic offers optional Exercise programs to patients and tracks their Health outcomes.",
    obsTrained: "Among patients who did REGULAR exercise, what percentage achieved EXCELLENT health?",
    obsUntrained: "Among patients who were SEDENTARY, what percentage achieved EXCELLENT health?",
    ivn: "If the clinic REQUIRED all patients to exercise regularly, what percentage would achieve EXCELLENT health?",
  },
  {
    varNames: { T: "Practice", S: "Technique", P: "Ranking" },
    valNames: { T: { yes: "INTENSIVE", no: "MINIMAL" }, S: { low: "Basic", medium: "Intermediate", high: "Advanced" }, P: { low: "Low", medium: "Mid", high: "Top" } },
    scenario: "A chess coach assigns optional Practice drills to students and tracks their tournament Rankings.",
    obsTrained: "Among students who did INTENSIVE practice, what percentage achieved a TOP ranking?",
    obsUntrained: "Among students who did MINIMAL practice, what percentage achieved a TOP ranking?",
    ivn: "If the coach MANDATED intensive practice for all students, what percentage would achieve a TOP ranking?",
  },
  {
    varNames: { T: "Ad", S: "Awareness", P: "Purchase" },
    valNames: { T: { yes: "SHOWN", no: "HIDDEN" }, S: { low: "Unaware", medium: "Aware", high: "Interested" }, P: { low: "None", medium: "Some", high: "Many" } },
    scenario: "A marketing team shows optional Ads to users and tracks Purchase behavior.",
    obsTrained: "Among users who were SHOWN the ad, what percentage made MANY purchases?",
    obsUntrained: "Among users who were NOT shown the ad, what percentage made MANY purchases?",
    ivn: "If the platform SHOWED the ad to every user, what percentage would make MANY purchases?",
  },
];

function buildChainCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pT = randomProbs(rng, 2);
  const pS_given_T = { "T=no": randomProbs(rng, 3), "T=yes": randomProbs(rng, 3) };
  const pP_given_S = { "S=low": randomProbs(rng, 3), "S=medium": randomProbs(rng, 3), "S=high": randomProbs(rng, 3) };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    T: { "": round(pT) },
    S: { "T=no": round(pS_given_T["T=no"]), "T=yes": round(pS_given_T["T=yes"]) },
    P: { "S=low": round(pP_given_S["S=low"]), "S=medium": round(pP_given_S["S=medium"]), "S=high": round(pP_given_S["S=high"]) },
  };
}

export function generateChainInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildChainCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "P", targetVal: "high", evidence: { T: "yes" }, scenario: theme.scenario, query: theme.obsTrained },
    { kind: "observational", targetVar: "P", targetVal: "high", evidence: { T: "no" }, scenario: theme.scenario, query: theme.obsUntrained },
    { kind: "interventional", targetVar: "P", targetVal: "high", interventionVar: "T", interventionVal: "yes", scenario: theme.scenario, query: theme.ivn },
  ];
  return {
    id: "chain",
    name: `${theme.varNames.T} \u2192 ${theme.varNames.S} \u2192 ${theme.varNames.P}`,
    description: `${theme.varNames.T} affects ${theme.varNames.P} through ${theme.varNames.S}.`,
    variables: [
      { id: "T", name: theme.varNames.T, values: ["no", "yes"], parents: [], role: "exposure" as const },
      { id: "S", name: theme.varNames.S, values: ["low", "medium", "high"], parents: ["T"], role: "mediator" as const },
      { id: "P", name: theme.varNames.P, values: ["low", "medium", "high"], parents: ["S"], role: "outcome" as const },
    ],
    edges: [{ from: "T", to: "S" }, { from: "S", to: "P" }],
    cpts,
    questionSpecs: specs,
  };
}
