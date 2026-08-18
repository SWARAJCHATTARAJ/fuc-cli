import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action.tracker";
import { ToolExecutor } from "./tool.executor";
import { createAgentTools } from "./agent-tool";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "../../ai";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./approval";
import { globalSpinner } from "../../tui/spinner";

export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase…",
  });

  if (isCancel(goal) || !goal.trim()) return;

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


  globalSpinner.start("Thinking…");
  const result = await agent.stream({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      globalSpinner.stop();
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );
      }
      globalSpinner.start("Thinking…");
    },
  });
  globalSpinner.stop();

  let fullText = "";
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }
  if (fullText.trim()) console.log("\n");

  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();

  const { errors } = executor.applyApprovedFromTracker();

  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  }
  else{
   console.log(chalk.green('\n✓ Applied.\n'));
  }

  executor.clearStaging()
}