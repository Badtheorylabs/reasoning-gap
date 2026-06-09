import type { CausalGraph, Question, QuestionKind } from "./types";
import { marginalProb, interventionalProb, counterfactualProb } from "../lib/inference";

type QuestionSpec = {
  kind: QuestionKind;
  targetVar: string;
  targetVal: string;
  evidence?: Record<string, string>;
  interventionVar?: string;
  interventionVal?: string;
  scenario: string;
  query: string;
};

const SCENARIOS: Record<string, QuestionSpec[]> = {
  chain: [
    {
      kind: "observational", targetVar: "P", targetVal: "high", evidence: { T: "yes" },
      scenario: "A company offers optional training to employees and tracks their performance.",
      query: "Among employees who COMPLETED the training, what percentage achieved HIGH performance?",
    },
    {
      kind: "observational", targetVar: "P", targetVal: "high", evidence: { T: "no" },
      scenario: "A company offers optional training to employees and tracks their performance.",
      query: "Among employees who did NOT take the training, what percentage achieved HIGH performance?",
    },
    {
      kind: "interventional", targetVar: "P", targetVal: "high", interventionVar: "T", interventionVal: "yes",
      scenario: "A company offers optional training to employees and tracks their performance.",
      query: "If the company FORCED every employee to complete the training, what percentage would achieve HIGH performance?",
    },
  ],
  fork: [
    {
      kind: "observational", targetVar: "I", targetVal: "high", evidence: { E: "advanced" },
      scenario: "Researchers track education levels and income across a population.",
      query: "Among people with ADVANCED education, what percentage have HIGH income?",
    },
    {
      kind: "observational", targetVar: "I", targetVal: "high", evidence: { E: "basic" },
      scenario: "Researchers track education levels and income across a population.",
      query: "Among people with BASIC education, what percentage have HIGH income?",
    },
    {
      kind: "interventional", targetVar: "I", targetVal: "high", interventionVar: "E", interventionVal: "advanced",
      scenario: "Researchers track education levels and income across a population.",
      query: "If the government PAID for everyone to get ADVANCED education, what percentage would have HIGH income?",
    },
    {
      kind: "counterfactual", targetVar: "I", targetVal: "medium", evidence: { E: "basic", I: "low" }, interventionVar: "E", interventionVal: "advanced",
      scenario: "A person has BASIC education and LOW income.",
      query: "If that person had instead received ADVANCED education, what would their income PROBABLY be?",
    },
  ],
  collider: [
    {
      kind: "observational", targetVar: "I", targetVal: "strong", evidence: { H: "yes" },
      scenario: "A company evaluates candidates on talent and interview performance before hiring.",
      query: "Among HIRED candidates, what proportion had a STRONG interview?",
    },
    {
      kind: "observational", targetVar: "T", targetVal: "high", evidence: { H: "yes" },
      scenario: "A company evaluates candidates on talent and interview performance before hiring.",
      query: "Among HIRED candidates, what proportion had HIGH talent?",
    },
    {
      kind: "interventional", targetVar: "I", targetVal: "strong", interventionVar: "T", interventionVal: "high", evidence: { H: "yes" },
      scenario: "A company evaluates candidates on talent and interview performance before hiring.",
      query: "If the company FORCED all hired candidates to have HIGH talent, what proportion would have had a STRONG interview?",
    },
  ],
  mbias: [
    {
      kind: "observational", targetVar: "Y", targetVal: "full", evidence: { X: "drug", M: "positive" },
      scenario: "A clinical trial tracks a new drug, a biomarker, and patient recovery.",
      query: "Among patients who TOOK the drug and had a POSITIVE biomarker, what percentage achieved FULL recovery?",
    },
    {
      kind: "interventional", targetVar: "Y", targetVal: "full", interventionVar: "X", interventionVal: "drug",
      scenario: "A clinical trial tracks a new drug, a biomarker, and patient recovery.",
      query: "If the trial GAVE the drug to ALL patients, what percentage would achieve FULL recovery?",
    },
    {
      kind: "interventional", targetVar: "Y", targetVal: "full", interventionVar: "X", interventionVal: "none",
      scenario: "A clinical trial tracks a new drug, a biomarker, and patient recovery.",
      query: "If the trial gave NO patients the drug, what percentage would achieve FULL recovery?",
    },
    {
      kind: "counterfactual", targetVar: "Y", targetVal: "no", evidence: { X: "drug", Y: "full" }, interventionVar: "X", interventionVal: "none",
      scenario: "A patient took the drug and made a FULL recovery.",
      query: "If that patient had NOT taken the drug, would they still have recovered?",
    },
  ],
};

function roundPercent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function generateChoices(answer: number): string[] {
  const correctPct = roundPercent(answer);
  const distractors: string[] = [];
  while (distractors.length < 3) {
    const r = `${Math.floor(Math.random() * 95 + 5)}%`;
    if (r !== correctPct && !distractors.includes(r)) distractors.push(r);
  }
  const choices = [correctPct, ...distractors];
  return choices.sort(() => Math.random() - 0.5);
}

function computeAnswer(graph: CausalGraph, spec: QuestionSpec): number {
  if (spec.kind === "observational") {
    return marginalProb(graph, spec.targetVar, spec.targetVal, spec.evidence);
  } else if (spec.kind === "interventional") {
    return interventionalProb(graph, spec.targetVar, spec.targetVal, spec.interventionVar!, spec.interventionVal!);
  }
  return counterfactualProb(graph, spec.targetVar, spec.targetVal, spec.interventionVar!, spec.interventionVal!, spec.evidence || {});
}

function buildQuestion(graph: CausalGraph, spec: QuestionSpec, qid: number): Question {
  const answer = computeAnswer(graph, spec);
  const choices = generateChoices(answer);
  const answerPct = roundPercent(answer);
  const answerIdx = choices.indexOf(answerPct);
  return {
    id: `q-${graph.id}-${qid}`,
    graph_id: graph.id,
    kind: spec.kind,
    scenario: spec.scenario,
    query: spec.query,
    choices,
    answer: answerIdx === -1 ? 0 : answerIdx,
    explanation: `${spec.kind}: P(${spec.targetVar}=${spec.targetVal}) = ${answerPct}`,
  };
}

export function generateQuestions(graphs: CausalGraph[]): Question[] {
  const questions: Question[] = [];
  let qid = 0;
  for (const graph of graphs) {
    if (graph.questionSpecs) {
      for (const spec of graph.questionSpecs) {
        questions.push(buildQuestion(graph, spec, qid++));
      }
    } else {
      const specs = SCENARIOS[graph.id] || [];
      for (const spec of specs) {
        questions.push(buildQuestion(graph, spec, qid++));
      }
    }
  }
  return questions;
}

export function generateBenchmark(instances: CausalGraph[]): Question[] {
  return generateQuestions(instances);
}
