import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const FREE_MODELS_ROUTER = "openrouter/free";

export function getAgentModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_DEFAULT_MODEL ?? FREE_MODELS_ROUTER;

  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  if (modelId !== FREE_MODELS_ROUTER && !modelId.endsWith(":free")) {
    throw new Error(
      "OPENROUTER_DEFAULT_MODEL must be 'openrouter/free' or a model ending in ':free'",
    );
  }

  const provider = createOpenRouter({ apiKey });
  return provider(modelId);
}
