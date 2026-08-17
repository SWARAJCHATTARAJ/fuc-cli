#!/usr/bin/env bun

import {Command} from "commander";
import { runfah } from "./tui/fah";

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
        await runfah()
    }
  );


 await program.parseAsync(process.argv)