import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import type { LanguageModelV1 } from "@ai-sdk/provider";

export function fallback(models: LanguageModelV1[]): LanguageModelV1 {
  const primary = models[0];
  return new Proxy(primary, {
    get(target, prop, receiver) {
      if (prop === 'doGenerate') {
        return async (options: Parameters<LanguageModelV1['doGenerate']>[0]) => {
          let lastError;
          for (const model of models) {
            try { return await model.doGenerate(options); }
            catch (error) { lastError = error; }
          }
          throw lastError;
        };
      }
      if (prop === 'doStream') {
        return async (options: Parameters<LanguageModelV1['doStream']>[0]) => {
          let lastError;
          for (const model of models) {
            try { return await model.doStream(options); }
            catch (error) { lastError = error; }
          }
          throw lastError;
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

const FREE_MODELS_ROUTER = "openrouter/free";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type AIProvider = "openrouter" | "groq" | "local";

export function parseAIProvider(value = process.env.AI_PROVIDER): AIProvider | undefined {
  const provider = value?.trim().toLowerCase();

  if (!provider || provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";
  if (provider === "local") return "local";
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

function getLocalModel(): LanguageModelV1 {
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
        return async (options: Parameters<LanguageModelV1['doGenerate']>[0]) => {
          await ensureLocalServerRunning();
          return internalModel.doGenerate(options);
        };
      }
      if (prop === 'doStream') {
        return async (options: Parameters<LanguageModelV1['doStream']>[0]) => {
          await ensureLocalServerRunning();
          return internalModel.doStream(options);
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export function getAgentModel() {
  const providerName = getAIProvider();
  const modelId = getConfiguredModel(providerName);

  if (providerName === "local") {
    return getLocalModel();
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

1. Match the existing file's conventions first. Look at variable naming,
   quote style, import ordering, and error-handling patterns already in
   the file or nearby files, and follow them, even if you'd personally
   choose differently.

2. Prefer the smallest correct diff. Edit existing functions and files
   over rewriting them. Don't restructure code that wasn't asked about
   just because you're already in the file.

3. No comments that restate what the code obviously does. Comment only
   where the "why" isn't clear from reading the code itself (a non-obvious
   workaround, a deliberate tradeoff, a gotcha future you would hit).

4. Handle errors for real. No empty catch blocks, no swallowing errors
   silently, no catching just to log and continue unless that's actually
   the correct behavior for that code path. If you're not sure what the
   right failure behavior is, say so instead of guessing.

5. No dead code, no unused imports or variables, no placeholder TODOs
   left in place of real logic. If something is genuinely out of scope,
   say what's missing in your summary instead of stubbing it silently.

6. Respect existing type strictness. Don't introduce \`any\` to make
   something compile if the surrounding code is strict. If a type is
   genuinely hard to express, explain why before falling back to \`any\`.

7. After generating code, explain what changed and why in plain terms,
   not a restatement of the diff. Flag anything you're uncertain about
   rather than presenting a guess as settled.

8. If a change would need to touch more than a few files to be done
   properly, say so and propose the scope before writing all of it,
   rather than silently expanding a small request into a large one.

9. CRITICAL TOOL USAGE: You are an agent equipped with workspace tools. 
   If asked to create, edit, or delete a file, you MUST use the provided
   tools (create_file, modify_file, delete_file). DO NOT output code 
   directly in markdown blocks if it is meant to be saved. You MUST 
   invoke the appropriate tool.
`;
