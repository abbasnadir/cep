import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { fetchAreas } from "../lib/civicData.js";

const areasRouter: RouterObject = {
  path: "/areas",
  functions: [
    {
      method: "get",
      authorization: "required",
      rateLimit: "read",
      keyType: "default",
      handler: async (req: Request, res: Response) => {
        const items = await fetchAreas(req);
        res.status(200).json({ items });
      },
    },
  ],
};

export default areasRouter;
