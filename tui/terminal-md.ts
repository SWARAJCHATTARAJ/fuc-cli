import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";

let ready = false;

function ensureMarked(): void {
  if (ready) return;
  const w = Math.max(40, Math.min(process.stdout.columns || 80, 120));

  
  //   @ts-ignore
  marked.use(markedTerminal({ 
      width: w, 
      reflowText: true,
      // Add beautiful colors
      code: chalk.yellow,
      blockquote: chalk.gray.italic,
      html: chalk.gray,
      heading: chalk.green.bold,
      firstHeading: chalk.magenta.bold.underline,
      hr: chalk.reset,
      listitem: chalk.reset,
      table: chalk.reset,
      paragraph: chalk.reset,
      strong: chalk.bold.cyan,
      em: chalk.italic,
      codespan: chalk.yellow.bgBlack,
      del: chalk.dim.gray.strikethrough,
      link: chalk.blue,
      href: chalk.blue.underline
  }, {}));
  ready = true;
}

export function renderTerminalMarkdown(source: string): string {
  ensureMarked();
  return marked.parse(source.trimEnd(), { async: false }) as string;
}