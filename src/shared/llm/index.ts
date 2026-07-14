/**
 * Unified LLM client for JSON structured output.
 * Provider: KIE AI (Claude) or OpenAI-compatible chat completions.
 *
 * Set LLM_PROVIDER=kie + KIE_API_KEY, or OPENAI_API_KEY for OpenAI.
 */

import { kieChatJSON, kieChatJSONRetry, KIE_MODEL } from "./kie-claude";
import { fetchWithTimeout } from "../fetch-timeout";

export type LLMProvider = "kie" | "openai";

export type ChatJSONOptions = {
  temperature?: number;
  model?: string;
  maxTokens?: number;
  thinkingFlag?: boolean;
  /**
   * Override which provider handles this call. Falls back to the default
   * provider (llmProvider()) if the requested one isn't configured (e.g. no
   * OPENAI_API_KEY set). Use breederProvider() when breeding copy.
   */
  provider?: LLMProvider;
};

const OPENAI_API_URL = process.env.OPENAI_BASE_URL
  ? `${process.env.OPENAI_BASE_URL}/chat/completions`
  : "https://api.openai.com/v1/chat/completions";

export const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export function llmProvider(): LLMProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "kie" || explicit === "openai") return explicit;
  if (process.env.KIE_API_KEY) return "kie";
  return "openai";
}

export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === "kie") return Boolean(process.env.KIE_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export function isLlmConfigured(): boolean {
  return isProviderConfigured(llmProvider());
}

/** When KIE_API_KEY is set, all agents route through KIE regardless of per-agent overrides. */
function activeProvider(explicit?: LLMProvider): LLMProvider {
  if (process.env.KIE_API_KEY) return "kie";
  if (explicit && isProviderConfigured(explicit)) return explicit;
  return llmProvider();
}

/** Provider used to breed new page copy. */
export function breederProvider(): LLMProvider {
  return activeProvider(envProvider("LLM_BREEDER_PROVIDER"));
}

/** Provider used to write the generation analyst report. */
export function evaluatorProvider(): LLMProvider {
  return activeProvider(envProvider("LLM_EVALUATOR_PROVIDER"));
}

function envProvider(name: string): LLMProvider | undefined {
  const v = process.env[name]?.toLowerCase();
  return v === "kie" || v === "openai" ? v : undefined;
}

async function openaiChatJSON<T>(
  system: string,
  user: string,
  opts: ChatJSONOptions = {}
): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetchWithTimeout(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? LLM_MODEL,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty response");
  return JSON.parse(content) as T;
}

export async function chatJSON<T>(
  system: string,
  user: string,
  opts: ChatJSONOptions = {}
): Promise<T> {
  if (activeProvider(opts.provider) === "kie") {
    return kieChatJSON<T>(system, user, {
      model: opts.model ?? KIE_MODEL,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      thinkingFlag: opts.thinkingFlag,
    });
  }
  return openaiChatJSON<T>(system, user, opts);
}

/** Retry wrapper for transient failures / malformed JSON. */
export async function chatJSONRetry<T>(
  system: string,
  user: string,
  opts: ChatJSONOptions = {},
  attempts = 3
): Promise<T> {
  if (activeProvider(opts.provider) === "kie") {
    return kieChatJSONRetry<T>(
      system,
      user,
      {
        model: opts.model ?? KIE_MODEL,
        maxTokens: opts.maxTokens,
        temperature: opts.temperature,
        thinkingFlag: opts.thinkingFlag,
      },
      attempts
    );
  }

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await openaiChatJSON<T>(system, user, opts);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}
