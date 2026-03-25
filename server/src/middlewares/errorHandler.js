import { AppError } from "../errors/AppError.js";
import { ENV } from "../lib/env.js";
const isDev = ENV.NODE_ENV === "development";
// Error Handler middleware
export const errorHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    // Unknown / untrusted error
    if (!(err instanceof AppError)) {
        console.error("Unhandled Error:", err);
        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Something went wrong",
            },
        });
    }
    // Developer logging in development environment
    if (isDev) {
        console.error(`Error Code: ${err.code}\n` +
            `Message: ${err.message}\n` +
            `Stack:\n${err.stack}`);
    }
    // Trusted AppError
    return res.status(err.statusCode ?? 500).json({
        error: {
            code: err.code,
            message: err.message,
        },
    });
};
//# sourceMappingURL=errorHandler.js.map