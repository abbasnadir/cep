import { fetchCategories } from "../lib/civicData.js";
const categoriesRouter = {
    path: "/categories",
    functions: [
        {
            method: "get",
            authorization: "required",
            rateLimit: "read",
            keyType: "default",
            handler: async (_req, res) => {
                const items = await fetchCategories();
                res.status(200).json({ items });
            },
        },
    ],
};
export default categoriesRouter;
//# sourceMappingURL=categories.js.map