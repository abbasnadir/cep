import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { fetchCategories } from "../lib/civicData.js";

const categoriesRouter: RouterObject = {
  path: "/categories",
  functions: [
    {
      method: "get",
      authorization: "required",
      rateLimit: "read",
      keyType: "default",
      handler: async (_req: Request, res: Response) => {
        const items = await fetchCategories();
        res.status(200).json({ items });
      },
    },
  ],
};

export default categoriesRouter;
