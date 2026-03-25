import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { createProfile, mapProfileResponse } from "../lib/civicData.js";

const profilesRouter: RouterObject = {
  path: "/profiles",
  functions: [
    {
      method: "post",
      props: "/register",
      authorization: "required",
      rateLimit: "strict",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const profile = await createProfile(req.user.id, req.body);
        res.status(201).json(mapProfileResponse(profile, req.user).profile);
      },
    },
  ],
};

export default profilesRouter;
