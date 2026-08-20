import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
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

async function checkAPI() {
  console.log("Checking NVIDIA NIM API directly...");
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const modelName = process.env.NVIDIA_DEFAULT_MODEL?.trim() || "meta/llama-3.1-70b-instruct";
  
  console.log("API Key found:", !!apiKey);
  console.log("Model:", modelName);

  const provider = createOpenAICompatible({
    name: "nvidia",
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
  
  try {
    const model = provider(modelName);
    console.log("Sending test prompt to model...");
    const result = await generateText({
      model,
      prompt: "Reply with the word 'SUCCESS' if you can read this.",
    });
    console.log("Response:", result.text);
    console.log("NVIDIA API is working perfectly!");
  } catch (err: any) {
    console.error("Failed to connect to Nvidia NIM!");
    console.error("Error Message:", err.message || err);
    if (err.data) {
       console.error("Details:", JSON.stringify(err.data, null, 2));
    }
  }
}

checkAPI();
