# fuc-cli

A local coding-agent CLI with a Telegram interface. It reads your workspace, talks to an OpenRouter model, and can stage file and shell changes for you to review before anything touches disk.

Built on Bun and TypeScript, using the Vercel AI SDK for the agent loop and Telegraf for the Telegram side.

## What it does

- **Terminal launcher** with Ask, Plan, and Agent modes.
- **Telegram bot** that mirrors the same workflows from your phone.
- **Human approval gate** before any file, folder, or shell mutation is applied. Nothing gets written to disk without you looking at it first.
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
| `OPENROUTER_API_KEY` | everything model-backed | required for Ask, Plan, and Agent |
| `OPENROUTER_DEFAULT_MODEL` | — | optional; supports `openrouter/free` or any `:free` model ID |
| `FIRECRAWL_API_KEY` | web research | only needed if you want the agent to search or crawl the web |
| `TELEGRAM_BOT_TOKEN` | Telegram mode | from BotFather |
| `TELEGRAM_OWNER_ID` | Telegram mode | the only chat ID allowed to use the bot |
| `SKILLS_DIRS` | — | optional, semicolon-delimited paths to skill directories |
| `FUC_ALLOW_SHELL` | shell execution | off by default; set to `1` to let the agent stage shell commands at all |

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
- All file operations are restricted to the configured workspace directory, including through symlinks. The agent can't read or write outside it by following a symlink out.

Telegram approval currently reports what actually happened, success or failure per action, rather than assuming everything went through.

## Known limitations

This is an early-stage project. Some things worth knowing before you rely on it:

- Web tools require a valid Firecrawl key. Without one, web-related requests should fail with a clear error rather than crash, but always double check the model isn't fabricating results if you haven't set one up.
- Filesystem search and listing are not yet bounded by size or depth, so pointing the agent at a very large workspace may be slow.
- Telegram sessions live in memory and don't expire on their own. Restarting the bot process clears them.
- There's no test suite yet. Verify anything unfamiliar in the source before trusting it in a workspace you care about.

## Project layout

```
index.ts                Commander entry point: fuc-code fah
tui/                     terminal launcher and rendering
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