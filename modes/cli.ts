import chalk from "chalk";
import { select, isCancel, outro } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";
import { getAIErrorMessage } from "../ai/errors";

export async function runCliMode() {
  while (true) {
    const mode = await select({
      message: "Choose Agent Mode",
      options: [
        { value: "agent", label: "🤖 Agent (Autonomous Coding)" },
        { value: "plan", label: "🧭 Plan (Multi-step Architecture)" },
        { value: "ask", label: "💡 Ask (Codebase Q&A)" },
        { value: "back", label: "← Back to main menu" },
      ],
    });

    if (isCancel(mode) || mode === "back") {
      outro(chalk.dim('Returning to main menu...'));
      return;
    }

    try {
      if (mode === "agent") {
        await runAgentMode();
      }
      if (mode === "ask") {
        await runAskMode();
      }
      if (mode === "plan") {
        await runPlanMode();
      }
    } catch (error) {
      const aiError = getAIErrorMessage(error);
      if (!aiError) throw error;
      console.log(chalk.red(`\n✗ ${aiError}\n`));
    }

    if (mode !== "agent" && mode !== "plan" && mode !== "ask") {
      console.log(chalk.yellow("\nThat mode is not implemented yet.\n"));
    }
  }
}
