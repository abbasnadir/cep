import type { Request, Response } from "express";
import type { RouterObject } from "../../types/router.js";
import {
  assertUuid,
  fetchInstitutionPostDetail,
  fetchSummary,
  requireInstitutionProfile,
  updateInstitutionPost,
} from "../lib/civicData.js";

const institutionRouter: RouterObject = {
  path: "/institution",
  functions: [
    {
      method: "get",
      props: "/posts/:postId",
      authorization: "required",
      rateLimit: "read",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const profile = await requireInstitutionProfile(req.user.id);
        const postId = assertUuid(req.params.postId, "postId");
        const post = await fetchInstitutionPostDetail(postId, profile);
        res.status(200).json(post);
      },
    },
    {
      method: "patch",
      props: "/posts/:postId",
      authorization: "required",
      rateLimit: "gameplay",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const profile = await requireInstitutionProfile(req.user.id);
        const postId = assertUuid(req.params.postId, "postId");
        const post = await updateInstitutionPost(req.user.id, postId, req.body, profile);
        res.status(200).json(post);
      },
    },
    {
      method: "get",
      props: "/summaries/overview",
      authorization: "required",
      rateLimit: "read",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const profile = await requireInstitutionProfile(req.user.id);
        const summary = await fetchSummary(req, undefined, profile);
        res.status(200).json(summary);
      },
    },
    {
      method: "get",
      props: "/summaries/areas/:areaId",
      authorization: "required",
      rateLimit: "read",
      keyType: "user",
      handler: async (req: Request, res: Response) => {
        const profile = await requireInstitutionProfile(req.user.id);
        const areaId = assertUuid(req.params.areaId, "areaId");
        const summary = await fetchSummary(req, areaId, profile);
        res.status(200).json(summary);
      },
    },
  ],
};

export default institutionRouter;
