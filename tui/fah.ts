import { select, isCancel, confirm, intro, outro, note } from "@clack/prompts";
import chalk from "chalk"
import figlet from "figlet";
import { resolve } from "path";
import { runCliMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram";

const BANNER_FONT = 'ANSI Shadow';
const SHADOW = chalk.hex('#37359e');
const FACE = chalk.hex('#ac9cc1').bold;

function printBannerWithShadow(ascii: string) {
  const bannerLines = ascii.replace(/\s+$/, '').split('\n');
  const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
  const rowWidth = maxLen + 2;

  for (const line of bannerLines) {
    console.log(SHADOW(('  ' + line).padEnd(rowWidth)));
  }
  process.stdout.write(`\x1b[${bannerLines.length}A`);
  for (const line of bannerLines) {
    console.log(FACE(line.padEnd(rowWidth)));
  }
  console.log();
}

export async function runWakeup() {
    let ascii:string;
    try {
        ascii = figlet.textSync("fuccode" , {font:BANNER_FONT})
    } catch (error) {
        ascii = figlet.textSync("fuccode" , {font:"Standard"})
    }

    printBannerWithShadow(ascii)
    intro(chalk.bgHex('#ac9cc1').black(' FUC-CLI Engine '));

    const workspacePath = resolve(process.cwd());
    note(workspacePath, 'Current Workspace');

    const useWorkspace = await confirm({
        message: "Use this folder as the workspace?",
        initialValue: true
    });

    if (isCancel(useWorkspace) || !useWorkspace) {
        outro(chalk.dim('Goodbye.'));
        process.exit(0);
    }

    const mode = await select({
        message:"Where would you like to run the agent?",
        options:[
            {value:"cli" , label:"💻 Terminal (Local)"},
            {value:"telegram" , label:"📱 Telegram (Remote)"},
            {value:"exit" , label:"🚪 Exit"}
        ]
    });

    if(isCancel(mode) || mode === "exit"){
        outro(chalk.dim('Goodbye.'));
        return;
    }

    if(mode === "cli"){
        await runCliMode()
    }
    else if(mode === "telegram"){
        await runTelegramMode()
    }
}