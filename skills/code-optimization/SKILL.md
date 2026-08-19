---
name: code-optimization
description: Improve existing code for measurable performance, resource use, reliability, or maintainability while preserving intended behavior. Use when asked to optimize, speed up, simplify, or reduce the cost of code.
---

# Code optimization

Improve the relevant code without changing its intended public behavior unless the user explicitly asks for a behavior change.

- Inspect the affected code, its call sites, and existing tests or build commands before editing.
- Prefer evidence from profiling, benchmarks, logs, or clear algorithmic costs. If measurement is unavailable, label expected gains as estimates rather than facts.
- Make the smallest idiomatic change that addresses the identified cost. Do not add dependencies or redesign unrelated components without a concrete benefit.
- Preserve error handling, input validation, resource cleanup, and compatibility with the project’s existing language and style.
- Run the most relevant build, tests, or benchmark after the change. If none can run, state what was not verified.
- Report what changed, why it improves the code, and any meaningful trade-off.
