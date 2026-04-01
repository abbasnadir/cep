"use client";

import Link from "next/link";

import { formatTimeAgo } from "@/lib/format";
import type { PostCard } from "@/lib/types";

const statusTone: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  acknowledged: "bg-sky-100 text-sky-900",
  in_progress: "bg-emerald-100 text-emerald-900",
  resolved: "bg-slate-200 text-slate-800",
  rejected: "bg-rose-100 text-rose-900",
};

const severityTone: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-rose-100 text-rose-900",
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
  const visibleDescription = post.description.trim() || post.descriptionExcerpt;
  const leadImage = post.media.find((item) => item.mediaType === "image");

  return (
    <article className="social-card overflow-hidden rounded-[20px] border border-white/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="social-avatar shrink-0">{getAliasInitial(post.authorAlias)}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-white">{post.authorAlias}</span>
              <span className="text-slate-500">in</span>
              <span>{post.area.name}</span>
              <span className="text-slate-500">.</span>
              <span>{formatTimeAgo(post.createdAt)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="tag bg-cyan-100 text-cyan-900">{post.categoryLabel}</span>
              <span
                className={`tag ${statusTone[post.workflowStatus] ?? "bg-slate-100 text-slate-900"}`}
              >
                {post.workflowStatus.replace("_", " ")}
              </span>
              <span
                className={`tag ${severityTone[severity] ?? "bg-slate-100 text-slate-900"}`}
              >
                {severity}
              </span>
            </div>

            <Link href={`/posts/${post.id}`} className="block">
              <h2 className="mt-3 max-w-3xl text-xl font-semibold tracking-[-0.02em] text-white transition hover:text-cyan-100">
                {post.descriptionExcerpt}
              </h2>
            </Link>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{visibleDescription}</p>

            {leadImage && (
              <Link href={`/posts/${post.id}`} className="mt-4 block max-w-3xl">
                <img
                  src={leadImage.url}
                  alt={`Attached image for ${post.categoryLabel}`}
                  className="h-56 w-full rounded-[16px] border border-white/10 object-cover"
                  loading="lazy"
                />
              </Link>
            )}

            {post.aiAssessment?.summary && (
              <div className="mt-4 rounded-[14px] border border-cyan-400/15 bg-cyan-400/8 px-4 py-3 text-sm leading-7 text-cyan-50">
                {post.aiAssessment.summary}
              </div>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 rounded-[14px] border border-white/10 bg-white/5 px-4 py-3 text-right lg:block">
          <p className="label-text">Priority</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {Math.round(post.priorityScore)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="social-metric">
          <p className="label-text">Raises</p>
          <p className="mt-1 text-lg font-semibold text-white">{post.raiseCount}</p>
        </div>
        <div className="social-metric">
          <p className="label-text">Comments</p>
          <p className="mt-1 text-lg font-semibold text-white">{post.commentCount}</p>
        </div>
        <div className="social-metric">
          <p className="label-text">Followers</p>
          <p className="mt-1 text-lg font-semibold text-white">{post.followerCount}</p>
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
          <span className="rounded-[10px] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
            Sign in to participate
          </span>
        )}
      </div>
    </article>
  );
}
