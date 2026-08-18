# fuc-cli

A local coding agent with a Telegram interface. It reads your workspace, works with an OpenRouter or Groq model, and stages file and shell changes for you to review before anything gets applied.

Built on Bun and TypeScript, using the Vercel AI SDK for the agent loop and Telegraf for Telegram.

## What it does

- **Terminal launcher** with Ask, Plan, and Agent modes.
- **Telegram bot** that mirrors the same workflows from your phone.
- **Human approval gate** before any file, folder, or shell mutation is applied.
- **Live status while it works** — a terminal spinner with elapsed time and streamed token output in the terminal, and a Telegram typing indicator with a periodically updated status message, so you're not staring at a blank screen during a model call or tool run.
- **Telegram sessions expire on their own** after 15 minutes of inactivity, and can be cancelled explicitly with `/cancel`.
- **Optional web research** through Firecrawl, when configured.

## How a request flows

```
CLI or Telegram request
        |
        v
AI SDK agent + selected tools
        |
        +-- reads / analysis --> immediate result
        |
        +-- file, folder, shell mutation --> staged, pending approval
                                                |
                                                v
                                      you approve or reject
                                                |
                                                v
                                     approved actions get applied
```

Reads happen immediately. Anything that changes your workspace gets staged first and waits for a yes.

## Modes

**Ask** — read-only questions about the codebase. Can save the answer as Markdown.

**Plan** — the agent breaks a task into steps, you pick which ones to run, it executes them, then everything goes through approval together.

**Agent** — a more open-ended loop that can read, analyze, and stage changes as it works through a task.

**Telegram** — same three modes, driven through chat instead of a terminal.

## Setup

```bash
bun install
bun run index.ts --help
```

### Environment variables

Copy `.env.example` to `.env` and fill in what you need:

| Variable | Required for | Notes |
|---|---|---|
| `AI_PROVIDER` | everything model-backed | optional; `openrouter` by default, or `groq` |
| `OPENROUTER_API_KEY` | OpenRouter | required when `AI_PROVIDER=openrouter` |
| `OPENROUTER_DEFAULT_MODEL` | OpenRouter | optional; code permits `openrouter/free` or any model ID ending in `:free` |
| `GROQ_API_KEY` | Groq | required when `AI_PROVIDER=groq` |
| `GROQ_DEFAULT_MODEL` | Groq | optional; defaults to `openai/gpt-oss-20b` |
| `FIRECRAWL_API_KEY` | web research | only needed if you want the agent to search or crawl the web |
| `TELEGRAM_BOT_TOKEN` | Telegram mode | from BotFather |
| `TELEGRAM_OWNER_ID` | Telegram mode | the only chat ID allowed to use the bot |
| `SKILLS_DIRS` | — | optional, semicolon-delimited paths to skill directories |
| `FUC_ALLOW_SHELL` | shell execution | off by default; set to `1` to let the agent stage shell commands at all |
| `FUC_MAX_TOOL_OUTPUT_CHARS` | — | optional; maximum characters returned by a read-only tool, default 6000 |
| `FUC_MAX_DEPTH` | — | optional; max directory traversal depth during search/list/analyze, default 10 |
| `FUC_MAX_FILES` | — | optional; max files processed during traversal, default 5000 |

Never commit your real `.env`. Only `.env.example` with placeholder values belongs in the repo.

## Running it

```bash
fuc-code fah
```

This opens the launcher, where you pick terminal or Telegram, then a mode.

## Permission model

The agent can read your workspace freely. It cannot write, delete, or run shell commands without your explicit approval:

- File and folder changes are staged first. You see a diff before anything is written.
- Shell commands are disabled by default, on top of the approval gate. You have to opt in with `FUC_ALLOW_SHELL=1`, and even then, each command needs its own separate confirmation, shown in full, not folded into a general "approve all" for file changes.
- All file operations, including reads from configured skill directories, are restricted to the configured workspace directory using real path resolution, not string matching, so symlinks pointing outside the workspace are rejected. Read-only tool results are capped at 6,000 characters by default; directory traversal depth and file-count limits are configurable via `FUC_MAX_DEPTH` (default 10) and `FUC_MAX_FILES` (default 5000).

## Known limitations

This is an early-stage project under active work. Current state, honestly:

- **There's no automated test suite yet wired into `bun test`.** Individual bugs have been verified with one-off scripts during development, but there's no standing regression suite. Read the source for anything you're about to rely on, and consider this a priority before depending on this in a workflow that matters.
- **Terminal and Telegram run separate agent implementations.** Telegram doesn't share `modes/agent/orchestrator.ts` with the terminal, it spins up its own `ToolLoopAgent` instance in `modes/telegram/agent-run.ts`. Both are currently correct, but a fix applied to one path isn't guaranteed to apply to the other. Keep this in mind if you're patching agent behavior, check both paths.
- **Web fetch and Firecrawl results are not yet treated as untrusted content.** There's no SSRF protection (blocking private/internal addresses), response size limiting, or an explicit instruction telling the model not to treat scraped page content as commands. Be cautious with web research enabled against content you don't control.

## Project layout

```
index.ts                Commander entry point: fuc-code fah
tui/                     terminal launcher, rendering, and spinner
ai/                       OpenRouter model configuration
modes/cli.ts             terminal sub-mode menu
modes/agent/             agent tools, staging, approval, diff view
modes/ask/                read-only Q&A
modes/plan/                plan generation, selection, execution, web tools
modes/telegram/           Telegram commands, sessions, approval UI
```

## Contributing

If you're fixing a bug, add a small test that reproduces it first if the project has a test runner set up. Keep pull requests focused, one fix or one feature at a time, and don't fold in unrelated formatting changes.

## Security

Do not open an issue with real API keys, tokens, or `.env` contents. If you find a security problem (path traversal, shell injection, SSRF through the web tools), report it privately rather than filing a public issue.
