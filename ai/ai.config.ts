import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";

const FREE_MODELS_ROUTER = "openrouter/free";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type AIProvider = "openrouter" | "groq";

export function parseAIProvider(value = process.env.AI_PROVIDER): AIProvider | undefined {
  const provider = value?.trim().toLowerCase();

  if (!provider || provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";
  return undefined;
}

export function getAIProvider(): AIProvider {
  const provider = parseAIProvider();
  if (!provider) {
    throw new Error("AI_PROVIDER must be 'openrouter' or 'groq'.");
  }
  return provider;
}

export function getConfiguredModel(provider: AIProvider): string {
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

export function getAgentModel() {
  const providerName = getAIProvider();
  const modelId = getConfiguredModel(providerName);

  if (providerName === "groq") {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const provider = createOpenAICompatible({
      name: "groq",
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
      includeUsage: true,
    });
    return wrapLanguageModel({
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
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const modelError = getModelValidationError(providerName, modelId);
  if (modelError) throw new Error(modelError);

  const provider = createOpenRouter({ apiKey });
  return provider(modelId);
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
`;
