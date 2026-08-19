import { describe, it, expect, mock } from "bun:test";

mock.module("ai", () => {
  return {
    streamText: async () => ({
      textStream: [],
      text: Promise.resolve(JSON.stringify({
        researchSummary: "mock summary",
        steps: [{ title: "Edit types", description: "Add debug boolean" }]
      })),
      output: Promise.resolve({
        researchSummary: "mock summary",
        steps: [{ title: "Edit types", description: "Add debug boolean" }]
      })
    }),
    tool: () => ({}),
    wrapLanguageModel: (opts: any) => opts.model,
    extractJsonMiddleware: () => ({}),
    stepCountIs: () => () => false,
    Output: { object: () => ({}) }
  };
});

import { generatePlan } from "../modes/plan/planner.ts";

describe("Plan generation", () => {
  it("should generate a plan", async () => {
    const goal = "Make a small code change to modes/agent/types.ts to add a new 'debug' boolean property to AgentConfig. Just that one property.";
    const result = await generatePlan(goal);
    expect(result.goal).toBe(goal);
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
