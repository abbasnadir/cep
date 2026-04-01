"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import { formatTimeAgo } from "@/lib/format";
import type {
  Comment,
  CommentListResponse,
  FollowResponse,
  PostDetail,
  RaiseResponse,
  ReportCreateRequest,
} from "@/lib/types";

function getAliasInitial(alias: string) {
  const trimmed = alias.trim();
  return trimmed ? trimmed[0]?.toUpperCase() ?? "C" : "C";
}

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [reportReason, setReportReason] = useState<ReportCreateRequest["reasonCode"]>("spam");
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!params.postId) {
      setLoadingPost(false);
      return;
    }

    let ignore = false;

    async function loadDetail() {
      setLoadingPost(true);
      setError(null);

      try {
        const [postResponse, commentResponse] = await Promise.all([
          apiFetch<PostDetail>(`/posts/${params.postId}`, {
            accessToken: session?.access_token,
          }),
          apiFetch<CommentListResponse>(`/posts/${params.postId}/comments`, {
            accessToken: session?.access_token,
          }),
        ]);

        if (!ignore) {
          setPost(postResponse);
          setComments(commentResponse.items);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load this post.",
          );
        }
      } finally {
        if (!ignore) {
          setLoadingPost(false);
        }
      }
    }

    loadDetail();

    return () => {
      ignore = true;
    };
  }, [params.postId, session?.access_token]);

  useEffect(() => {
    if (
      !session ||
      !post ||
      searchParams.get("shareContext") !== "1" ||
      !commentInputRef.current
    ) {
      return;
    }

    commentInputRef.current.focus();
    commentInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [post, searchParams, session]);

  async function handleRaise() {
    if (!session?.access_token || !params.postId || !post) {
      setError("Sign in to raise this issue.");
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch<RaiseResponse>(`/posts/${params.postId}/raises`, {
        method: "POST",
        accessToken: session.access_token,
      });

      setPost({
        ...post,
        raiseCount: response.raiseCount,
      });
    } catch (raiseError) {
      setReportNotice(null);
      setError(
        raiseError instanceof Error ? raiseError.message : "Unable to raise this issue.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFollow() {
    if (!session?.access_token || !params.postId || !post) {
      setError("Sign in to follow this issue.");
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch<FollowResponse>(`/posts/${params.postId}/follows`, {
        method: "POST",
        accessToken: session.access_token,
      });

      setPost({
        ...post,
        isFollowing: response.following,
        followerCount: response.followerCount,
      });
    } catch (followError) {
      setReportNotice(null);
      setError(
        followError instanceof Error ? followError.message : "Unable to follow this issue.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token || !params.postId) {
      setError("Sign in to comment on this post.");
      return;
    }

    if (!commentBody.trim()) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch<Comment>(`/posts/${params.postId}/comments`, {
        method: "POST",
        accessToken: session.access_token,
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
      setReportNotice(null);
      setError(
        commentError instanceof Error ? commentError.message : "Unable to add the comment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitReport(payload: ReportCreateRequest, successMessage: string) {
    if (!session?.access_token || !params.postId) {
      setError("Sign in to report this post.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch<unknown>(`/posts/${params.postId}/reports`, {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify(payload),
      });
      setError(null);
      setReportNotice(successMessage);
    } catch (reportError) {
      setReportNotice(null);
      setError(
        reportError instanceof Error ? reportError.message : "Unable to submit the report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    await submitReport({ reasonCode: reportReason }, "Post report submitted.");
  }

  async function handleReportImage() {
    await submitReport(
      {
        reasonCode: "abuse",
        notes: "inappropriate_image",
      },
      "Image report submitted for review.",
    );
  }

  if (loadingPost) {
    return <StateBlock title="Loading post" description="Fetching thread details and comments." />;
  }

  if (error && !post) {
    return (
      <StateBlock
        title="Post unavailable"
        description={error}
        actionLabel="Back to feed"
        actionHref="/"
      />
    );
  }

  if (!post) {
    return (
      <StateBlock
        title="Post not found"
        description="This issue could not be loaded."
        actionLabel="Back to feed"
        actionHref="/"
      />
    );
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        {!session && (
          <div className="rounded-[26px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            You are viewing this thread as a guest. Reading is open, but raising,
            commenting, and reporting require sign-in.
          </div>
        )}

        {error && post && (
          <div className="rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {reportNotice && post && (
          <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-900">
            {reportNotice}
          </div>
        )}

        <div className="social-card rounded-[34px] border border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="social-avatar shrink-0">{getAliasInitial(post.authorAlias)}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <span className="font-semibold text-white">{post.authorAlias}</span>
                  <span className="text-slate-600">/</span>
                  <span>{post.area.name}</span>
                  <span className="text-slate-600">/</span>
                  <span>{formatTimeAgo(post.createdAt)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="tag bg-cyan-100 text-cyan-900">{post.categoryLabel}</span>
                  <span className="tag bg-slate-100 text-slate-900">
                    {post.workflowStatus.replace("_", " ")}
                  </span>
                  <span className="tag bg-slate-100 text-slate-900">{post.area.name}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-right">
              <p className="label-text">Priority</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {Math.round(post.priorityScore)}
              </p>
            </div>
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-white">
            {post.descriptionExcerpt}
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-200">{post.description}</p>

          {post.media.length > 0 && (
            <div className="mt-6">
              <p className="label-text">Images</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {post.media
                  .filter((media) => media.mediaType === "image")
                  .map((media) => (
                    <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={media.url}
                        alt={`Attached image for ${post.categoryLabel}`}
                        className="h-64 w-full rounded-[18px] border border-white/10 object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
              </div>
            </div>
          )}

          {post.aiAssessment?.summary && (
            <div className="mt-6 rounded-[24px] border border-cyan-400/20 bg-cyan-400/8 p-4">
              <p className="label-text">AI summary</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{post.aiAssessment.summary}</p>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="social-metric">
              <p className="label-text">Raises</p>
              <p className="mt-2 text-xl font-semibold text-white">{post.raiseCount}</p>
            </div>
            <div className="social-metric">
              <p className="label-text">Comments</p>
              <p className="mt-2 text-xl font-semibold text-white">{post.commentCount}</p>
            </div>
            <div className="social-metric">
              <p className="label-text">Followers</p>
              <p className="mt-2 text-xl font-semibold text-white">{post.followerCount}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={handleRaise} disabled={busy || !session} className="button-primary">
              {session ? `Raise issue (${post.raiseCount})` : "Sign in to raise"}
            </button>
            <button type="button" onClick={handleFollow} disabled={busy || !session} className="button-secondary">
              {session
                ? `${post.isFollowing ? "Following" : "Follow issue"} (${post.followerCount})`
                : "Sign in to follow"}
            </button>
            <Link href="/" className="button-secondary">
              Back to feed
            </Link>
          </div>
        </div>

        <div className="surface rounded-[32px] border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-text">Comments</p>
            <p className="text-sm text-slate-400">{comments.length} responses in thread</p>
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleComment}>
            <textarea
              id="comment-composer"
              ref={commentInputRef}
              className="textarea-field"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={
                session
                  ? "Add context, eyewitness detail, or follow-up information."
                  : "Sign in to join this conversation."
              }
              disabled={!session}
            />
            <button type="submit" disabled={busy || !session} className="button-primary">
              {session ? "Post comment" : "Sign in to comment"}
            </button>
          </form>

          <div className="mt-6 space-y-4">
            {comments.length ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-[24px] border border-white/10 bg-white/4 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <span>{comment.authorAlias}</span>
                    <span>{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{comment.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-slate-400">
                No comments yet. This thread is ready for the first update.
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Thread actions</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Help keep the civic stream useful. Raise the issue to increase urgency,
            comment to add context, or report if the post breaks platform rules.
          </p>

          <label className="mt-5 block">
            <span className="label-text">Report reason</span>
            <select
              className="select-field mt-2"
              value={reportReason}
              onChange={(event) =>
                setReportReason(event.target.value as ReportCreateRequest["reasonCode"])
              }
              disabled={!session}
            >
              <option value="spam">Spam</option>
              <option value="abuse">Abuse</option>
              <option value="misinformation">Misinformation</option>
              <option value="duplicate">Duplicate</option>
              <option value="privacy">Privacy</option>
              <option value="other">Other</option>
            </select>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={handleReport} disabled={busy || !session} className="button-secondary">
              {session ? "Report post" : "Sign in to report"}
            </button>
            {post.media.some((media) => media.mediaType === "image") && (
              <button
                type="button"
                onClick={handleReportImage}
                disabled={busy || !session}
                className="button-secondary"
              >
                {session ? "Report image" : "Sign in to report image"}
              </button>
            )}
            {!session && (
              <Link href="/login" className="button-primary">
                Log in
              </Link>
            )}
          </div>
        </div>

        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Participation</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>Guests can browse threads and follow the public civic conversation.</p>
            <p>Signed-in users can post updates, comment, report abuse, and raise priority.</p>
            <p>Institutions can use the responder tools to triage what is surfacing fastest.</p>
          </div>
        </div>
      </aside>
    </section>
  );
}
