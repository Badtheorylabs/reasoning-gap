import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

type FrontdoorTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsTreated: string;
  obsControl: string;
  ivnTreated: string;
};

const THEMES: FrontdoorTheme[] = [
  {
    varNames: { X: "Exercise", M: "Fitness", Y: "Health", U: "Consciousness" },
    valNames: { X: { no: "SEDENTARY", yes: "ACTIVE" }, M: { low: "POOR", high: "GOOD" }, Y: { low: "WEAK", high: "STRONG" }, U: { low: "Low", high: "High" } },
    scenario: "Researchers track exercise habits, fitness levels, and health outcomes.",
    obsTreated: "Among people who are ACTIVE, what percentage have STRONG health?",
    obsControl: "Among SEDENTARY people, what percentage have STRONG health?",
    ivnTreated: "If the government MANDATED exercise for everyone, what percentage would have STRONG health?",
  },
  {
    varNames: { X: "Training", M: "Skill", Y: "Salary", U: "Aptitude" },
    valNames: { X: { no: "UNTRAINED", yes: "TRAINED" }, M: { low: "LOW", high: "HIGH" }, Y: { low: "LOW", high: "HIGH" }, U: { low: "Low", high: "High" } },
    scenario: "A company tracks employee training programs, skill assessments, and salary growth.",
    obsTreated: "Among TRAINED employees, what percentage earn a HIGH salary?",
    obsControl: "Among UNTRAINED employees, what percentage earn a HIGH salary?",
    ivnTreated: "If the company TRAINED every employee, what percentage would earn a HIGH salary?",
  },
  {
    varNames: { X: "Ad", M: "Awareness", Y: "Purchase", U: "Income" },
    valNames: { X: { no: "HIDDEN", yes: "SHOWN" }, M: { low: "UNAWARE", high: "AWARE" }, Y: { low: "NONE", high: "MANY" }, U: { low: "Low", high: "High" } },
    scenario: "A marketing team shows ads and tracks brand awareness and purchases.",
    obsTreated: "Among users who SAW the ad, what percentage made MANY purchases?",
    obsControl: "Among users who did NOT see the ad, what percentage made MANY purchases?",
    ivnTreated: "If the platform SHOWED the ad to every user, what percentage would make MANY purchases?",
  },
];

function buildCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pU = randomProbs(rng, 2);
  const pX_given = { "U=low": randomProbs(rng, 2), "U=high": randomProbs(rng, 2) };
  const pM_given = { "X=no": randomProbs(rng, 2), "X=yes": randomProbs(rng, 2) };
  const pY_given = {
    "M=low,U=low": randomProbs(rng, 2), "M=low,U=high": randomProbs(rng, 2),
    "M=high,U=low": randomProbs(rng, 2), "M=high,U=high": randomProbs(rng, 2),
  };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    U: { "": round(pU) },
    X: { "U=low": round(pX_given["U=low"]), "U=high": round(pX_given["U=high"]) },
    M: { "X=no": round(pM_given["X=no"]), "X=yes": round(pM_given["X=yes"]) },
    Y: {
      "M=low,U=low": round(pY_given["M=low,U=low"]), "M=low,U=high": round(pY_given["M=low,U=high"]),
      "M=high,U=low": round(pY_given["M=high,U=low"]), "M=high,U=high": round(pY_given["M=high,U=high"]),
    },
  };
}

export function generateFrontdoorInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "yes" }, scenario: theme.scenario, query: theme.obsTreated },
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "no" }, scenario: theme.scenario, query: theme.obsControl },
    { kind: "interventional", targetVar: "Y", targetVal: "high", interventionVar: "X", interventionVal: "yes", scenario: theme.scenario, query: theme.ivnTreated },
  ];
  return {
    id: "frontdoor",
    name: `${theme.varNames.X} \u2192 ${theme.varNames.M} \u2192 ${theme.varNames.Y}`,
    description: `${theme.varNames.U} confounds ${theme.varNames.X} and ${theme.varNames.Y}. ${theme.varNames.M} mediates the effect of ${theme.varNames.X} on ${theme.varNames.Y}.`,
    variables: [
      { id: "X", name: theme.varNames.X, values: ["no", "yes"], parents: ["U"], role: "exposure" as const },
      { id: "M", name: theme.varNames.M, values: ["low", "high"], parents: ["X"], role: "mediator" as const },
      { id: "Y", name: theme.varNames.Y, values: ["low", "high"], parents: ["M", "U"], role: "outcome" as const },
      { id: "U", name: theme.varNames.U, values: ["low", "high"], parents: [], role: "confounder" as const },
    ],
    edges: [{ from: "U", to: "X" }, { from: "U", to: "Y" }, { from: "X", to: "M" }, { from: "M", to: "Y" }],
    cpts,
    questionSpecs: specs,
  };
}

export const frontdoorGraph: CausalGraph = generateFrontdoorInstance(0);
