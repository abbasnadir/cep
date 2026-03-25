import { jwtVerify, createRemoteJWKSet } from "jose";
import { UnauthorizedError } from "../errors/httpErrors.js";
import { ENV } from "./env.js";
// Use JWKS to dynamically get JWT key
const PROJECT_JWKS = createRemoteJWKSet(new URL(`${ENV.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
export default async function verifyJwt(token) {
    const { payload } = await jwtVerify(token, PROJECT_JWKS);
    if (typeof payload.sub != "string") {
        throw new UnauthorizedError();
    }
    return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
    };
}
//# sourceMappingURL=verifyJwt.js.map