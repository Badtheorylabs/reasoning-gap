import { describe, it, expect } from "vitest";
import { marginalProb, interventionalProb } from "../lib/inference";
import { chainGraph } from "../bench/graphs/chain";
import { forkGraph } from "../bench/graphs/fork";

describe("chain: T → S → P", () => {
  const g = chainGraph;

  it("marginal P(T=yes) = 0.5", () => {
    expect(marginalProb(g, "T", "yes")).toBeCloseTo(0.5);
  });

  it("P(P=high | T=yes) > P(P=high | T=no)", () => {
    const givenTrained = marginalProb(g, "P", "high", { T: "yes" });
    const givenUntrained = marginalProb(g, "P", "high", { T: "no" });
    expect(givenTrained).toBeGreaterThan(givenUntrained);
  });

  it("in a chain, P(P|do(T)) = P(P|T) — no confounding", () => {
    const obs = marginalProb(g, "P", "high", { T: "yes" });
    const ivn = interventionalProb(g, "P", "high", "T", "yes");
    // In a pure chain with no confounders, do and observe give same result
    expect(obs).toBeCloseTo(ivn);
  });
});

describe("fork: E ← W → I", () => {
  const g = forkGraph;

  it("observational P(I|E=advanced) is confounded", () => {
    const obs = marginalProb(g, "I", "high", { E: "advanced" });
    const ivn = interventionalProb(g, "I", "high", "E", "advanced");
    // Under do(E=advanced), W is independent of E, so
    // P(I=high|do(E=advanced)) = sum_W P(I=high|W) P(W)
    const pIhigh_given_Wlow = marginalProb(g, "I", "high", { W: "low" });
    const pIhigh_given_Whigh = marginalProb(g, "I", "high", { W: "high" });
    const expected = pIhigh_given_Wlow * 0.5 + pIhigh_given_Whigh * 0.5;
    expect(ivn).toBeCloseTo(expected);
    expect(Math.abs(obs - ivn)).toBeGreaterThan(0.05);
  });
});
