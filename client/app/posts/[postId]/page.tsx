"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import { formatTimeAgo } from "@/lib/format";
import type {
  Comment,
  CommentListResponse,
  PostDetail,
  RaiseResponse,
  ReportCreateRequest,
} from "@/lib/types";

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const { session, loading } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [reportReason, setReportReason] = useState<ReportCreateRequest["reasonCode"]>("spam");
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !params.postId) {
      setLoadingPost(false);
      return;
    }

    const activeSession = session;
    let ignore = false;

    async function loadDetail() {
      const accessToken = activeSession.access_token;
      setLoadingPost(true);
      setError(null);

      try {
        const [postResponse, commentResponse] = await Promise.all([
          apiFetch<PostDetail>(`/posts/${params.postId}`, {
            accessToken,
          }),
          apiFetch<CommentListResponse>(`/posts/${params.postId}/comments`, {
            accessToken,
          }),
        ]);

        if (!ignore) {
          setPost(postResponse);
          setComments(commentResponse.items);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this post.",
          );
        }
      } finally {
        if (!ignore) setLoadingPost(false);
      }
    }

    loadDetail();

    return () => {
      ignore = true;
    };
  }, [params.postId, session]);

  async function handleRaise() {
    if (!session?.access_token || !params.postId || !post) return;

    setBusy(true);
    const accessToken = session.access_token;
    try {
      const response = await apiFetch<RaiseResponse>(`/posts/${params.postId}/raises`, {
        method: "POST",
        accessToken,
      });

      setPost({
        ...post,
        raiseCount: response.raiseCount,
      });
    } catch (raiseError) {
      setError(
        raiseError instanceof Error ? raiseError.message : "Unable to raise this issue.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !params.postId || !commentBody.trim()) return;

    setBusy(true);
    const accessToken = session.access_token;
    try {
      const response = await apiFetch<Comment>(`/posts/${params.postId}/comments`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({ body: commentBody.trim() }),
      });

      setComments((current) => [response, ...current]);
      setCommentBody("");
      setPost((current) =>
        current
          ? {
              ...current,
              commentCount: current.commentCount + 1,
            }
          : current,
      );
    } catch (commentError) {
      setError(
        commentError instanceof Error
          ? commentError.message
          : "Unable to add the comment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!session?.access_token || !params.postId) return;

    setBusy(true);
    const accessToken = session.access_token;
    try {
      await apiFetch<unknown>(`/posts/${params.postId}/reports`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({ reasonCode: reportReason }),
      });
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Unable to submit the report.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <StateBlock title="Loading session" description="Checking your account." />;
  }

  if (!session) {
    return (
      <StateBlock
        title="Sign in to open this post"
        description="Post details, comments, and raise actions require an authenticated session."
        actionLabel="Go to login"
        actionHref="/login"
      />
    );
  }

  if (loadingPost) {
    return <StateBlock title="Loading post" description="Fetching detail and comments." />;
  }

  if (error && !post) {
    return <StateBlock title="Post unavailable" description={error} actionLabel="Back to feed" actionHref="/feed" />;
  }

  if (!post) {
    return <StateBlock title="Post not found" description="This issue could not be loaded." actionLabel="Back to feed" actionHref="/feed" />;
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <div className="surface rounded-[32px] border border-white/10 p-6">
          <div className="flex flex-wrap gap-2">
            <span className="tag bg-cyan-400/15 text-cyan-200">{post.categoryLabel}</span>
            <span className="tag bg-white/8 text-slate-300">{post.workflowStatus.replace("_", " ")}</span>
            <span className="tag bg-white/8 text-slate-300">{post.area.name}</span>
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white">
            {post.descriptionExcerpt}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>{post.authorAlias}</span>
            <span>/</span>
            <span>{formatTimeAgo(post.createdAt)}</span>
            <span>/</span>
            <span>Priority {Math.round(post.priorityScore)}</span>
          </div>

          <p className="mt-6 text-base leading-8 text-slate-200">{post.description}</p>

          {post.aiAssessment?.summary && (
            <div className="mt-6 rounded-[24px] border border-cyan-400/20 bg-cyan-400/8 p-4">
              <p className="label-text">AI summary</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                {post.aiAssessment.summary}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={handleRaise} disabled={busy} className="button-primary">
              Raise issue ({post.raiseCount})
            </button>
            <Link href="/feed" className="button-secondary">
              Back to feed
            </Link>
          </div>
        </div>

        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Comments</p>
          <form className="mt-4 space-y-3" onSubmit={handleComment}>
            <textarea
              className="textarea-field"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Add context, eyewitness detail, or follow-up information."
            />
            <button type="submit" disabled={busy} className="button-primary">
              Post comment
            </button>
          </form>

          <div className="mt-6 space-y-4">
            {comments.length ? (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-[24px] border border-white/10 bg-white/4 p-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <span>{comment.authorAlias}</span>
                    <span>{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{comment.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-slate-400">
                No comments yet. Add the first one.
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Engagement</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="label-text">Raises</p>
              <p className="mt-3 text-3xl font-semibold text-white">{post.raiseCount}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="label-text">Comments</p>
              <p className="mt-3 text-3xl font-semibold text-white">{post.commentCount}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="label-text">Report content</p>
            <select
              className="select-field mt-3"
              value={reportReason}
              onChange={(event) =>
                setReportReason(event.target.value as ReportCreateRequest["reasonCode"])
              }
            >
              <option value="spam">Spam</option>
              <option value="abuse">Abuse</option>
              <option value="misinformation">Misinformation</option>
              <option value="duplicate">Duplicate</option>
              <option value="privacy">Privacy</option>
              <option value="other">Other</option>
            </select>
            <button type="button" onClick={handleReport} disabled={busy} className="button-secondary mt-4">
              Submit report
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
