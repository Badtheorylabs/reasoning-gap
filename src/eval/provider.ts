import type { Question } from "../bench/types";

export type EvalResult = {
  question_id: string;
  model: string;
  chosen: number;
  correct: boolean;
  raw_output: string;
  latency_ms: number;
};

export type ProviderConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

export interface EvalProvider {
  readonly name: string;
  answer(question: Question): Promise<{ chosen: number; raw: string; latency: number }>;
}
