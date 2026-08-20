import { generatePlan } from "./modes/plan/planner.ts";

import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "./ai/index.ts";
import { ActionTracker } from "./modes/agent/action.tracker.ts";
import { ToolExecutor } from "./modes/agent/tool.executor.ts";
import { defaultAgentConfig } from "./modes/agent/types.ts";
import { z } from "zod";

async function testAsk(question: string) {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    instructions: [
      "You are an Ask-Mode assistant. Your job is to answer questions about the codebase.",
      "1. Answer the specific question asked without unnecessary preamble.",
      "2. Cite the actual file and line number when referencing code.",
      "3. Say plainly when something isn't found rather than guessing.",
      SHARED_SYSTEM_PROMPT
    ].join("\n"),
    tools: {
      read_file: tool({
        description: "Read a text file from the workspace. Use a path relative to the project root.",
        inputSchema: z.object({ path: z.string() }),
        execute: async ({ path: p }) => executor.readFile(p),
      })
    },
  });

  const result = await agent.generate({ prompt: question });
  console.log("=== ASK RESULT ===");
  console.log(result.text);
}

async function testPlan(goal: string) {
  console.log("=== PLAN RESULT ===");
  const plan = await generatePlan(goal);
  console.log(JSON.stringify(plan, null, 2));
}

async function run() {
  await testAsk("What is the name and version of this package according to package.json?");
  await testPlan("Add a simple unit test file for planner");
}

run();
