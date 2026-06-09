/* ─── benchmark types ─── */

export type CausalRole = "confounder" | "mediator" | "collider" | "instrument" | "outcome" | "exposure" | "auxiliary";

export type Variable = {
  id: string;
  name: string;
  values: string[];
  parents: string[];
  role: CausalRole;
};

export type Edge = {
  from: string;
  to: string;
};

export type QuestionKind = "observational" | "interventional" | "counterfactual";

export type QuestionSpec = {
  kind: QuestionKind;
  targetVar: string;
  targetVal: string;
  evidence?: Record<string, string>;
  interventionVar?: string;
  interventionVal?: string;
  scenario: string;
  query: string;
};

export type CausalGraph = {
  id: string;
  name: string;
  description: string;
  variables: Variable[];
  edges: Edge[];
  cpts: Record<string, Record<string, number[]>>;
  questionSpecs?: QuestionSpec[];
};

export type Question = {
  id: string;
  graph_id: string;
  kind: QuestionKind;
  scenario: string;
  query: string;
  choices: string[];
  answer: number;
  explanation: string;
};

export type Benchmark = {
  graphs: CausalGraph[];
  questions: Question[];
};
