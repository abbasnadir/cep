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

export function PostCardView({ post }: { post: PostCard }) {
  const severity = post.aiAssessment?.severity ?? "pending";

  return (
    <Link
      href={`/posts/${post.id}`}
      className="surface block rounded-[28px] border border-white/10 p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="tag bg-cyan-400/15 text-cyan-200">{post.categoryLabel}</span>
            <span className={`tag ${statusTone[post.workflowStatus] ?? "bg-white/10 text-white"}`}>
              {post.workflowStatus.replace("_", " ")}
            </span>
            <span className={`tag ${severityTone[severity] ?? "bg-white/10 text-slate-200"}`}>
              {severity}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
            {post.descriptionExcerpt}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">{post.description}</p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-right">
          <p className="label-text">Priority</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {Math.round(post.priorityScore)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>{post.authorAlias}</span>
        <span>/</span>
        <span>{post.area.name}</span>
        <span>/</span>
        <span>{formatTimeAgo(post.createdAt)}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="label-text">Raises</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.raiseCount}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="label-text">Comments</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.commentCount}</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <p className="label-text">Enrichment</p>
          <p className="mt-2 text-xl font-semibold text-white">{post.enrichmentStatus}</p>
        </div>
      </div>
    </Link>
  );
}
