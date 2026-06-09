import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

export const forkGraph: CausalGraph = {
  id: "fork",
  name: "Wealth \u2192 Education, Wealth \u2192 Income",
  description: "Wealthier families can afford better education and also have higher income networks. Does education causally raise income?",
  variables: [
    { id: "W", name: "Wealth", values: ["low", "high"], parents: [], role: "confounder" },
    { id: "E", name: "Education", values: ["basic", "advanced"], parents: ["W"], role: "exposure" },
    { id: "I", name: "Income", values: ["low", "medium", "high"], parents: ["W"], role: "outcome" },
  ],
  edges: [
    { from: "W", to: "E" },
    { from: "W", to: "I" },
  ],
  cpts: {
    W: { "": [0.5, 0.5] },
    E: {
      "W=low": [0.8, 0.2],
      "W=high": [0.2, 0.8],
    },
    I: {
      "W=low": [0.6, 0.3, 0.1],
      "W=high": [0.1, 0.3, 0.6],
    },
  },
};

type ForkTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsExposed: string;
  obsUnexposed: string;
  ivn: string;
  cfScenario: string;
  cfQuery: string;
};

const THEMES: ForkTheme[] = [
  {
    varNames: { C: "Wealth", E: "Education", I: "Income" },
    valNames: { C: { low: "Low", high: "High" }, E: { basic: "BASIC", advanced: "ADVANCED" }, I: { low: "LOW", medium: "MEDIUM", high: "HIGH" } },
    scenario: "Researchers track education levels and income across a population.",
    obsExposed: "Among people with ADVANCED education, what percentage have HIGH income?",
    obsUnexposed: "Among people with BASIC education, what percentage have HIGH income?",
    ivn: "If the government PAID for everyone to get ADVANCED education, what percentage would have HIGH income?",
    cfScenario: "A person has BASIC education and LOW income.",
    cfQuery: "If that person had instead received ADVANCED education, what would their income PROBABLY be?",
  },
  {
    varNames: { C: "Region", E: "Dialect", I: "Status" },
    valNames: { C: { low: "Rural", high: "Urban" }, E: { basic: "LOCAL", advanced: "STANDARD" }, I: { low: "LOW", medium: "MEDIUM", high: "HIGH" } },
    scenario: "Linguists study how regional background relates to dialect and social status.",
    obsExposed: "Among people who speak the STANDARD dialect, what percentage have HIGH social status?",
    obsUnexposed: "Among people who speak a LOCAL dialect, what percentage have HIGH social status?",
    ivn: "If language programs taught everyone the STANDARD dialect, what percentage would have HIGH social status?",
    cfScenario: "A person speaks a LOCAL dialect and has LOW status.",
    cfQuery: "If that person had been taught the STANDARD dialect, what would their status PROBABLY be?",
  },
  {
    varNames: { C: "Soil", E: "Fertilizer", I: "Yield" },
    valNames: { C: { low: "Poor", high: "Rich" }, E: { basic: "NONE", advanced: "APPLIED" }, I: { low: "LOW", medium: "MEDIUM", high: "HIGH" } },
    scenario: "Farmers apply fertilizer to some fields. Researchers track soil quality and crop yield.",
    obsExposed: "Among fields where fertilizer was APPLIED, what percentage achieved HIGH yield?",
    obsUnexposed: "Among fields with NO fertilizer, what percentage achieved HIGH yield?",
    ivn: "If the government MANDATED fertilizer on all fields, what percentage would achieve HIGH yield?",
    cfScenario: "A field had no fertilizer and produced LOW yield.",
    cfQuery: "If that field had received fertilizer, what would its yield PROBABLY be?",
  },
  {
    varNames: { C: "Parental Income", E: "University", I: "Career" },
    valNames: { C: { low: "Low", high: "High" }, E: { basic: "NO DEGREE", advanced: "DEGREE" }, I: { low: "UNSKILLED", medium: "SKILLED", high: "PROFESSIONAL" } },
    scenario: "Sociologists study how parental income shapes educational attainment and career outcomes.",
    obsExposed: "Among people with a university DEGREE, what percentage have a PROFESSIONAL career?",
    obsUnexposed: "Among people with NO DEGREE, what percentage have a PROFESSIONAL career?",
    ivn: "If the government PAID for everyone to earn a university degree, what percentage would have a PROFESSIONAL career?",
    cfScenario: "A person has no degree and an UNSKILLED job.",
    cfQuery: "If that person had earned a degree, what would their career PROBABLY be?",
  },
  {
    varNames: { C: "Location", E: "Language", I: "Salary" },
    valNames: { C: { low: "Remote", high: "Urban" }, E: { basic: "LOCAL", advanced: "GLOBAL" }, I: { low: "LOW", medium: "MEDIUM", high: "HIGH" } },
    scenario: "A study examines how location influences language skills and salary outcomes.",
    obsExposed: "Among people who speak a GLOBAL language, what percentage earn a HIGH salary?",
    obsUnexposed: "Among people who speak only a LOCAL language, what percentage earn a HIGH salary?",
    ivn: "If language programs taught everyone a GLOBAL language, what percentage would earn a HIGH salary?",
    cfScenario: "A person speaks only a LOCAL language and has a LOW salary.",
    cfQuery: "If that person had learned a GLOBAL language, what would their salary PROBABLY be?",
  },
];

function buildForkCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pC = randomProbs(rng, 2);
  const pE_given_C = { "C=low": randomProbs(rng, 2), "C=high": randomProbs(rng, 2) };
  const pI_given_C = { "C=low": randomProbs(rng, 3), "C=high": randomProbs(rng, 3) };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    C: { "": round(pC) },
    E: { "C=low": round(pE_given_C["C=low"]), "C=high": round(pE_given_C["C=high"]) },
    I: { "C=low": round(pI_given_C["C=low"]), "C=high": round(pI_given_C["C=high"]) },
  };
}

export function generateForkInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildForkCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "I", targetVal: "high", evidence: { E: "advanced" }, scenario: theme.scenario, query: theme.obsExposed },
    { kind: "observational", targetVar: "I", targetVal: "high", evidence: { E: "basic" }, scenario: theme.scenario, query: theme.obsUnexposed },
    { kind: "interventional", targetVar: "I", targetVal: "high", interventionVar: "E", interventionVal: "advanced", scenario: theme.scenario, query: theme.ivn },
    { kind: "counterfactual", targetVar: "I", targetVal: "medium", evidence: { E: "basic", I: "low" }, interventionVar: "E", interventionVal: "advanced", scenario: theme.cfScenario, query: theme.cfQuery },
  ];
  return {
    id: "fork",
    name: `${theme.varNames.C} \u2192 ${theme.varNames.E}, ${theme.varNames.C} \u2192 ${theme.varNames.I}`,
    description: `${theme.varNames.C} affects both ${theme.varNames.E} and ${theme.varNames.I}, creating confounding.`,
    variables: [
      { id: "C", name: theme.varNames.C, values: ["low", "high"], parents: [], role: "confounder" as const },
      { id: "E", name: theme.varNames.E, values: ["basic", "advanced"], parents: ["C"], role: "exposure" as const },
      { id: "I", name: theme.varNames.I, values: ["low", "medium", "high"], parents: ["C"], role: "outcome" as const },
    ],
    edges: [{ from: "C", to: "E" }, { from: "C", to: "I" }],
    cpts,
    questionSpecs: specs,
  };
}
