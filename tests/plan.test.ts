import { describe, it, expect } from "bun:test";
import { generatePlan } from "../modes/plan/planner.ts";

describe("Plan generation", () => {
  it("should generate a plan", async () => {
    const goal = "Make a small code change to modes/agent/types.ts to add a new 'debug' boolean property to AgentConfig. Just that one property.";
    const result = await generatePlan(goal);
    expect(result.goal).toBe(goal);
    expect(result.steps.length).toBeGreaterThan(0);
  }, 30000); // 30s timeout
});
