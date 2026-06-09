import type { Question } from "../bench/types";
import type { EvalProvider, EvalResult } from "./provider";

export type EvalSummary = {
  model: string;
  total: number;
  correct: number;
  accuracy: number;
  by_kind: Record<string, { total: number; correct: number }>;
  by_graph: Record<string, { total: number; correct: number }>;
};

export async function runEval(
  provider: EvalProvider,
  questions: Question[],
  batchSize = 1
): Promise<{ results: EvalResult[]; summary: EvalSummary }> {
  const results: EvalResult[] = [];

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((q) =>
        provider.answer(q).then(({ chosen, raw, latency }) => ({
          question_id: q.id,
          model: provider.name,
          chosen,
          correct: chosen === q.answer,
          raw_output: raw,
          latency_ms: latency,
        }))
      )
    );
    results.push(...batchResults);
  }

  const summary = computeSummary(provider.name, results, questions);
  return { results, summary };
}

function computeSummary(model: string, results: EvalResult[], questions: Question[]): EvalSummary {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;

  const by_kind: Record<string, { total: number; correct: number }> = {};
  const by_graph: Record<string, { total: number; correct: number }> = {};

  for (const r of results) {
    const q = questions.find((x) => x.id === r.question_id);
    if (!q) continue;

    if (!by_kind[q.kind]) by_kind[q.kind] = { total: 0, correct: 0 };
    by_kind[q.kind].total++;
    if (r.correct) by_kind[q.kind].correct++;

    if (!by_graph[q.graph_id]) by_graph[q.graph_id] = { total: 0, correct: 0 };
    by_graph[q.graph_id].total++;
    if (r.correct) by_graph[q.graph_id].correct++;
  }

  return { model, total, correct, accuracy: total > 0 ? correct / total : 0, by_kind, by_graph };
}

export function formatSummary(summary: EvalSummary): string {
  const lines: string[] = [];
  lines.push(`\nModel: ${summary.model}`);
  lines.push(`Accuracy: ${summary.correct}/${summary.total} = ${(summary.accuracy * 100).toFixed(1)}%`);
  lines.push(``);
  lines.push(`By question kind:`);
  for (const [kind, stats] of Object.entries(summary.by_kind)) {
    const pct = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : "-";
    lines.push(`  ${kind}: ${stats.correct}/${stats.total} (${pct}%)`);
  }
  lines.push(``);
  lines.push(`By graph:`);
  for (const [graph, stats] of Object.entries(summary.by_graph)) {
    const pct = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : "-";
    lines.push(`  ${graph}: ${stats.correct}/${stats.total} (${pct}%)`);
  }
  return lines.join("\n");
}
