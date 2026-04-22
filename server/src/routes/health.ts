import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { getGroqDebugStatus } from "../lib/spamFilter.js";

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
    {
      method: "get",
      props: "/groq",
      authorization: "none",
      rateLimit: "read",
      keyType: "ip",
      handler: async (_req: Request, res: Response) => {
        const groq = await getGroqDebugStatus();

        res.status(200).json({
          status: groq.reachable && groq.modelAvailable ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          groq,
        });
      },
    },
  ],
};

export default healthRouter;
