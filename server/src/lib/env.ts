function requireServerEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireServerUrl(value: string | undefined, name: string): string {
  const resolved = requireServerEnv(value, name);

  try {
    return new URL(resolved).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`Environment variable ${name} must be a valid absolute URL`);
  }
}

function requirePort(value: string | undefined, fallback = 5000): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Environment variable PORT must be a positive integer");
  }

  return parsed;
}

function requirePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

function requireBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(
    "Boolean environment variables must be one of: true, false, 1, 0, yes, no, on, off",
  );
}

function requireNodeEnv(value: string | undefined): "development" | "production" | "test" {
  const resolved = value ?? "development";

  if (!["development", "production", "test"].includes(resolved)) {
    throw new Error(
      "Environment variable NODE_ENV must be one of: development, production, test",
    );
  }

  return resolved as "development" | "production" | "test";
}

const NODE_ENV = requireNodeEnv(process.env.NODE_ENV);

export const ENV = {
  NODE_ENV,
  PORT: requirePort(process.env.PORT),
  PROD_URL:
    NODE_ENV === "production"
      ? requireServerUrl(process.env.PROD_URL, "PROD_URL")
      : process.env.PROD_URL
        ? requireServerUrl(process.env.PROD_URL, "PROD_URL")
        : "http://localhost:3000",
  SUPABASE_URL: requireServerUrl(process.env.SUPABASE_URL, "SUPABASE_URL"),
  SUPABASE_SERVICE_KEY: requireServerEnv(
    process.env.SUPABASE_SERVICE_KEY,
    "SUPABASE_SERVICE_KEY",
  ),
  GROQ_BASE_URL: process.env.GROQ_BASE_URL
    ? requireServerUrl(process.env.GROQ_BASE_URL, "GROQ_BASE_URL")
    : "https://api.groq.com/openai/v1",
  GROQ_KEY: requireServerEnv(process.env.GROQ_KEY, "GROQ_KEY"),
  GROQ_MODEL: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
  GROQ_TIMEOUT_MS: requirePositiveInteger(
    process.env.GROQ_TIMEOUT_MS,
    120000,
    "GROQ_TIMEOUT_MS",
  ),
  GROQ_CHAT_MODEL:
    process.env.GROQ_CHAT_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "llama-3.3-70b-versatile",
  GROQ_CHAT_MAX_TOKENS: requirePositiveInteger(
    process.env.GROQ_CHAT_MAX_TOKENS,
    500,
    "GROQ_CHAT_MAX_TOKENS",
  ),
  GROQ_MAX_TOKENS: requirePositiveInteger(
    process.env.GROQ_MAX_TOKENS,
    4,
    "GROQ_MAX_TOKENS",
  ),
  GROQ_DEBUG: requireBoolean(process.env.GROQ_DEBUG, true),
} as const;
