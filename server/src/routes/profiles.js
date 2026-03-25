import { createProfile, mapProfileResponse } from "../lib/civicData.js";
const profilesRouter = {
    path: "/profiles",
    functions: [
        {
            method: "post",
            props: "/register",
            authorization: "required",
            rateLimit: "strict",
            keyType: "user",
            handler: async (req, res) => {
                const profile = await createProfile(req.user.id, req.body);
                res.status(201).json(mapProfileResponse(profile, req.user).profile);
            },
        },
    ],
};
export default profilesRouter;
//# sourceMappingURL=profiles.js.map