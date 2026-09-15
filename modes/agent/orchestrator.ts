import { isCancel, text, intro, outro, note } from "@clack/prompts";
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
  intro(chalk.bgCyan.black(" 🤖 Autonomous Agent Mode "));

  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "E.g. Create a new Next.js component...",
  });

  if (isCancel(goal) || !goal.trim()) {
    outro(chalk.dim("Canceled."));
    return;
  }

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


  globalSpinner.start("Agent is thinking...");
  const result = await agent.stream({
    prompt: goal.trim(),
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
        
        preview = preview.slice(0, 80);
        console.log(
          chalk.cyan("  ↳"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 80 ? "..." : "")),
        );
      }
      globalSpinner.start("Agent is working...");
    },
  });
  globalSpinner.stop();

  let fullText = "";
  let isFirstChunk = true;
  for await (const chunk of result.textStream) {
    if (isFirstChunk) {
      globalSpinner.stop();
      console.log(chalk.dim("\n  ─ Response ──────────────────────────────\n"));
      isFirstChunk = false;
    }
    process.stdout.write(chunk);
    fullText += chunk;
  }
  
  globalSpinner.stop(); 
  
  if (fullText.trim()) console.log(chalk.dim("\n  ─────────────────────────────────────────\n"));

  try {
    const usage = await (result as any).usage;
    if (usage) {
      const prompt = usage.promptTokens ?? 0;
      const comp = usage.completionTokens ?? 0;
      const total = usage.totalTokens ?? (prompt + comp);
      if (total > 0) {
        note(`Prompt: ${prompt}\nCompletion: ${comp}\nTotal: ${total}`, `📊 Token Consumption`);
      }
    }
  } catch (e) {}

  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();

  const { errors } = executor.applyApprovedFromTracker();

  if (errors.length) {
    note(errors.map(e => `• ${e}`).join("\n"), chalk.red("Errors occurred"));
  } else {
    outro(chalk.green("✨ All changes successfully applied to workspace."));
  }

  executor.clearStaging();
}