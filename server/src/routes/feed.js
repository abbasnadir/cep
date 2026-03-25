import { fetchFeed } from "../lib/civicData.js";
const feedRouter = {
    path: "/feed",
    functions: [
        {
            method: "get",
            authorization: "required",
            rateLimit: "read",
            keyType: "default",
            handler: async (req, res) => {
                const feed = await fetchFeed(req);
                res.status(200).json(feed);
            },
        },
    ],
};
export default feedRouter;
//# sourceMappingURL=feed.js.map