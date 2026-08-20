import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";

export function fallback(models: LanguageModelV4[]): LanguageModelV4 {
  const primary = models[0];
  return new Proxy(primary!, {
    get(target, prop, receiver) {
      if (prop === 'doGenerate') {
        return async (options: Parameters<LanguageModelV4['doGenerate']>[0]) => {
          let lastError;
          for (const model of models) {
            try { return await model.doGenerate(options as any); }
            catch (error) { lastError = error; }
          }
          throw lastError;
        };
      }
      if (prop === 'doStream') {
        return async (options: Parameters<LanguageModelV4['doStream']>[0]) => {
          let lastError;
          for (const model of models) {
            try { return await model.doStream(options as any); }
            catch (error) { lastError = error; }
          }
          throw lastError;
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as LanguageModelV4;
}

const FREE_MODELS_ROUTER = "openrouter/free";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type AIProvider = "openrouter" | "groq" | "local" | "nvidia" | "zhipu";

export function parseAIProvider(value = process.env.AI_PROVIDER): AIProvider | undefined {
  const provider = value?.trim().toLowerCase();

  if (!provider || provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";
  if (provider === "local") return "local";
  if (provider === "nvidia") return "nvidia";
  if (provider === "zhipu") return "zhipu";
  return undefined;
}

export function getAIProvider(): AIProvider {
  const provider = parseAIProvider();
  if (!provider) {
    throw new Error("AI_PROVIDER must be 'openrouter', 'groq', or 'local'.");
  }
  return provider;
}

export function getConfiguredModel(provider: AIProvider): string {
  if (provider === "local") {
    return process.env.LOCAL_MODEL_NAME?.trim() || "local-model";
  }
  if (provider === "groq") {
    return process.env.GROQ_DEFAULT_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  }

  return process.env.OPENROUTER_DEFAULT_MODEL?.trim() || FREE_MODELS_ROUTER;
}

export function getModelValidationError(
  provider: AIProvider,
  modelId: string,
): string | undefined {
  if (
    provider === "openrouter" &&
    modelId !== FREE_MODELS_ROUTER &&
    !modelId.endsWith(":free")
  ) {
    return "OPENROUTER_DEFAULT_MODEL must be 'openrouter/free' or a model ending in ':free'.";
  }

  return undefined;
}

import { spawn } from "child_process";
import { existsSync } from "fs";

let isStartingServer = false;

async function ensureLocalServerRunning(): Promise<void> {
  const baseURL = process.env.LOCAL_MODEL_BASE_URL?.trim() || "http://127.0.0.1:8080/v1";
  
  try {
    const res = await fetch(`${baseURL}/models`);
    if (res.ok) return;
  } catch (e) {
    // not running
  }

  if (isStartingServer) {
     for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
           if ((await fetch(`${baseURL}/models`)).ok) return;
        } catch (e) {}
     }
     throw new Error("Local AI server failed to start.");
  }

  isStartingServer = true;
  
  const exePath = "D:\\llamafile\\llamafile-0.10.5.exe";
  const modelPath = "D:\\llamafile\\qwen2.5-coder-7b-instruct-q4_k_m.gguf";

  if (!existsSync(exePath) || !existsSync(modelPath)) {
    isStartingServer = false;
    throw new Error(`Cannot start local AI. Please ensure the files exist on your D: drive. Missing files: ${exePath} or ${modelPath}`);
  }

  console.log("\n[FUC CLI] Auto-starting local AI server from D:\\llamafile...");
  
  const child = spawn(exePath, [
    "-m", modelPath,
    "--port", "8080"
  ], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      if ((await fetch(`${baseURL}/models`)).ok) {
        console.log("[FUC CLI] Local AI server is ready!");
        isStartingServer = false;
        return;
      }
    } catch (e) {}
  }
  
  isStartingServer = false;
  throw new Error("Local AI server failed to start within 30 seconds.");
}

function getLocalModel(): LanguageModelV4 {
  const baseURL = process.env.LOCAL_MODEL_BASE_URL?.trim() || "http://127.0.0.1:8080/v1";
  const apiKey = process.env.LOCAL_MODEL_API_KEY?.trim() || "not-needed";
  const modelId = getConfiguredModel("local");

  const provider = createOpenAICompatible({
    name: "local",
    apiKey,
    baseURL,
    includeUsage: true,
  });
  const internalModel = provider(modelId);

  return new Proxy(internalModel, {
    get(target, prop, receiver) {
      if (prop === 'doGenerate') {
        return async (options: Parameters<LanguageModelV4['doGenerate']>[0]) => {
          await ensureLocalServerRunning();
          return internalModel.doGenerate(options as any);
        };
      }
      if (prop === 'doStream') {
        return async (options: Parameters<LanguageModelV4['doStream']>[0]) => {
          await ensureLocalServerRunning();
          return internalModel.doStream(options as any);
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  }) as LanguageModelV4;
}

export function getAgentModel() {
  const providerName = getAIProvider();
  const modelId = getConfiguredModel(providerName);

  if (providerName === "local") {
    return getLocalModel();
  }

  if (providerName === "nvidia") {
    const apiKey = process.env.NVIDIA_API_KEY?.trim();
    if (!apiKey) throw new Error("NVIDIA_API_KEY is not set");

    const provider = createOpenAICompatible({
      name: "nvidia",
      apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
      includeUsage: true,
    });
    
    // NVIDIA default to Llama 3.1 70B if none specified
    const nvidiaModel = provider(process.env.NVIDIA_DEFAULT_MODEL?.trim() || "meta/llama-3.1-70b-instruct");
    return fallback([nvidiaModel, getLocalModel()]);
  }

  if (providerName === "zhipu") {
    const apiKey = process.env.ZHIPU_API_KEY?.trim();
    if (!apiKey) throw new Error("ZHIPU_API_KEY is not set");

    const provider = createOpenAICompatible({
      name: "zhipu",
      apiKey,
      baseURL: "https://open.bigmodel.cn/api/paas/v4/",
      includeUsage: true,
    });
    
    const zhipuModel = provider(process.env.ZHIPU_DEFAULT_MODEL?.trim() || "glm-4");
    return fallback([zhipuModel, getLocalModel()]);
  }

  if (providerName === "groq") {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const provider = createOpenAICompatible({
      name: "groq",
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      includeUsage: true,
    });
    
    const groqModel = wrapLanguageModel({
      model: provider(modelId),
      middleware: {
        transformParams: async ({ params }) => ({
          ...params,
          prompt: params.prompt.map((message) => {
            if (message.role !== "assistant") return message;

            return {
              ...message,
              content: message.content.filter((part) => part.type !== "reasoning"),
            };
          }),
        }),
      },
    });
    
    return fallback([groqModel, getLocalModel()]);
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const modelError = getModelValidationError(providerName, modelId);
  if (modelError) throw new Error(modelError);

  const provider = createOpenRouter({ apiKey });
  const openRouterModel = provider(modelId);
  
  return fallback([openRouterModel, getLocalModel()]);
}

export const SHARED_SYSTEM_PROMPT = `
# Code Generation Standards

When writing or editing code, follow these rules before producing output:

1. Read relevant existing files before writing new code, rather than guessing at conventions.
   Match the existing file's conventions first. Look at variable naming,
   quote style, import ordering, and error-handling patterns already in
   the file or nearby files, and follow them.

2. Do not invent APIs, imports, or dependencies that don't exist in the project.
   Always verify them against the codebase before using them.

3. Prefer the smallest correct diff. Edit existing functions and files
   over rewriting them. Don't restructure code that wasn't asked about
   just because you're already in the file.

4. No comments that restate what the code obviously does. Comment only
   where the "why" isn't clear from reading the code itself.

5. Handle errors for real. No empty catch blocks, no swallowing errors
   silently. If you're not sure what the right failure behavior is, say so instead of guessing.

6. No dead code, no unused imports or variables, no placeholder TODOs.
   If something is genuinely out of scope, say what's missing instead of stubbing it.

7. Respect existing type strictness. Don't introduce \`any\` to make
   something compile if the surrounding code is strict.

8. After generating code, explain what changed and why in plain terms.
   State your assumptions clearly when you are uncertain instead of confidently guessing.

9. If a change would need to touch more than a few files to be done
   properly, say so and propose the scope before writing all of it.

10. CRITICAL TOOL USAGE: You are an agent equipped with workspace tools. 
    If asked to create, edit, or delete a file, you MUST use the provided
    tools (create_file, modify_file, delete_file). DO NOT output code 
    directly in markdown blocks if it is meant to be saved. You MUST 
    invoke the appropriate tool.
`;
