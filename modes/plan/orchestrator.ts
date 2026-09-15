import chalk from "chalk";
import { select, isCancel, text, confirm, intro, outro, note } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action.tracker.ts";
import { ToolExecutor } from "../agent/tool.executor.ts";
import { createAgentTools } from "../agent/agent-tool.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import { runApprovalFlow } from "../agent/approval.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { globalSpinner } from "../../tui/spinner.ts";
import { generatePlan } from "./planner.ts";
import { printPlan, selectSteps } from "./selection.ts";
import type { PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";


function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join('\n');
}


export async function runPlanMode(): Promise<void> {
  intro(chalk.bgMagenta.black(" 🧭 Architecture Plan Mode "));

  const goal = await text({ message: "What is your goal?", placeholder: "E.g. Refactor the database schema..." });
  if (isCancel(goal) || !goal.trim()) {
    outro(chalk.dim("Canceled."));
    return;
  }

  const plan = await generatePlan(goal);

  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const proceed = await confirm({
    message: `Execute ${selected.length} step(s)`,
    initialValue: true,
  });
  if (isCancel(proceed) || !proceed) return;

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);


  const tools = {
    ...createAgentTools(executor),
    ...createWebTools(tracker)
  };

  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));

    const agent = new ToolLoopAgent({
      model:getAgentModel(),
      stopWhen:stepCountIs(30),
      instructions: [
        `Workspace root: ${config.codebasePath}`,
        "All mutations are staged until approval.",
        SHARED_SYSTEM_PROMPT,
      ].join("\n"),
      tools
    });

    globalSpinner.start("Thinking…");
    const r = await agent.stream({
      prompt: stepPrompt(plan.goal, step),
      onStepFinish: ({ toolCalls }) => {
        globalSpinner.stop();
        for (const tc of toolCalls) {
          let preview = "";
          try {
            const input = tc.input as any;
            if (tc.toolName === 'execute_shell' || tc.toolName === 'execute_shell_autonomous') preview = String(input.command || '');
            else if (tc.toolName === 'create_file' || tc.toolName === 'modify_file') preview = `${input.path} (${String(input.content || '').length} bytes)`;
            else preview = String(input.path || input.root || JSON.stringify(input));
          } catch { preview = JSON.stringify(tc.input); }
          
          preview = preview.slice(0, 160);
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
    let isFirstChunk = true;
    for await (const chunk of r.textStream) {
      if (isFirstChunk) {
        globalSpinner.stop();
        isFirstChunk = false;
      }
      process.stdout.write(chunk);
      fullText += chunk;
    }
    globalSpinner.stop();
    if (fullText.trim()) console.log("\n");

  }

  const ok = await runApprovalFlow(tracker);

  if(!ok) return executor.clearStaging();

   const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red('\nSome operations reported errors:\n'));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green('\n✓ Applied.\n'));
  }
  executor.clearStaging();
}