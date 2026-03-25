import { assertUuid, createComment, createPost, createReport, fetchComments, fetchPostDetail, parsePagination, toggleRaise, } from "../lib/civicData.js";
const postsRouter = {
    path: "/posts",
    functions: [
        {
            method: "post",
            authorization: "required",
            rateLimit: "gameplay",
            keyType: "user",
            handler: async (req, res) => {
                const post = await createPost(req.user.id, req.body);
                res.status(201).json(post);
            },
        },
        {
            method: "get",
            props: "/:postId",
            authorization: "required",
            rateLimit: "read",
            keyType: "default",
            handler: async (req, res) => {
                const postId = assertUuid(req.params.postId, "postId");
                const post = await fetchPostDetail(postId);
                res.status(200).json(post);
            },
        },
        {
            method: "get",
            props: "/:postId/comments",
            authorization: "required",
            rateLimit: "read",
            keyType: "default",
            handler: async (req, res) => {
                const { page, limit } = parsePagination(req);
                const postId = assertUuid(req.params.postId, "postId");
                const comments = await fetchComments(postId, page, limit);
                res.status(200).json({ items: comments });
            },
        },
        {
            method: "post",
            props: "/:postId/comments",
            authorization: "required",
            rateLimit: "gameplay",
            keyType: "user",
            handler: async (req, res) => {
                const postId = assertUuid(req.params.postId, "postId");
                const comment = await createComment(req.user.id, postId, req.body);
                res.status(201).json(comment);
            },
        },
        {
            method: "post",
            props: "/:postId/raises",
            authorization: "required",
            rateLimit: "gameplay",
            keyType: "user",
            handler: async (req, res) => {
                const postId = assertUuid(req.params.postId, "postId");
                const result = await toggleRaise(req.user.id, postId);
                res.status(200).json(result);
            },
        },
        {
            method: "post",
            props: "/:postId/reports",
            authorization: "required",
            rateLimit: "strict",
            keyType: "user",
            handler: async (req, res) => {
                const postId = assertUuid(req.params.postId, "postId");
                const result = await createReport(req.user.id, postId, req.body);
                res.status(201).json(result);
            },
        },
    ],
};
export default postsRouter;
//# sourceMappingURL=posts.js.map