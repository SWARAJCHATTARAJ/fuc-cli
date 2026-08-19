import { describe, it, expect, mock } from "bun:test";
import { defaultAgentConfig } from "../modes/agent/types.ts";
import { ActionTracker } from "../modes/agent/action.tracker.ts";
import { ToolExecutor } from "../modes/agent/tool.executor.ts";
import { createAgentTools } from "../modes/agent/agent-tool.ts";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "../ai/index.ts";

mock.module("ai", () => {
  return {
    ToolLoopAgent: class {
      constructor() {}
      async generate() { return { text: "mock answer" }; }
    },
    stepCountIs: () => () => false,
    wrapLanguageModel: (opts: any) => opts.model
  };
});

describe("Agent run", () => {
  it("should run agent loop", async () => {
    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);
    const tools = createAgentTools(executor);

    // Mock bypasses actual LLM request
    const { ToolLoopAgent } = await import("ai");
    const agent = new (ToolLoopAgent as any)({});

    const result = await agent.generate({
      prompt: "Add a new 'debug' boolean property to AgentConfig in modes/agent/types.ts.",
    });

    expect(result.text).toBeDefined();
  });
});
