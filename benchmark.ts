import { ToolExecutor } from "./modes/agent/tool.executor.ts";
import { ActionTracker } from "./modes/agent/action.tracker.ts";
import { defaultAgentConfig } from "./modes/agent/types.ts";

async function runBench() {
  const tracker = new ActionTracker();
  const config = defaultAgentConfig();
  config.excludePatterns = [];
  const executor = new ToolExecutor(tracker, config);


  console.log("Measuring searchFiles...");
  let start = performance.now();
  // A search that scans all text files for a random string
  await executor.searchFiles(".", "**/*", "NON_EXISTENT_STRING_FOR_BENCHMARK");
  console.log(`searchFiles took ${(performance.now() - start).toFixed(2)}ms`);

  console.log("Measuring listFiles (recursive)...");
  start = performance.now();
  await executor.listFiles(".", true);
  console.log(`listFiles took ${(performance.now() - start).toFixed(2)}ms`);

  console.log("Measuring analyzeCodebase...");
  start = performance.now();
  await executor.analyzeCodebase(".");
  console.log(`analyzeCodebase took ${(performance.now() - start).toFixed(2)}ms`);
}

runBench();
