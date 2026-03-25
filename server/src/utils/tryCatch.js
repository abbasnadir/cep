// TryCatch block wrapper for clean code
export const tryCatch = (controller) => async (req, res, next) => {
    try {
        await controller(req, res, next);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=tryCatch.js.map