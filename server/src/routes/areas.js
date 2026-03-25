import { fetchAreas } from "../lib/civicData.js";
const areasRouter = {
    path: "/areas",
    functions: [
        {
            method: "get",
            authorization: "required",
            rateLimit: "read",
            keyType: "default",
            handler: async (req, res) => {
                const items = await fetchAreas(req);
                res.status(200).json({ items });
            },
        },
    ],
};
export default areasRouter;
//# sourceMappingURL=areas.js.map