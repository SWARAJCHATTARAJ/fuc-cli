import chalk from "chalk";

export interface Spinner {
  start(label: string): void;
  update(label: string): void;
  stop(finalMessage?: string): void;
  addListener(fn: (label: string) => void): () => void;
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(): Spinner {
  const isTTY = process.stdout.isTTY;
  let interval: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let currentLabel = "";
  let frameIndex = 0;
  const listeners = new Set<(label: string) => void>();

  function render() {
    if (!isTTY) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const frame = frames[frameIndex];
    const timeStr = elapsed > 0 ? chalk.dim(` (${elapsed}s)`) : "";
    process.stdout.write(`\r\x1b[K${chalk.cyan(frame)} ${currentLabel}${timeStr}`);
    frameIndex = (frameIndex + 1) % frames.length;
  }

  return {
    addListener(fn: (label: string) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start(label: string) {
      currentLabel = label;
      startTime = Date.now();
      listeners.forEach((l) => l(label));
      if (!isTTY) {
        console.log(chalk.cyan("▶"), label);
        return;
      }
      if (interval) clearInterval(interval);
      frameIndex = 0;
      render();
      interval = setInterval(render, 80);
    },
    update(label: string) {
      if (!isTTY && label !== currentLabel) {
        console.log(chalk.cyan("▶"), label);
      }
      currentLabel = label;
      listeners.forEach((l) => l(label));
      if (isTTY) render();
    },
    stop(finalMessage?: string) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (isTTY) {
        process.stdout.write("\r\x1b[K"); // clear the line
      }
      if (finalMessage) {
        console.log(finalMessage);
      }
    },
  };
}

export const globalSpinner = createSpinner();
