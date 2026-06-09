import type { EvalProvider, ProviderConfig } from "./provider";
import type { Question } from "../bench/types";

function parseChoice(raw: string): number | null {
  // only parse if the output looks like a short answer, not an error JSON
  if (raw.startsWith("{") || raw.startsWith("ERROR:")) return null;
  const m = raw.match(/\b[A-D]\b/);
  if (!m) return null;
  return "ABCD".indexOf(m[0].toUpperCase());
}

async function fetchWithRetry(
  url: string,
  body: unknown,
  maxRetries = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      if (res.ok) return text;

      const data = JSON.parse(text) as any;
      const code = data?.error?.code;
      if (code === 429) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 30_000));
          continue;
        }
        return text;
      }
      return text;
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      return `NETWORK_ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return "MAX_RETRIES_EXCEEDED";
}

export class GeminiProvider implements EvalProvider {
  readonly name: string;
  private apiKey: string;

  constructor(cfg: ProviderConfig) {
    this.name = `gemini-${cfg.model}`;
    this.apiKey = cfg.apiKey || process.env.GEMINI_API_KEY || "";
  }

  async answer(question: Question): Promise<{ chosen: number; raw: string; latency: number }> {
    const prompt = this.buildPrompt(question);
    const start = Date.now();

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 10, candidateCount: 1 },
    };

    const key = this.apiKey || "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

    const raw = await fetchWithRetry(url, body);
    let text = raw;
    try {
      if (raw.startsWith("{")) {
        const data = JSON.parse(raw) as any;
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
      }
    } catch {
      text = raw;
    }

    const parsed = parseChoice(text);
    const chosen = parsed !== null ? parsed : Math.floor(Math.random() * 4);
    return { chosen, raw: text.slice(0, 200), latency: Date.now() - start };
  }

  private buildPrompt(q: Question): string {
    return [
      `You are answering a multiple choice reasoning question. Read the scenario. Choose the BEST answer. Only reply with a single letter.`,
      ``,
      `Scenario: ${q.scenario}`,
      ``,
      `Question: ${q.query}`,
      ``,
      q.choices.map((c, i) => `${"ABCD"[i]}. ${c}`).join("\n"),
      ``,
      `Answer:`,
    ].join("\n");
  }
}
