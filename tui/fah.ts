import {select , isCancel, confirm} from "@clack/prompts";
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

    const workspacePath = resolve(process.cwd());
    console.log(`\nWorkspace: ${workspacePath}\n`);

    const useWorkspace = await confirm({
        message: "Use this folder as the workspace?",
        initialValue: true
    });

    if (isCancel(useWorkspace) || !useWorkspace) {
        console.log(chalk.dim('\n Goodbye. \n'));
        process.exit(0);
    }

    const mode = await select({
        message:"Which mode you want to proceed with?",
        options:[
            {value:"cli" , label:"CLI"},
            {value:"telegram" , label:"Telegram"},
            {value:"exit" , label:"Exit"}
        ]
    });

    if(isCancel(mode) || mode === "exit"){
        console.log(chalk.dim('\n Goodbye. \n'));
        return;
    }

    if(mode === "cli"){
        await runCliMode()
    }
    else if(mode === "telegram"){
        await runTelegramMode()
    }
}