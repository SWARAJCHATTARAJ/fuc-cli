import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ActionTracker } from "../modes/agent/action.tracker.ts";
import { ToolExecutor } from "../modes/agent/tool.executor.ts";
import { defaultAgentConfig } from "../modes/agent/types.ts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("ToolExecutor Gates", () => {
  it("symlink containment", () => {
    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);
    
    const outsideFilePath = path.join(os.tmpdir(), "outside-target.txt");
    fs.writeFileSync(outsideFilePath, "secret data");

    const outsideDir = path.join(os.tmpdir(), "outside-dir");
    if (!fs.existsSync(outsideDir)) fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret data");

    const symlinkDir = path.join(process.cwd(), "shortcut");
    if (fs.existsSync(symlinkDir)) fs.rmSync(symlinkDir, { recursive: true, force: true });
    fs.symlinkSync(outsideDir, symlinkDir, "junction");

    expect(() => executor.readFile("shortcut/secret.txt")).toThrow("Path escapes workspace");
    expect(() => executor.createFile("shortcut/newfile.txt", "hacked")).toThrow("Path escapes workspace");
    expect(() => executor.deleteFile("shortcut/secret.txt")).toThrow("Path escapes workspace");
    
    fs.rmSync(symlinkDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
    fs.unlinkSync(outsideFilePath);
  });

  it("shell gate unset", () => {
    const original = process.env.FUC_ALLOW_SHELL;
    delete process.env.FUC_ALLOW_SHELL;
    const configNoShell = defaultAgentConfig();
    const trackerNoShell = new ActionTracker();
    const executorNoShell = new ToolExecutor(trackerNoShell, configNoShell);
    
    expect(() => executorNoShell.queueShell("echo hello")).toThrow("Shell execution disabled");
    
    process.env.FUC_ALLOW_SHELL = original;
  });

  it("shell gate set", () => {
    const original = process.env.FUC_ALLOW_SHELL;
    process.env.FUC_ALLOW_SHELL = "1";
    const configShell = defaultAgentConfig();
    const trackerShell = new ActionTracker();
    const executorShell = new ToolExecutor(trackerShell, configShell);
    
    const result = executorShell.queueShell("echo hello");
    expect(result).toContain("Shell queued");
    
    process.env.FUC_ALLOW_SHELL = original;
  });
});
