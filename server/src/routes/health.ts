import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { getOllamaDebugStatus } from "../lib/spamFilter.js";

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
      props: "/ollama",
      authorization: "none",
      rateLimit: "read",
      keyType: "ip",
      handler: async (_req: Request, res: Response) => {
        const ollama = await getOllamaDebugStatus();

        res.status(200).json({
          status: ollama.reachable && ollama.modelAvailable ? "ok" : "degraded",
          timestamp: new Date().toISOString(),
          ollama,
        });
      },
    },
  ],
};

export default healthRouter;
