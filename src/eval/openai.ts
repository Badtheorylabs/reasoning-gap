import type { EvalProvider, ProviderConfig } from "./provider";
import type { Question } from "../bench/types";

function parseChoice(raw: string): number | null {
  if (raw.startsWith("{") || raw.startsWith("ERROR:")) return null;
  const m = raw.match(/\b[A-D]\b/);
  if (!m) return null;
  return "ABCD".indexOf(m[0].toUpperCase());
}

export class OpenAIProvider implements EvalProvider {
  readonly name: string;
  private apiKey: string;
  private model: string;

  constructor(cfg: ProviderConfig) {
    this.name = `openai-${cfg.model}`;
    this.model = cfg.model;
    this.apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || "";
  }

  async answer(question: Question): Promise<{ chosen: number; raw: string; latency: number }> {
    const prompt = this.buildPrompt(question);
    const start = Date.now();

    const body = {
      model: this.model,
      messages: [
        { role: "system", content: "You answer multiple choice reasoning questions. Only reply with a single letter (A, B, C, or D). No explanation." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 10,
    };

    let text = "";
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json() as any;
      text = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    } catch (err) {
      text = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }

    const parsed = parseChoice(text);
    const chosen = parsed !== null ? parsed : Math.floor(Math.random() * 4);
    return { chosen, raw: text.slice(0, 200), latency: Date.now() - start };
  }

  private buildPrompt(q: Question): string {
    return [
      `Scenario: ${q.scenario}`,
      `Question: ${q.query}`,
      q.choices.map((c, i) => `${"ABCD"[i]}. ${c}`).join("\n"),
      `Answer (just the letter):`,
    ].join("\n");
  }
}
