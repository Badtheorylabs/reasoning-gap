import type { CausalGraph, QuestionSpec } from "../types";
import { createRNG, pick, randomProbs } from "../../lib/random";

export const colliderGraph: CausalGraph = {
  id: "collider",
  name: "Talent \u2192 Hiring \u2190 Interview",
  description: "A company hires candidates. Hiring decisions depend on both talent and interview performance. Talent and interview are independent in the population, but among hired candidates they become correlated.",
  variables: [
    { id: "T", name: "Talent", values: ["low", "high"], parents: [], role: "exposure" },
    { id: "I", name: "Interview", values: ["weak", "strong"], parents: [], role: "auxiliary" },
    { id: "H", name: "Hired", values: ["no", "yes"], parents: ["T", "I"], role: "collider" },
  ],
  edges: [
    { from: "T", to: "H" },
    { from: "I", to: "H" },
  ],
  cpts: {
    T: { "": [0.6, 0.4] },
    I: { "": [0.5, 0.5] },
    H: {
      "T=low,I=weak": [0.95, 0.05],
      "T=low,I=strong": [0.6, 0.4],
      "T=high,I=weak": [0.4, 0.6],
      "T=high,I=strong": [0.1, 0.9],
    },
  },
};

type ColliderTheme = {
  varNames: Record<string, string>;
  valNames: Record<string, Record<string, string>>;
  scenario: string;
  obsInterview: string;
  obsTalent: string;
  ivn: string;
};

const THEMES: ColliderTheme[] = [
  {
    varNames: { X: "Talent", Y: "Hired", Z: "Interview" },
    valNames: { X: { low: "LOW", high: "HIGH" }, Y: { no: "Rejected", yes: "Hired" }, Z: { weak: "WEAK", strong: "STRONG" } },
    scenario: "A company evaluates candidates on talent and interview performance before hiring.",
    obsInterview: "Among HIRED candidates, what proportion had a STRONG interview?",
    obsTalent: "Among HIRED candidates, what proportion had HIGH talent?",
    ivn: "If the company FORCED all hired candidates to have HIGH talent, what proportion would have had a STRONG interview?",
  },
  {
    varNames: { X: "Gene", Y: "Disease", Z: "Environment" },
    valNames: { X: { low: "ABSENT", high: "PRESENT" }, Y: { no: "Healthy", yes: "Sick" }, Z: { weak: "CLEAN", strong: "POLLUTED" } },
    scenario: "A medical study tracks genetic risk factors, environmental exposure, and disease onset.",
    obsInterview: "Among SICK patients, what proportion lived in a POLLUTED environment?",
    obsTalent: "Among SICK patients, what proportion had the PRESENT genetic risk factor?",
    ivn: "If the study focused only on patients WITH the genetic risk factor, what proportion would come from a POLLUTED environment?",
  },
  {
    varNames: { X: "Preparation", Y: "Success", Z: "Difficulty" },
    valNames: { X: { low: "MINIMAL", high: "THOROUGH" }, Y: { no: "Failed", yes: "Passed" }, Z: { weak: "EASY", strong: "HARD" } },
    scenario: "Researchers study exam preparation, exam difficulty, and pass rates.",
    obsInterview: "Among students who PASSED, what proportion took a HARD exam?",
    obsTalent: "Among students who PASSED, what proportion did THOROUGH preparation?",
    ivn: "If we looked only at students who did THOROUGH preparation, what proportion took a HARD exam?",
  },
  {
    varNames: { X: "Speed", Y: "Accident", Z: "Weather" },
    valNames: { X: { low: "CAUTIOUS", high: "FAST" }, Y: { no: "Safe", yes: "Crashed" }, Z: { weak: "CLEAR", strong: "STORMY" } },
    scenario: "Traffic analysts study driving speed, weather conditions, and accident rates.",
    obsInterview: "Among drivers who CRASHED, what proportion were driving in STORMY weather?",
    obsTalent: "Among drivers who CRASHED, what proportion were driving FAST?",
    ivn: "If we examined only FAST drivers, what proportion were driving in STORMY weather?",
  },
  {
    varNames: { X: "Quality", Y: "Review", Z: "Marketing" },
    valNames: { X: { low: "POOR", high: "EXCELLENT" }, Y: { no: "Unreviewed", yes: "Featured" }, Z: { weak: "NONE", strong: "AGGRESSIVE" } },
    scenario: "A media platform tracks content quality, marketing spend, and editorial features.",
    obsInterview: "Among FEATURED articles, what proportion had AGGRESSIVE marketing?",
    obsTalent: "Among FEATURED articles, what proportion had EXCELLENT quality?",
    ivn: "If the platform featured only EXCELLENT quality articles, what proportion would have AGGRESSIVE marketing?",
  },
];

function buildColliderCPTs(rng: () => number): Record<string, Record<string, number[]>> {
  const pX = randomProbs(rng, 2);
  const pZ = randomProbs(rng, 2);
  const pH_given = {
    "X=low,Z=weak": randomProbs(rng, 2),
    "X=low,Z=strong": randomProbs(rng, 2),
    "X=high,Z=weak": randomProbs(rng, 2),
    "X=high,Z=strong": randomProbs(rng, 2),
  };
  const round = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  return {
    X: { "": round(pX) },
    Z: { "": round(pZ) },
    Y: {
      "X=low,Z=weak": round(pH_given["X=low,Z=weak"]),
      "X=low,Z=strong": round(pH_given["X=low,Z=strong"]),
      "X=high,Z=weak": round(pH_given["X=high,Z=weak"]),
      "X=high,Z=strong": round(pH_given["X=high,Z=strong"]),
    },
  };
}

export function generateColliderInstance(seed: number): CausalGraph {
  const rng = createRNG(seed);
  const theme = pick(rng, THEMES);
  const cpts = buildColliderCPTs(rng);
  const specs: QuestionSpec[] = [
    { kind: "observational", targetVar: "Z", targetVal: "strong", evidence: { Y: "yes" }, scenario: theme.scenario, query: theme.obsInterview },
    { kind: "observational", targetVar: "X", targetVal: "high", evidence: { Y: "yes" }, scenario: theme.scenario, query: theme.obsTalent },
    { kind: "interventional", targetVar: "Z", targetVal: "strong", interventionVar: "X", interventionVal: "high", evidence: { Y: "yes" }, scenario: theme.scenario, query: theme.ivn },
  ];
  return {
    id: "collider",
    name: `${theme.varNames.X} \u2192 ${theme.varNames.Y} \u2190 ${theme.varNames.Z}`,
    description: `${theme.varNames.X} and ${theme.varNames.Z} both affect ${theme.varNames.Y}. Conditioning on ${theme.varNames.Y} induces spurious correlation.`,
    variables: [
      { id: "X", name: theme.varNames.X, values: ["low", "high"], parents: [], role: "exposure" as const },
      { id: "Z", name: theme.varNames.Z, values: ["weak", "strong"], parents: [], role: "auxiliary" as const },
      { id: "Y", name: theme.varNames.Y, values: ["no", "yes"], parents: ["X", "Z"], role: "collider" as const },
    ],
    edges: [{ from: "X", to: "Y" }, { from: "Z", to: "Y" }],
    cpts,
    questionSpecs: specs,
  };
}
