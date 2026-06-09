import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

type InstrumentTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsTreated: string;
  obsControl: string;
  ivnTreated: string;
  ivnControl: string;
};

const THEMES: InstrumentTheme[] = [
  {
    varNames: { Z: "Lottery", X: "College", Y: "Income", U: "Ability" },
    valNames: { Z: { "0": "NOT OFFERED", "1": "OFFERED" }, X: { no: "NO COLLEGE", yes: "COLLEGE" }, Y: { low: "LOW", high: "HIGH" }, U: { low: "Low", high: "High" } },
    scenario: "A lottery randomly awards scholarships. Researchers track college attendance and later income.",
    obsTreated: "Among people who ATTENDED college, what percentage earn HIGH income?",
    obsControl: "Among people who did NOT attend college, what percentage earn HIGH income?",
    ivnTreated: "If the government FORCED everyone to attend college, what percentage would earn HIGH income?",
    ivnControl: "If the government BANNED college attendance for everyone, what percentage would earn HIGH income?",
  },
  {
    varNames: { Z: "Assignment", X: "Drug", Y: "Recovery", U: "Genetics" },
    valNames: { Z: { "0": "PLACEBO", "1": "TREATED" }, X: { no: "NO DRUG", yes: "DRUG" }, Y: { low: "POOR", high: "FULL" }, U: { low: "Low", high: "High" } },
    scenario: "A randomized trial assigns patients to drug or placebo and tracks recovery.",
    obsTreated: "Among patients who TOOK the drug, what percentage achieved FULL recovery?",
    obsControl: "Among patients who did NOT take the drug, what percentage achieved FULL recovery?",
    ivnTreated: "If the trial FORCED all patients to take the drug, what percentage would achieve FULL recovery?",
    ivnControl: "If the trial GAVE no patients the drug, what percentage would achieve FULL recovery?",
  },
  {
    varNames: { Z: "Grant", X: "R&D", Y: "Profit", U: "Talent" },
    valNames: { Z: { "0": "DENIED", "1": "AWARDED" }, X: { no: "NO R&D", yes: "R&D" }, Y: { low: "LOSS", high: "PROFIT" }, U: { low: "Low", high: "High" } },
    scenario: "A government agency randomly awards R&D grants to companies. Researchers track R&D spending and profits.",
    obsTreated: "Among companies that did R&D, what percentage earned PROFIT?",
    obsControl: "Among companies that did NO R&D, what percentage earned PROFIT?",
    ivnTreated: "If the government MANDATED R&D for all companies, what percentage would earn PROFIT?",
    ivnControl: "If the government BANNED R&D, what percentage would earn PROFIT?",
  },
];

function buildCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pZ = randomProbs(rng, 2);
  const pU = randomProbs(rng, 2);
  const pX_given = {
    "Z=0,U=low": randomProbs(rng, 2), "Z=0,U=high": randomProbs(rng, 2),
    "Z=1,U=low": randomProbs(rng, 2), "Z=1,U=high": randomProbs(rng, 2),
  };
  const pY_given = {
    "X=no,U=low": randomProbs(rng, 2), "X=no,U=high": randomProbs(rng, 2),
    "X=yes,U=low": randomProbs(rng, 2), "X=yes,U=high": randomProbs(rng, 2),
  };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    Z: { "": round(pZ) },
    U: { "": round(pU) },
    X: {
      "Z=0,U=low": round(pX_given["Z=0,U=low"]), "Z=0,U=high": round(pX_given["Z=0,U=high"]),
      "Z=1,U=low": round(pX_given["Z=1,U=low"]), "Z=1,U=high": round(pX_given["Z=1,U=high"]),
    },
    Y: {
      "X=no,U=low": round(pY_given["X=no,U=low"]), "X=no,U=high": round(pY_given["X=no,U=high"]),
      "X=yes,U=low": round(pY_given["X=yes,U=low"]), "X=yes,U=high": round(pY_given["X=yes,U=high"]),
    },
  };
}

export function generateInstrumentInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "yes" }, scenario: theme.scenario, query: theme.obsTreated },
    { kind: "observational", targetVar: "Y", targetVal: "high", evidence: { X: "no" }, scenario: theme.scenario, query: theme.obsControl },
    { kind: "interventional", targetVar: "Y", targetVal: "high", interventionVar: "X", interventionVal: "yes", scenario: theme.scenario, query: theme.ivnTreated },
    { kind: "interventional", targetVar: "Y", targetVal: "high", interventionVar: "X", interventionVal: "no", scenario: theme.scenario, query: theme.ivnControl },
  ];
  return {
    id: "instrument",
    name: `${theme.varNames.Z} \u2192 ${theme.varNames.X} \u2192 ${theme.varNames.Y}`,
    description: `${theme.varNames.Z} is a random instrument affecting ${theme.varNames.X}. ${theme.varNames.U} confounds ${theme.varNames.X} and ${theme.varNames.Y}.`,
    variables: [
      { id: "Z", name: theme.varNames.Z, values: ["0", "1"], parents: [], role: "instrument" as const },
      { id: "X", name: theme.varNames.X, values: ["no", "yes"], parents: ["Z", "U"], role: "exposure" as const },
      { id: "Y", name: theme.varNames.Y, values: ["low", "high"], parents: ["X", "U"], role: "outcome" as const },
      { id: "U", name: theme.varNames.U, values: ["low", "high"], parents: [], role: "confounder" as const },
    ],
    edges: [{ from: "Z", to: "X" }, { from: "U", to: "X" }, { from: "U", to: "Y" }, { from: "X", to: "Y" }],
    cpts,
    questionSpecs: specs,
  };
}

export const instrumentGraph: CausalGraph = generateInstrumentInstance(0);
