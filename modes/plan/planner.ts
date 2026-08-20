import {
  Output,
  extractJsonMiddleware,
  streamText,
  stepCountIs,
  tool,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import chalk from "chalk";
import { getAgentModel, SHARED_SYSTEM_PROMPT } from "../../ai/index.ts";
import { getAIProvider } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action.tracker.ts";
import { ToolExecutor } from "../agent/tool.executor.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import type { Plan, PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";

const planSchema = z.object({
  researchSummary: z.string().optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        hints: z.array(z.string()).optional(),
        complexity: z.enum(["low", "medium", "high"]).optional(),
      }),
    )
    .min(1)
    .max(15),
});

import { globalSpinner } from "../../tui/spinner.ts";

async function withSpinner<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
  globalSpinner.update(label);
  try {
    return await fn();
  } finally {
    globalSpinner.update("Thinking…");
  }
}

function readOnlyTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        "Read a text file from the workspace. Use a path relative to the project root.",
      inputSchema: z.object({
        path: z.string().describe("Relative file path"),
      }),
      execute: async ({ path: p }) => withSpinner("Reading file…", () => executor.readFile(p)),
    }),

    list_files: tool({
      description: "List files and directories under a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) =>
        withSpinner("Listing files…", () => executor.listFiles(p, recursive)),
    }),

    search_files: tool({
      description:
        'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
      inputSchema: z.object({
        root: z.string().describe("Directory to search, relative to root"),
        pattern: z
          .string()
          .describe("Glob-like pattern using * and ** (forward slashes)"),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) =>
        withSpinner("Searching…", () => executor.searchFiles(root, pattern, content_contains)),
    }),

    analyze_codebase: tool({
      description:
        "Summarize structure: file counts, size, extensions. Read-only.",
      inputSchema: z.object({
        path: z.string().default("."),
      }),
      execute: async ({ path: p }) => withSpinner("Analyzing codebase…", () => executor.analyzeCodebase(p)),
    }),

    list_skills: tool({
      description:
        "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
      inputSchema: z.object({}),
      execute: async () => withSpinner("Listing skills…", () => executor.listSkills()),
    }),

    read_skill: tool({
      description:
        "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path: p }) => withSpinner("Reading skill…", () => executor.readSkill(p)),
    }),
  };
}

const PLAN_INSTRUCTIONS = (
  codebase: string,
  hasWeb: boolean,
  requiresJsonText: boolean,
) =>
  [
    "You are a Plan-Mode planner. You DO NOT modify files.",
    `Workspace: ${codebase}`,
    "Use read-only tools for codebase/skills research.",
    hasWeb
      ? "Web tools are available (web_search/web_crawl/fetch_url). Use only when needed."
      : "Web tools are unavailable (no FIRECRAWL_API_KEY).",
    requiresJsonText
      ? 'After using tools, respond with only valid JSON in this shape: {"researchSummary":"optional summary","steps":[{"title":"step title","description":"step details","hints":["optional hint"],"complexity":"low"}]}. Do not use Markdown or add text before or after the JSON.'
      : "Output must match the provided JSON schema.",
    "Keep it short: 1–15 steps.",
    "Make each step concrete and actionable. Do not use vague descriptions like 'improve the code'. Instead, be specific, e.g., 'add null check before line 42 in foo.ts'.",
    SHARED_SYSTEM_PROMPT,
  ].join("\n");

function parsePlanText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Plan response did not contain JSON.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function toPlan(goal: string, rawOutput: unknown): Plan {
  const validated = planSchema.parse(rawOutput);
  const steps: PlanStep[] = validated.steps.map((s, i) => ({
    id: `step-${i + 1}`,
    title: s.title,
    description: s.description,
    hints: s.hints,
    complexity: s.complexity,
  }));

  return { goal, researchSummary: validated.researchSummary, steps };
}

export async function generatePlan(goal: string) {
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);


  const hasWeb = !!process.env.FIRECRAWL_API_KEY;
  const model = wrapLanguageModel({
    model: getAgentModel(),
    middleware: extractJsonMiddleware(),
  });


  const tools = { ...readOnlyTools(executor) , ...(hasWeb ? createWebTools(tracker) : {}) };

  console.log(chalk.bold("\n🔍 Plan Mode\n"));
  globalSpinner.start("Researching & drafting a plan…");

  try {
    const request = {
      model,
      tools,
      stopWhen: stepCountIs(20),
      prompt: `User goal: \n${goal}`,
    };

    const usesGroq = getAIProvider() === "groq";
    const result = usesGroq
      ? await streamText({
          ...request,
          system: PLAN_INSTRUCTIONS(config.codebasePath, hasWeb, true),
        })
      : await streamText({
          ...request,
          system: PLAN_INSTRUCTIONS(config.codebasePath, hasWeb, false),
          output: Output.object({ schema: planSchema }),
        });

    globalSpinner.stop();
    for await (const chunk of result.textStream) {
      process.stdout.write(chalk.gray(chunk));
    }
    console.log("\n");
    const rawOutput = usesGroq
      ? parsePlanText(await result.text)
      : await result.output;

    return toPlan(goal, rawOutput);
  } finally {
    globalSpinner.stop();
  }
}
