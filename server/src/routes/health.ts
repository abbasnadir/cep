import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";

const healthRouter: RouterObject = {
  path: "/health",
  functions: [
    {
      method: "get",
      authorization: "none",
      rateLimit: "read",
      keyType: "ip",
      handler: (_req: Request, res: Response) => {
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
