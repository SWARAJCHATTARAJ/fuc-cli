function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function getHeader(headers: unknown, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;

  const record = asRecord(headers);
  const value = record?.[name] ?? record?.[name.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

function formatResetTime(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return value;

  const milliseconds = timestamp > 100_000_000_000 ? timestamp : timestamp * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function providerLabel(): string {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (provider === "groq") return "Groq";
  if (provider === "openrouter" || !provider) return "OpenRouter";
  return "AI provider";
}

export function getAIErrorMessage(error: unknown): string | undefined {
  const record = asRecord(error);
  if (!record) return undefined;

  const statusCode = record.statusCode;
  if (typeof statusCode !== "number") return undefined;

  const message = typeof record.message === "string" ? record.message : "Request failed.";
  const provider = providerLabel();

  if (statusCode === 429) {
    const reset = formatResetTime(
      getHeader(record.responseHeaders, "x-ratelimit-reset") ??
        getHeader(record.responseHeaders, "x-ratelimit-reset-requests") ??
        getHeader(record.responseHeaders, "retry-after"),
    );
    return `${provider} quota is exhausted.${reset ? ` Try again after ${reset}.` : " Try again later or use another provider/model."}`;
  }

  if (statusCode === 401 || statusCode === 403) {
    return `${provider} rejected the API key. Check the provider selection and API key in .env.`;
  }

  return `${provider} rejected the request (HTTP ${statusCode}): ${message}`;
}
