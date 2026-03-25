const healthRouter = {
    path: "/health",
    functions: [
        {
            method: "get",
            authorization: "none",
            rateLimit: "read",
            keyType: "ip",
            handler: (_req, res) => {
                res.status(200).json({
                    status: "ok",
                    timestamp: new Date().toISOString(),
                    services: {
                        api: "ok",
                        database: "ok",
                        worker: "degraded",
                    },
                });
            },
        },
    ],
};
export default healthRouter;
//# sourceMappingURL=health.js.map