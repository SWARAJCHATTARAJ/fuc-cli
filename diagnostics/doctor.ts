import fs from "node:fs";
import chalk from "chalk";

type CheckLevel = "pass" | "warning" | "failure";

interface Check {
  label: string;
  level: CheckLevel;
  detail: string;
}

function validFreeModel(modelId: string): boolean {
  return modelId === "openrouter/free" || modelId.endsWith(":free");
}

function icon(level: CheckLevel): string {
  if (level === "pass") return chalk.green("✓");
  if (level === "warning") return chalk.yellow("!");
  return chalk.red("✗");
}

function color(level: CheckLevel, text: string): string {
  if (level === "pass") return chalk.green(text);
  if (level === "warning") return chalk.yellow(text);
  return chalk.red(text);
}

export function runDoctor(): boolean {
  const checks: Check[] = [];
  const add = (label: string, level: CheckLevel, detail: string) =>
    checks.push({ label, level, detail });

  try {
    fs.accessSync(process.cwd(), fs.constants.R_OK | fs.constants.W_OK);
    add("Workspace", "pass", `${process.cwd()} is readable and writable.`);
  } catch {
    add(
      "Workspace",
      "failure",
      `${process.cwd()} must be readable and writable before the agent can run.`,
    );
  }

  const bunVersion = (process.versions as { bun?: string }).bun ?? "unknown";
  add("Bun runtime", "pass", `Bun ${bunVersion}.`);

  const apiKeyPresent = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  add(
    "OpenRouter API key",
    apiKeyPresent ? "pass" : "failure",
    apiKeyPresent
      ? "Configured (value hidden)."
      : "Missing. Agent, Ask, and Plan modes require OPENROUTER_API_KEY.",
  );

  const modelId = process.env.OPENROUTER_DEFAULT_MODEL ?? "openrouter/free";
  add(
    "OpenRouter model",
    validFreeModel(modelId) ? "pass" : "failure",
    validFreeModel(modelId)
      ? `Using ${modelId}.`
      : "OPENROUTER_DEFAULT_MODEL must be openrouter/free or end in :free.",
  );

  const firecrawlPresent = Boolean(process.env.FIRECRAWL_API_KEY?.trim());
  add(
    "Firecrawl web research",
    firecrawlPresent ? "pass" : "warning",
    firecrawlPresent
      ? "Configured (value hidden)."
      : "Optional. Web research should stay disabled until FIRECRAWL_API_KEY is set.",
  );

  const telegramTokenPresent = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const ownerId = process.env.TELEGRAM_OWNER_ID?.trim() ?? "";
  const telegramLevel: CheckLevel =
    telegramTokenPresent && /^-?\d+$/.test(ownerId)
      ? "pass"
      : telegramTokenPresent || ownerId
        ? "failure"
        : "warning";
  add(
    "Telegram mode",
    telegramLevel,
    telegramLevel === "pass"
      ? "Bot token and owner chat ID are configured (token hidden)."
      : telegramLevel === "failure"
        ? "Set both TELEGRAM_BOT_TOKEN and a numeric TELEGRAM_OWNER_ID."
        : "Optional. Set TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID to enable it.",
  );

  console.log(chalk.bold("\n🩺 fuc-code doctor\n"));
  for (const check of checks) {
    console.log(
      `  ${icon(check.level)} ${chalk.bold(check.label)} — ${color(check.level, check.detail)}`,
    );
  }

  const failures = checks.filter((check) => check.level === "failure").length;
  const warnings = checks.filter((check) => check.level === "warning").length;
  if (failures > 0) {
    console.log(chalk.red(`\n${failures} required check(s) failed.\n`));
    return false;
  }

  const suffix = warnings === 1 ? "warning" : "warnings";
  console.log(
    warnings > 0
      ? chalk.yellow(`\nReady with ${warnings} optional ${suffix}.\n`)
      : chalk.green("\nAll checks passed.\n"),
  );
  return true;
}
