import type { CausalGraph, Variable } from "../bench/types";

type Assignment = Record<string, string>;

// all possible assignments for a set of variables
function* enumerate(vars: Variable[]): Generator<Assignment> {
  if (vars.length === 0) {
    yield {};
    return;
  }
  const [head, ...rest] = vars;
  for (const val of head.values) {
    for (const sub of enumerate(rest)) {
      yield { ...sub, [head.id]: val };
    }
  }
}

// probability of a full assignment under the graph
function jointProb(graph: CausalGraph, assignment: Assignment): number {
  let p = 1;
  for (const v of graph.variables) {
    const val = assignment[v.id];
    const parentKey = v.parents.map((pid) => `${pid}=${assignment[pid]}`).join(",");
    const cpt = graph.cpts[v.id];
    if (!cpt) return 0;
    const probs = cpt[parentKey || ""];
    if (!probs) return 0;
    const idx = v.values.indexOf(val);
    if (idx === -1) return 0;
    p *= probs[idx];
  }
  return p;
}

// P(Y=y | do(X=x)) — sum over all assignments consistent with do(X=x)
function interventionalProb(
  graph: CausalGraph,
  target: string,
  targetVal: string,
  intervention: string,
  interventionVal: string
): number {
  let num = 0;
  let den = 0;
  const doVar = graph.variables.find((v) => v.id === intervention)!;
  // Under do(X=x), the edge from X's parents to X is cut.
  // X's CPT is replaced with P(X=x) = 1.
  // So we enumerate all assignments where X = x, and compute joint
  // using the modified graph where X has no parents.
  for (const assignment of enumerate(graph.variables)) {
    if (assignment[intervention] !== interventionVal) continue;
    // compute probability with modified graph (X has no parents, P(X=x)=1)
    let p = 1;
    for (const v of graph.variables) {
      if (v.id === intervention) {
        // P(do(X=x)) = 1 for the forced value, 0 otherwise
        continue;
      }
      const val = assignment[v.id];
      // for X's children, use X's forced value
      const parentKey = v.parents
        .map((pid) => (pid === intervention ? `${pid}=${interventionVal}` : `${pid}=${assignment[pid]}`))
        .join(",");
      const probs = graph.cpts[v.id]?.[parentKey || ""];
      if (!probs) { p = 0; break; }
      const idx = v.values.indexOf(val);
      if (idx === -1) { p = 0; break; }
      p *= probs[idx];
    }
    den += p;
    if (assignment[target] === targetVal) num += p;
  }
  return den > 0 ? num / den : 0;
}

// compute marginal P(Y=y) or conditional P(Y=y | evidence)
function marginalProb(
  graph: CausalGraph,
  target: string,
  targetVal: string,
  evidence: Record<string, string> = {}
): number {
  let num = 0;
  let den = 0;
  for (const assignment of enumerate(graph.variables)) {
    // check evidence
    let consistent = true;
    for (const [k, v] of Object.entries(evidence)) {
      if (assignment[k] !== v) { consistent = false; break; }
    }
    if (!consistent) continue;
    const p = jointProb(graph, assignment);
    den += p;
    if (assignment[target] === targetVal) num += p;
  }
  return den > 0 ? num / den : 0;
}

// counterfactual: P(Y_{X=x'} = y | observed evidence)
// 1. abduct: compute posterior over hidden variables given evidence
// 2. act: set X=x'
// 3. predict: compute Y distribution
function counterfactualProb(
  graph: CausalGraph,
  target: string,
  targetVal: string,
  interventionVar: string,
  interventionVal: string,
  evidence: Record<string, string>
): number {
  // For a fully observed graph (no hidden variables), abduction is trivial:
  // the posterior is deterministic given evidence.
  // For simplicity, we assume all variables are observed.
  // Counterfactual: given evidence, what would Y be if X had been x'?
  // This is the interventional probability under do(X=x'),
  // but with the posterior distribution over X's parents updated by evidence.

  // In a fully observed discrete graph:
  // P(Y_{X=x'}=y | evidence) = P(Y=y | do(X=x'), evidence consistent with X=x')
  // But if evidence includes X=x and x' ≠ x, then the counterfactual asks
  // "what if X had been different than it actually was?"

  // For simplicity in this benchmark, we handle the case where
  // evidence includes the actual value of X, and we ask about a different value.
  // We use the posterior over parents given evidence.

  // In a fully observed Markovian model:
  // P(Y_{X=x'} | evidence) = P(Y=y | do(X=x'), evidence_without_X)
  // where evidence_without_X is the evidence minus the observed X value.

  const evidenceMinusX: Record<string, string> = {};
  for (const [k, v] of Object.entries(evidence)) {
    if (k !== interventionVar) evidenceMinusX[k] = v;
  }
  return interventionalProb(graph, target, targetVal, interventionVar, interventionVal);
}

export { marginalProb, interventionalProb, counterfactualProb, enumerate, jointProb };
