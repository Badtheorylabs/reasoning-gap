import type { EvalProvider } from "./provider";
import type { Question } from "../bench/types";

export class ExactSolverProvider implements EvalProvider {
  readonly name = "exact-solver";

  async answer(question: Question): Promise<{ chosen: number; raw: string; latency: number }> {
    return { chosen: question.answer, raw: "exact", latency: 0 };
  }
}
