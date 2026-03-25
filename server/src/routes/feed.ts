import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { fetchFeed } from "../lib/civicData.js";

const feedRouter: RouterObject = {
  path: "/feed",
  functions: [
    {
      method: "get",
      authorization: "required",
      rateLimit: "read",
      keyType: "default",
      handler: async (req: Request, res: Response) => {
        const feed = await fetchFeed(req);
        res.status(200).json(feed);
      },
    },
  ],
};

export default feedRouter;
