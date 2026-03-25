/* GET home page. */
const indexRouter = {
    path: "/",
    functions: [
        {
            method: "get",
            authorization: "none",
            rateLimit: "strict",
            keyType: "default",
            handler: (_req, res) => {
                res.status(200).json({ message: "Works!" });
            },
        },
    ],
};
export default indexRouter;
//# sourceMappingURL=index.js.map