"use client";

import Link from "next/link";

import { formatTimeAgo } from "@/lib/format";
import type { PostCard } from "@/lib/types";

const statusTone: Record<string, string> = {
  open: "bg-amber-400/15 text-amber-200",
  acknowledged: "bg-sky-400/15 text-sky-200",
  in_progress: "bg-emerald-400/15 text-emerald-200",
  resolved: "bg-slate-200/10 text-slate-200",
  rejected: "bg-rose-400/15 text-rose-200",
};

const severityTone: Record<string, string> = {
  low: "bg-emerald-400/15 text-emerald-200",
  medium: "bg-yellow-400/15 text-yellow-200",
  high: "bg-orange-400/15 text-orange-200",
  critical: "bg-rose-400/15 text-rose-200",
};

function getAliasInitial(alias: string) {
  const trimmed = alias.trim();
  return trimmed ? trimmed[0]?.toUpperCase() ?? "C" : "C";
}

type PostCardViewProps = {
  post: PostCard;
  readOnly?: boolean;
  followBusy?: boolean;
  onToggleFollow?: (postId: string) => void;
};

export function PostCardView({
  post,
  readOnly = false,
  followBusy = false,
  onToggleFollow,
}: PostCardViewProps) {
  const severity = post.aiAssessment?.severity ?? "pending";
  const followLabel = post.isFollowing ? "Following" : "Follow issue";

  return (
    <article className="social-card overflow-hidden rounded-[30px] border border-white/10 p-5">
      <div className="flex items-start justify-between gap-4">
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
              <span className="tag bg-cyan-400/15 text-cyan-200">{post.categoryLabel}</span>
              <span
                className={`tag ${statusTone[post.workflowStatus] ?? "bg-white/10 text-white"}`}
              >
                {post.workflowStatus.replace("_", " ")}
              </span>
              <span
                className={`tag ${severityTone[severity] ?? "bg-white/10 text-slate-200"}`}
              >
                {severity}
              </span>
            </div>

            <Link href={`/posts/${post.id}`} className="block">
              <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-[-0.03em] text-white transition hover:text-cyan-100">
                {post.descriptionExcerpt}
              </h2>
            </Link>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{post.description}</p>

            {post.aiAssessment?.summary && (
              <div className="mt-4 rounded-[22px] border border-cyan-400/15 bg-cyan-400/8 px-4 py-3 text-sm leading-7 text-cyan-50">
                {post.aiAssessment.summary}
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-right lg:block">
          <p className="label-text">Priority</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {Math.round(post.priorityScore)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="social-metric">
          <p className="label-text">Raises</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.raiseCount}</p>
          <p className="mt-1 text-xs text-slate-400">Community momentum</p>
        </div>
        <div className="social-metric">
          <p className="label-text">Comments</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.commentCount}</p>
          <p className="mt-1 text-xs text-slate-400">Updates and witnesses</p>
        </div>
        <div className="social-metric">
          <p className="label-text">Followers</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.followerCount}</p>
          <p className="mt-1 text-xs text-slate-400">Watching this issue</p>
        </div>
        <div className="social-metric">
          <p className="label-text">AI status</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.enrichmentStatus}</p>
          <p className="mt-1 text-xs text-slate-400">Responder context</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/posts/${post.id}`} className="interaction-pill">
          Open thread
        </Link>
        {readOnly ? (
          <Link href="/login" className="interaction-pill">
            Sign in to share context
          </Link>
        ) : (
          <Link href={`/posts/${post.id}?shareContext=1#comment-composer`} className="interaction-pill">
            Share context
          </Link>
        )}
        {readOnly ? (
          <Link href="/login" className="interaction-pill">
            Sign in to follow
          </Link>
        ) : (
          <button
            type="button"
            className="interaction-pill"
            disabled={followBusy}
            onClick={() => onToggleFollow?.(post.id)}
          >
            {followBusy ? "Updating..." : `${followLabel} (${post.followerCount})`}
          </button>
        )}
        {readOnly && (
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
            Read only until sign in
          </span>
        )}
      </div>
    </article>
  );
}
