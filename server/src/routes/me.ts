import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { fetchProfileById, mapProfileResponse } from "../lib/civicData.js";

const meRouter: RouterObject = {
  path: "/me",
  functions: [
    {
      method: "get",
      authorization: "required",
      rateLimit: "strict",
      keyType: "default",
      handler: async (req: Request, res: Response) => {
        const profile = await fetchProfileById(req.user.id);

        if (!profile) {
          res.status(200).json({
            user: {
              id: req.user.id,
              email: req.user.email ?? null,
              role: req.user.role ?? "citizen",
              onboardingComplete: false,
            },
            profile: {
              id: req.user.id,
              role: req.user.role ?? "citizen",
              publicAlias:
                req.user.email?.split("@")[0] ?? "anonymous-user",
              anonymousByDefault: true,
              preferredLanguage: "en",
              onboardingComplete: false,
            },
          });
          return;
        }

        res.status(200).json(mapProfileResponse(profile, req.user));
      },
    },
  ],
};

export default meRouter;
