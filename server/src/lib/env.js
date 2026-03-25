function requireServerEnv(value, name) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function requireServerUrl(value, name) {
    const resolved = requireServerEnv(value, name);
    try {
        return new URL(resolved).toString().replace(/\/+$/, "");
    }
    catch {
        throw new Error(`Environment variable ${name} must be a valid absolute URL`);
    }
}
function requirePort(value, fallback = 5000) {
    if (!value)
        return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Environment variable PORT must be a positive integer");
    }
    return parsed;
}
function requireNodeEnv(value) {
    const resolved = value ?? "development";
    if (!["development", "production", "test"].includes(resolved)) {
        throw new Error("Environment variable NODE_ENV must be one of: development, production, test");
    }
    return resolved;
}
const NODE_ENV = requireNodeEnv(process.env.NODE_ENV);
export const ENV = {
    NODE_ENV,
    PORT: requirePort(process.env.PORT),
    PROD_URL: NODE_ENV === "production"
        ? requireServerUrl(process.env.PROD_URL, "PROD_URL")
        : process.env.PROD_URL
            ? requireServerUrl(process.env.PROD_URL, "PROD_URL")
            : "http://localhost:3000",
    SUPABASE_URL: requireServerUrl(process.env.SUPABASE_URL, "SUPABASE_URL"),
    SUPABASE_SERVICE_KEY: requireServerEnv(process.env.SUPABASE_SERVICE_KEY, "SUPABASE_SERVICE_KEY"),
};
//# sourceMappingURL=env.js.map