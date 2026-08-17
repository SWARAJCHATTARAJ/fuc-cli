#!/usr/bin/env bun

import {Command} from "commander";
import { runWakeup } from "./tui/fah";
import { runDoctor } from "./diagnostics/doctor";

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
