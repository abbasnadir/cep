import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import { getComplaintAssistantReply } from "../lib/chatAssistant.js";

const assistantRouter: RouterObject = {
  path: "/assistant",
  functions: [
    {
      method: "post",
      props: "/chat",
      authorization: "required",
      rateLimit: "gameplay",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const reply = await getComplaintAssistantReply(req.body);
        res.status(200).json(reply);
      },
    },
  ],
};

export default assistantRouter;
