#!/usr/bin/env bun

import {Command} from "commander";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runWakeup } from "./tui/fah.ts";
import { runDoctor } from "./diagnostics/doctor.ts";

const envPath = join((import.meta as any).dir, ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      const value = match[2] || "";
      if (key && !process.env[key]) {
        process.env[key] = value.trim();
      }
    }
  }
}

const program = new Command();

program
   .name("FUC cli")
   .description("fuc-code")
   .version('0.0.1');

program
  .command("fah")
  .description("show the banner and pick cli or telegram mode")
  .action(
    async()=>{
        await runWakeup()
    }
  );

program
  .command("doctor")
  .description("check workspace and mode configuration without exposing secrets")
  .action(() => {
    if (!runDoctor()) process.exitCode = 1;
  });


 await program.parseAsync(process.argv)
