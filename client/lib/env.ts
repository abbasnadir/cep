function requireClientEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireUrl(value: string | undefined, name: string): string {
  const resolved = requireClientEnv(value, name);

  try {
    return new URL(resolved).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`Environment variable ${name} must be a valid absolute URL`);
  }
}

export const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: requireUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  ),
  NEXT_PUBLIC_SUPABASE_ANONKEY: requireClientEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANONKEY,
    "NEXT_PUBLIC_SUPABASE_ANONKEY",
  ),
  NEXT_PUBLIC_API_BASE_URL: requireUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    "NEXT_PUBLIC_API_BASE_URL",
  ),
  NEXT_PUBLIC_SITE_URL: requireUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    "NEXT_PUBLIC_SITE_URL",
  ),
} as const;
