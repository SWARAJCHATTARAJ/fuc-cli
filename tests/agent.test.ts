import { describe, it, expect } from "bun:test";
import { ToolLoopAgent, stepCountIs } from "ai";
import { defaultAgentConfig } from "../modes/agent/types.ts";
import { ActionTracker } from "../modes/agent/action.tracker.ts";
import { ToolExecutor } from "../modes/agent/tool.executor.ts";
import { createAgentTools } from "../modes/agent/agent-tool.ts";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "../ai/index.ts";

describe("Agent run", () => {
  it("should run agent loop", async () => {
    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);
    const tools = createAgentTools(executor);

    const agent = new ToolLoopAgent({
      model: getAgentModel(),
      stopWhen: stepCountIs(40),
      instructions: [
        `Workspace root: ${config.codebasePath}`,
        "All mutations are staged until approval.",
        SHARED_SYSTEM_PROMPT,
      ].join("\n"),
      tools,
    });

    const result = await agent.generate({
      prompt: "Add a new 'debug' boolean property to AgentConfig in modes/agent/types.ts.",
    });

    expect(result.text).toBeDefined();
  }, 30000); // 30s timeout
});
