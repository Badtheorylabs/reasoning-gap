import type { EvalProvider, ProviderConfig } from "./provider";
import type { Question } from "../bench/types";

function parseChoice(raw: string): number | null {
  const m = raw.match(/[A-D]/i);
  if (!m) return null;
  return "ABCD".indexOf(m[0].toUpperCase());
}

const GROQ_FREE_MODELS = ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama-3.1-8b-instant"];

export class GroqProvider implements EvalProvider {
  readonly name: string;
  private model: string;
  private apiKey: string;

  constructor(cfg: ProviderConfig) {
    this.name = `groq-${cfg.model}`;
    this.model = cfg.model;
    this.apiKey = cfg.apiKey || process.env.GROQ_API_KEY || "gsk_demo";
  }

  async answer(question: Question): Promise<{ chosen: number; raw: string; latency: number }> {
    const prompt = this.buildPrompt(question);
    const start = Date.now();
    let text = "";

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You answer multiple choice questions. Only respond with the letter (A, B, C, or D). No explanation." },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json() as any;
      text = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    } catch (err) {
      text = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }

    const chosen = parseChoice(text) ?? 0;
    return { chosen, raw: text.slice(0, 200), latency: Date.now() - start };
  }

  private buildPrompt(q: Question): string {
    return [
      `Scenario: ${q.scenario}`,
      `Question: ${q.query}`,
      q.choices.map((c, i) => `${"ABCD"[i]}. ${c}`).join("\n"),
      `\nAnswer (just the letter):`,
    ].join("\n");
  }

  static listFreeModels(): string[] {
    return GROQ_FREE_MODELS;
  }
}
