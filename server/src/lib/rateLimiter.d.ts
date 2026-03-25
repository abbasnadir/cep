type keyType = "ip" | "user" | "default";
declare class RateLimiter {
    private limits;
    limit(policy: keyof typeof this.limits, keyType: keyType): import("express-rate-limit").RateLimitRequestHandler;
}
export declare const rateLimiter: RateLimiter;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map