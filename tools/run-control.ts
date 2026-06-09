/* Arithmetic control — tests whether models can compute marginal probabilities from tables */
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

type ControlQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number; // index into choices
  correctVal: number;
};

const LETTERS = ["A", "B", "C", "D"];

function genChoices(correct: number, pool: number[]): [string[], number] {
  const distractors = pool.filter(x => x !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
  const all = [correct, ...distractors].sort(() => Math.random() - 0.5);
  const idx = all.indexOf(correct);
  return [all.map(v => v + "%"), idx];
}

const POOL = [5, 12, 15, 20, 25, 30, 32, 35, 37, 40, 42, 44, 45, 48, 49, 50, 52, 54, 55, 56, 57, 58, 60, 61, 62, 63, 65, 67, 68, 69, 70, 71, 73, 75, 80, 81, 82, 84, 85, 86, 88, 90, 92, 95];

function genMarginal(): ControlQuestion {
  // P(A) = p; P(B|A) = q1; P(B|not A) = q2
  // P(B) = p*q1 + (1-p)*q2
  const p = (Math.floor(Math.random() * 9) + 1) / 10; // 0.1-0.9
  const q1 = (Math.floor(Math.random() * 9) + 1) / 10;
  const q2 = (Math.floor(Math.random() * 9) + 1) / 10;
  const correct = Math.round((p * q1 + (1 - p) * q2) * 100);
  const clamped = Math.max(1, Math.min(99, correct));
  const [choices, answer] = genChoices(clamped, POOL);
  const pct = (p * 100).toFixed(0);
  const nPct = ((1 - p) * 100).toFixed(0);
  const q1Pct = (q1 * 100).toFixed(0);
  const q2Pct = (q2 * 100).toFixed(0);
  return {
    id: `ctrl-marg-${Math.random().toString(36).slice(2, 6)}`,
    prompt: `Given:
P(event A) = ${pct}%
P(outcome | A) = ${q1Pct}%
P(outcome | not A) = ${q2Pct}%

What is P(outcome)? (Just the percentage, no explanation.)`,
    choices,
    answer,
    correctVal: clamped,
  };
}

function genTwoStage(): ControlQuestion {
  // P(A) = p; P(B|A) = q1; P(B|not A) = q2; P(C|B) = r1; P(C|not B) = r2
  // P(B) = p*q1 + (1-p)*q2
  // P(C) = P(B)*r1 + (1-P(B))*r2
  const p = (Math.floor(Math.random() * 9) + 1) / 10;
  const q1 = (Math.floor(Math.random() * 9) + 1) / 10;
  const q2 = (Math.floor(Math.random() * 9) + 1) / 10;
  const r1 = (Math.floor(Math.random() * 9) + 1) / 10;
  const r2 = (Math.floor(Math.random() * 9) + 1) / 10;
  const pB = p * q1 + (1 - p) * q2;
  const correct = Math.round((pB * r1 + (1 - pB) * r2) * 100);
  const clamped = Math.max(1, Math.min(99, correct));
  const [choices, answer] = genChoices(clamped, POOL);
  return {
    id: `ctrl-2s-${Math.random().toString(36).slice(2, 6)}`,
    prompt: `Given:
P(A) = ${(p * 100).toFixed(0)}%
P(B | A) = ${(q1 * 100).toFixed(0)}%
P(B | not A) = ${(q2 * 100).toFixed(0)}%
P(C | B) = ${(r1 * 100).toFixed(0)}%
P(C | not B) = ${(r2 * 100).toFixed(0)}%

What is P(C)? (Just the percentage, no explanation.)`,
    choices,
    answer,
    correctVal: clamped,
  };
}

function genAll(count = 50): ControlQuestion[] {
  const qs: ControlQuestion[] = [];
  for (let i = 0; i < count; i++) {
    qs.push(i % 2 === 0 ? genMarginal() : genTwoStage());
  }
  return qs;
}

async function run() {
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_2;
  if (!key) { console.error("OPENAI_API_KEY not set"); process.exit(1); }
  const client = new OpenAI({ apiKey: key });

  const questions = genAll(50);

  for (const modelName of ["gpt-4o-mini", "gpt-5.4"]) {
    console.log(`\n=== ${modelName} ===`);
    let correct = 0;
    const results: any[] = [];

    for (const q of questions) {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: "You are answering a multiple-choice question. Output ONLY the letter (A, B, C, or D) of the correct answer. Do not explain." },
          { role: "user", content: `${q.prompt}\n\n${q.choices.map((c, i) => `${LETTERS[i]}. ${c}`).join("\n")}\n\nAnswer:` },
        ],
        temperature: 0,
        max_tokens: 10,
      });
      const raw = (resp.choices?.[0]?.message?.content || "").trim().toUpperCase();
      const letterIdx = LETTERS.indexOf(raw[0] || "");
      const isCorrect = letterIdx === q.answer;
      if (isCorrect) correct++;
      results.push({ id: q.id, raw, expected: q.answer, correct: isCorrect, correctVal: q.correctVal });

      if (results.length % 10 === 0) console.log(`  ${results.length}/${questions.length} — ${correct}/${results.length} (${(correct / results.length * 100).toFixed(1)}%)`);
    }

    const pct = (correct / questions.length * 100).toFixed(1);
    console.log(`\n${modelName}: ${correct}/${questions.length} = ${pct}%`);

    fs.writeFileSync(path.join(__dirname, "../../results/control-" + modelName + ".json"), JSON.stringify({ model: modelName, total: questions.length, correct, accuracy: correct / questions.length, results }, null, 2));
  }
}

run().catch(console.error);
