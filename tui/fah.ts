import {select , isCancel} from "@clack/prompts";
import chalk from "chalk"
import figlet from "figlet";
mport { runCliMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram";
import { runCliMode } from "../modes/cli";

const BANNER_FONT ='ANSI shadow';
const SHADOW = chalk.hex("#d26a6a")
const FACE= chalk.hex("#6a84d2").bold;

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

export async function runfah() {
    let ascii:string;
    try {
        ascii = figlet.textSync('fuc code' , {font:BANNER_FONT})
    } catch (error) {
        ascii = figlet.textSync("fuc code" , {font:"Standard"})
    }
    
    printBannerWithShadow(ascii)

     const mode = await select({
        message:"Which mode you want to proceed with?",
        options:[
            {value:"cli" , label:"CLI"},
            {value:"telegram" , label:"Telegram"},
            {value:"exit" , label:"Exit"}
        ]
    });

    if(isCancel(mode || mode === "exit")){
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
