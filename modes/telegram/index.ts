import { Telegraf } from "telegraf";
import chalk from "chalk";
import { WELCOME } from "./constants";
import { resolve as pathResolve } from "path";
import { registerHandlers } from "./handlers";

export async function runTelegramMode() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.TELEGRAM_OWNER_ID;

  const bot = new Telegraf(token!);
  const workspacePath = pathResolve(process.cwd());
  let workspaceConfirmed = false;

  bot.action('ws_confirm', async (ctx) => {
    if (ctx.chat?.id.toString() !== ownerId) return ctx.answerCbQuery();
    workspaceConfirmed = true;
    await ctx.editMessageText(`✅ Workspace confirmed: \`${workspacePath}\``, { parse_mode: "Markdown" });
    await ctx.answerCbQuery('Confirmed!');
    await ctx.reply(WELCOME, { parse_mode: "Markdown" });
  });

  bot.action('ws_cancel', async (ctx) => {
    if (ctx.chat?.id.toString() !== ownerId) return ctx.answerCbQuery();
    await ctx.editMessageText(`❌ Workspace declined: \`${workspacePath}\``, { parse_mode: "Markdown" });
    await ctx.answerCbQuery('Declined!');
    process.exit(0);
  });

  bot.use(async (ctx, next) => {
    if (!workspaceConfirmed && ctx.callbackQuery && 'data' in ctx.callbackQuery && (ctx.callbackQuery.data === 'ws_confirm' || ctx.callbackQuery.data === 'ws_cancel')) {
      return next();
    }
    if (!workspaceConfirmed) {
      if (ctx.chat?.id.toString() === ownerId) {
        await ctx.reply(`⚠️ Please confirm the workspace first:\n\`${workspacePath}\``, { parse_mode: "Markdown" });
      }
      return;
    }
    return next();
  });

  registerHandlers(bot);

  await bot.telegram.sendMessage(
    ownerId!, 
    `Workspace: \`${workspacePath}\`\n\nUse this folder as the workspace?`, 
    { 
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Yes", callback_data: "ws_confirm" },
            { text: "❌ No", callback_data: "ws_cancel" }
          ]
        ]
      }
    }
  );
  console.log(chalk.green("Sent workspace confirmation to Telegram.\n"));

  bot.launch();
  console.log(chalk.green("Telegram bot is running. Press Ctrl+C to stop.\n"));

  await new Promise<void>((resolve) => {
    const stop = () => {
      bot.stop("SIGINT");
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}