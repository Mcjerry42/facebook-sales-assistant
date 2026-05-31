import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Creates an AI provider based on settings from the database.
 * Supports: Lovable Gateway (default), OpenAI-compatible (DeepSeek, etc.), Google Gemini
 * Any API key + any base URL = works.
 */
export function createAiProvider(settings: {
  provider: string;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
}) {
  const { provider, api_key, base_url } = settings;

  // If user has their own API key, use OpenAI-compatible client
  if (api_key) {
    const effectiveBaseUrl = base_url || getDefaultBaseUrl(provider);
    return createOpenAICompatible({
      name: provider,
      baseURL: effectiveBaseUrl,
      headers: {
        Authorization: `Bearer ${api_key}`,
      },
    });
  }

  // Fallback to Lovable Gateway (requires LOVABLE_API_KEY env var)
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    throw new Error(
      "No API key configured in AI Settings, and no LOVABLE_API_KEY found in environment. " +
      "Please either: 1) Add your API key in AI Settings page, or 2) Set LOVABLE_API_KEY environment variable.",
    );
  }

  return createOpenAICompatible({
    name: "lovable",
    baseURL: base_url || "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "mistral":
      return "https://api.mistral.ai/v1";
    case "together":
      return "https://api.together.xyz/v1";
    default:
      // If unknown provider, default to OpenAI-compatible format
      return `https://api.${provider}.com/v1`;
  }
}