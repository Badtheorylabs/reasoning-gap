# Reasoning Gap

A controlled benchmark for interventional causal reasoning in large language models.

**Findings:** GPT-5.4 (25.0%), GPT-4o mini (25.7%), and Gemini 2.0 Flash (29.2%) all score at random chance when asked to distinguish observational from interventional queries — even with complete causal graphs and probability tables provided. Exact inference achieves 100%, human experts 97.8% (CounterBench).

## Structure

```
src/bench/       — Graph templates, parametric generator, question types
src/eval/        — Eval providers (OpenAI, Gemini, Groq, ExactSolver), runner
src/lib/         — Inference engine (marginal, interventional, counterfactual probs), PRNG
results/         — Raw evaluation results
paper/           — LaTeX source for arXiv paper
```

## Run eval

```bash
npm install
npx tsx src/eval/runner.ts
```

## Live test

https://www.badtheorylabs.com/reasoning-test

## Citation

```bibtex
@misc{alameen2025reasoninggap,
  title={The Reasoning Gap: Large Language Models Cannot Distinguish Observation from Intervention},
  author={Olajide Al-ameen},
  year={2025},
  url={https://github.com/Badtheorylabs/reasoning-gap}
}
```
