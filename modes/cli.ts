import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";
import { getAIErrorMessage } from "../ai/errors";

export async function runCliMode() {
  while (true) {
    const mode = await select({
      message: "Choose CLI sub-mode",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        { value: "back", label: "← Back to main menu" },
      ],
    });

    if (isCancel(mode) || mode === "back") return;

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
