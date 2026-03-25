function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),

  NEXT_PUBLIC_SUPABASE_ANONKEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANONKEY"),
};
