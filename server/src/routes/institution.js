import { assertUuid, fetchInstitutionPostDetail, fetchSummary, requireInstitutionProfile, } from "../lib/civicData.js";
const institutionRouter = {
    path: "/institution",
    functions: [
        {
            method: "get",
            props: "/posts/:postId",
            authorization: "required",
            rateLimit: "read",
            keyType: "user",
            handler: async (req, res) => {
                await requireInstitutionProfile(req.user.id);
                const postId = assertUuid(req.params.postId, "postId");
                const post = await fetchInstitutionPostDetail(postId);
                res.status(200).json(post);
            },
        },
        {
            method: "get",
            props: "/summaries/overview",
            authorization: "required",
            rateLimit: "read",
            keyType: "user",
            handler: async (req, res) => {
                await requireInstitutionProfile(req.user.id);
                const summary = await fetchSummary(req);
                res.status(200).json(summary);
            },
        },
        {
            method: "get",
            props: "/summaries/areas/:areaId",
            authorization: "required",
            rateLimit: "read",
            keyType: "user",
            handler: async (req, res) => {
                await requireInstitutionProfile(req.user.id);
                const areaId = assertUuid(req.params.areaId, "areaId");
                const summary = await fetchSummary(req, areaId);
                res.status(200).json(summary);
            },
        },
    ],
};
export default institutionRouter;
//# sourceMappingURL=institution.js.map