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

type OllamaGenerateResponse = {
  response?: string;
  thinking?: string;
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

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

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function debugLog(message: string, details?: Record<string, unknown>) {
  if (!ENV.OLLAMA_DEBUG) {
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(
    `[ollama-spam-filter] ${timestamp} ${message}`,
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

async function requestSpamVerdict(input: SpamFilterInput): Promise<SpamVerdict> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.OLLAMA_TIMEOUT_MS);
  const startedAt = Date.now();
  const requestId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    debugLog("Sending classification request", {
      requestId,
      model: ENV.OLLAMA_MODEL,
      baseUrl: ENV.OLLAMA_BASE_URL,
      timeoutMs: ENV.OLLAMA_TIMEOUT_MS,
      numPredict: ENV.OLLAMA_NUM_PREDICT,
      numCtx: ENV.OLLAMA_NUM_CTX,
      keepAlive: ENV.OLLAMA_KEEP_ALIVE,
      descriptionLength: input.description.length,
    });

    const response = await fetch(`${ENV.OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ENV.OLLAMA_MODEL,
        prompt: buildPrompt(input),
        stream: false,
        think: false,
        keep_alive: ENV.OLLAMA_KEEP_ALIVE,
        options: {
          temperature: 0,
          num_predict: ENV.OLLAMA_NUM_PREDICT,
          num_ctx: ENV.OLLAMA_NUM_CTX,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      debugLog("Ollama responded with non-OK status", {
        requestId,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        `Backend spam filtering is unavailable right now because Ollama responded with status ${response.status}.`,
      );
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    const verdict = parseVerdict(payload.response ?? "");

    if (!verdict) {
      debugLog("Ollama returned an invalid verdict", {
        requestId,
        rawResponse: payload.response ?? "",
        normalizedResponse: normalizeVerdictText(payload.response ?? ""),
        rawThinking: payload.thinking ?? "",
        done: payload.done ?? null,
        doneReason: payload.done_reason ?? null,
        promptEvalCount: payload.prompt_eval_count ?? null,
        promptEvalDurationNs: payload.prompt_eval_duration ?? null,
        evalCount: payload.eval_count ?? null,
        evalDurationNs: payload.eval_duration ?? null,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        "Backend spam filtering is unavailable right now because Ollama returned an invalid label.",
      );
    }

    debugLog("Ollama classification completed", {
      requestId,
      verdict,
      durationMs: Date.now() - startedAt,
      totalDurationNs: payload.total_duration ?? null,
      loadDurationNs: payload.load_duration ?? null,
      promptEvalCount: payload.prompt_eval_count ?? null,
      promptEvalDurationNs: payload.prompt_eval_duration ?? null,
      evalCount: payload.eval_count ?? null,
      evalDurationNs: payload.eval_duration ?? null,
      doneReason: payload.done_reason ?? null,
    });

    return verdict;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    if (isAbortError(error)) {
      debugLog("Ollama request timed out", {
        requestId,
        durationMs: Date.now() - startedAt,
      });

      throw new ServiceUnavailableError(
        "Backend spam filtering timed out while waiting for Ollama. Please try again.",
      );
    }

    debugLog("Ollama request failed before completion", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw new ServiceUnavailableError(
      "Backend spam filtering could not reach Ollama. Please make sure Ollama is running and try again.",
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

export async function getOllamaDebugStatus() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();

  try {
    debugLog("Checking Ollama health endpoint", {
      baseUrl: ENV.OLLAMA_BASE_URL,
      model: ENV.OLLAMA_MODEL,
    });

    const response = await fetch(`${ENV.OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        reachable: false,
        configuredModel: ENV.OLLAMA_MODEL,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        modelAvailable: false,
        models: [] as string[],
      };
    }

    const payload = (await response.json()) as OllamaTagsResponse;
    const models = (payload.models ?? []).flatMap((model) =>
      [model.name, model.model].filter((value): value is string => Boolean(value)),
    );
    const modelAvailable = models.some((modelName) =>
      modelName === ENV.OLLAMA_MODEL || modelName.startsWith(`${ENV.OLLAMA_MODEL}:`),
    );

    debugLog("Ollama health check completed", {
      durationMs: Date.now() - startedAt,
      modelAvailable,
      modelCount: models.length,
    });

    return {
      reachable: true,
      configuredModel: ENV.OLLAMA_MODEL,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      modelAvailable,
      models,
    };
  } catch (error) {
    debugLog("Ollama health check failed", {
      durationMs: Date.now() - startedAt,
      error: isAbortError(error)
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return {
      reachable: false,
      configuredModel: ENV.OLLAMA_MODEL,
      statusCode: null as number | null,
      durationMs: Date.now() - startedAt,
      modelAvailable: false,
      models: [] as string[],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
