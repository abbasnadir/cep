import { ENV } from "./env.js";
import {
  ServiceUnavailableError,
  UnprocessableEntityError,
} from "../errors/httpErrors.js";

type SpamVerdict = "SPAM" | "NOT_SPAM";

type SpamFilterInput = {
  description: string;
  locationMode: "auto_detected" | "manual" | "none";
  locationLabel: string;
  categoryHint?: string;
};

type GroqChatCompletionResponse = {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

type GroqMessageContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>
  | undefined;

function buildPrompt(input: SpamFilterInput) {
  return [
    "Classify the civic post below.",
    "Return NOT_SPAM only if it is a real complaint, grievance, or issue affecting a person, group, community, institution, or country.",
    "Return SPAM for ads, promotions, scams, irrelevant chatter, nonsense, or anything not describing a real issue.",
    "If unsure, return SPAM.",
    "Reply with exactly one label: SPAM or NOT_SPAM. RETURN ONLY ONE WORD.",
    `Category: ${input.categoryHint ?? "unknown"}`,
    `Location mode: ${input.locationMode}`,
    `Location: ${input.locationLabel || "none"}`,
    `Text: ${input.description}`,
  ].join("\n");
}

function buildSystemPrompt() {
  return [
    "You classify civic issue posts for spam prevention.",
    "Return NOT_SPAM only if the text describes a real complaint, grievance, or issue affecting a person, group, community, institution, or country.",
    "Return SPAM for ads, promotions, scams, irrelevant chatter, nonsense, roleplay, tests, or anything not describing a real issue.",
    "If you are unsure, return SPAM.",
    "Reply with exactly one label: SPAM or NOT_SPAM.",
  ].join(" ");
}

type GroqModelsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
  }>;
};

type GroqErrorResponse = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function debugLog(message: string, details?: Record<string, unknown>) {
  if (!ENV.GROQ_DEBUG) {
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(
    `[groq-spam-filter] ${timestamp} ${message}`,
    details ? JSON.stringify(details) : "",
  );
}

function normalizeVerdictText(rawOutput: string) {
  return rawOutput
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/[`"'{}[\]():,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function parseVerdict(rawOutput: string): SpamVerdict | null {
  const normalized = normalizeVerdictText(rawOutput);

  if (
    normalized.includes("NOT_SPAM") ||
    normalized.includes("NOT-SPAM") ||
    normalized.includes("NOT SPAM") ||
    normalized.includes("NOTSPAM")
  ) {
    return "NOT_SPAM";
  }

  if (normalized.includes("SPAM")) {
    return "SPAM";
  }

  return null;
}

function extractMessageContent(
  content: GroqMessageContent,
) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type?: string; text?: string } => Boolean(part))
      .map((part) => part.text ?? "")
      .join(" ")
      .trim();
  }

  return "";
}

async function readProviderError(response: Response) {
  try {
    const payload = (await response.json()) as GroqErrorResponse;
    return {
      message: payload.error?.message ?? null,
      type: payload.error?.type ?? null,
      code: payload.error?.code ?? null,
    };
  } catch {
    return {
      message: null,
      type: null,
      code: null,
    };
  }
}

async function requestSpamVerdict(input: SpamFilterInput): Promise<SpamVerdict> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.GROQ_TIMEOUT_MS);
  const startedAt = Date.now();
  const requestId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    debugLog("Sending classification request", {
      requestId,
      model: ENV.GROQ_MODEL,
      baseUrl: ENV.GROQ_BASE_URL,
      timeoutMs: ENV.GROQ_TIMEOUT_MS,
      maxTokens: ENV.GROQ_MAX_TOKENS,
      descriptionLength: input.description.length,
    });

    const response = await fetch(`${ENV.GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ENV.GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildPrompt(input),
          },
        ],
        stream: false,
        temperature: 0,
        max_completion_tokens: ENV.GROQ_MAX_TOKENS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerError = await readProviderError(response);

      debugLog("Groq responded with non-OK status", {
        requestId,
        status: response.status,
        providerError,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        providerError.message
          ? `Backend spam filtering is unavailable right now because Groq returned ${response.status}: ${providerError.message}`
          : `Backend spam filtering is unavailable right now because Groq responded with status ${response.status}.`,
      );
    }

    const payload = (await response.json()) as GroqChatCompletionResponse;
    const rawResponse = extractMessageContent(payload.choices?.[0]?.message?.content);
    const verdict = parseVerdict(rawResponse);

    if (!verdict) {
      debugLog("Groq returned an invalid verdict", {
        requestId,
        rawResponse,
        normalizedResponse: normalizeVerdictText(rawResponse),
        model: payload.model ?? null,
        finishReason: payload.choices?.[0]?.finish_reason ?? null,
        usage: payload.usage ?? null,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        "Backend spam filtering is unavailable right now because Groq returned an invalid label.",
      );
    }

    debugLog("Groq classification completed", {
      requestId,
      verdict,
      model: payload.model ?? null,
      durationMs: Date.now() - startedAt,
      finishReason: payload.choices?.[0]?.finish_reason ?? null,
      usage: payload.usage ?? null,
    });

    return verdict;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    if (isAbortError(error)) {
      debugLog("Groq request timed out", {
        requestId,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        "Backend spam filtering timed out while waiting for Groq. Please try again.",
      );
    }

    debugLog("Groq request failed before completion", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new ServiceUnavailableError(
      "Backend spam filtering could not reach Groq. Please verify Groq configuration and try again.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function assertPostIsNotSpam(input: SpamFilterInput) {
  const verdict = await requestSpamVerdict(input);

  if (verdict === "SPAM") {
    throw new UnprocessableEntityError(
      "This post was rejected by the backend spam filter. Only legitimate complaint or issue reports can be published.",
      "POST_REJECTED_AS_SPAM",
    );
  }
}

export async function getGroqDebugStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();

  try {
    debugLog("Checking Groq models endpoint", {
      baseUrl: ENV.GROQ_BASE_URL,
      model: ENV.GROQ_MODEL,
    });

    const response = await fetch(`${ENV.GROQ_BASE_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.GROQ_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        reachable: false,
        configuredModel: ENV.GROQ_MODEL,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        modelAvailable: false,
        availableModelCount: 0,
        matchedModels: [] as string[],
      };
    }

    const payload = (await response.json()) as GroqModelsResponse;
    const modelIds = (payload.data ?? []).flatMap((model) =>
      [model.id].filter((value): value is string => Boolean(value)),
    );
    const matchedModels = [...new Set(modelIds)].filter(
      (modelId) => modelId === ENV.GROQ_MODEL,
    );
    const modelAvailable = matchedModels.length > 0;

    debugLog("Groq health check completed", {
      durationMs: Date.now() - startedAt,
      modelAvailable,
      modelCount: modelIds.length,
    });

    return {
      reachable: true,
      configuredModel: ENV.GROQ_MODEL,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      modelAvailable,
      availableModelCount: modelIds.length,
      matchedModels,
    };
  } catch (error) {
    debugLog("Groq health check failed", {
      durationMs: Date.now() - startedAt,
      error: isAbortError(error)
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return {
      reachable: false,
      configuredModel: ENV.GROQ_MODEL,
      statusCode: null as number | null,
      durationMs: Date.now() - startedAt,
      modelAvailable: false,
      availableModelCount: 0,
      matchedModels: [] as string[],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
