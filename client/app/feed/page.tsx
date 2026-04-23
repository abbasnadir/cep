"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PostCardView } from "@/components/post-card";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import type { FeedResponse, FollowResponse, PostCard } from "@/lib/types";

const sortOptions = [
  { value: "ranked", label: "For you" },
  { value: "newest", label: "Newest" },
  { value: "most_raised", label: "Most raised" },
  { value: "most_commented", label: "Most discussed" },
] as const;

const statusOptions = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
] as const;

function pickTrendingCategory(posts: PostCard[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    counts.set(post.categoryLabel, (counts.get(post.categoryLabel) ?? 0) + 1);
  }

  let winner = "Civic issues";
  let maxCount = 0;

  for (const [label, count] of counts.entries()) {
    if (count > maxCount) {
      winner = label;
      maxCount = count;
    }
  }

  return winner;
}

export default function FeedPage() {
  const { session } = useAuth();
  const [feed, setFeed] = useState<PostCard[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("ranked");
  const [status, setStatus] = useState("all");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followBusyPostId, setFollowBusyPostId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let ignore = false;

    async function loadFeed() {
      setLoadingFeed(true);
      setError(null);

      try {
        const response = await apiFetch<FeedResponse>(
          `/feed?limit=20&sort=${sort}`,
          {
            accessToken: session?.access_token,
          },
        );

        if (!ignore) {
          setFeed(response.items);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the feed right now.",
          );
        }
      } finally {
        if (!ignore) {
          setLoadingFeed(false);
        }
      }
    }

    loadFeed();

    return () => {
      ignore = true;
    };
  }, [session?.access_token, sort]);

  const filteredFeed = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return feed.filter((post) => {
      const matchesSearch =
        !query ||
        post.description.toLowerCase().includes(query) ||
        post.categoryLabel.toLowerCase().includes(query) ||
        post.area.name.toLowerCase().includes(query);

      const matchesStatus = status === "all" || post.workflowStatus === status;

      return matchesSearch && matchesStatus;
    });
  }, [deferredSearch, feed, status]);

  const feedStats = useMemo(() => {
    const openCount = filteredFeed.filter(
      (post) => post.workflowStatus === "open",
    ).length;
    const raiseTotal = filteredFeed.reduce(
      (sum, post) => sum + post.raiseCount,
      0,
    );
    const commentTotal = filteredFeed.reduce(
      (sum, post) => sum + post.commentCount,
      0,
    );

    return {
      openCount,
      raiseTotal,
      commentTotal,
      trendingCategory: pickTrendingCategory(filteredFeed),
    };
  }, [filteredFeed]);

  async function handleToggleFollow(postId: string) {
    if (!session?.access_token) {
      setError("Sign in to follow issues.");
      return;
    }

    setFollowBusyPostId(postId);
    setError(null);

    try {
      const response = await apiFetch<FollowResponse>(
        `/posts/${postId}/follows`,
        {
          method: "POST",
          accessToken: session.access_token,
        },
      );

      setFeed((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                isFollowing: response.following,
                followerCount: response.followerCount,
              }
            : post,
        ),
      );
    } catch (followError) {
      setError(
        followError instanceof Error
          ? followError.message
          : "Unable to follow this issue.",
      );
    } finally {
      setFollowBusyPostId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="social-hero overflow-hidden rounded-[22px] border border-white/10 p-6 md:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="label-text">Public civic stream</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              See local issues clearly and act when you need to.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Browse current reports, search by place or issue type, and open
              any thread for more detail. The public can read freely. Accounts
              unlock posting, following, comments, and reports.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={session ? "/posts/new" : "/register"}
                className="button-primary"
              >
                {session ? "Create post" : "Create an account"}
              </Link>
              <Link href="/institution" className="button-secondary">
                Institution dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-muted rounded-[16px] border border-white/10 p-4">
              <p className="label-text">Open issues</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {feedStats.openCount}
              </p>
            </div>
            <div className="surface-muted rounded-[16px] border border-white/10 p-4">
              <p className="label-text">Most common category</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {feedStats.trendingCategory}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!session && (
        <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
          You are browsing in guest mode. Reading is open to everyone, but
          posting and other interactions require an account.
        </div>
      )}

      {error && !loadingFeed && (
        <div className="rounded-[16px] border border-rose-500/40 bg-rose-200/85 p-4 text-sm text-black">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <div className="surface rounded-[20px] border border-white/10 p-5">
            <p className="label-text">Filter feed</p>
            <input
              className="field mt-4"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search issues, places, or categories"
            />

            <div className="mt-5">
              <p className="label-text">Sort by</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="pill-button"
                    data-active={sort === option.value}
                    onClick={() => setSort(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="label-text">Issue status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="pill-button"
                    data-active={status === option.value}
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[14px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
              Use search when you know the place or issue type. Use the status
              filters for a faster scan of open or resolved items.
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="surface rounded-[20px] border border-white/10 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <p className="label-text">Open</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {feedStats.openCount}
                </p>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <p className="label-text">Raises</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {feedStats.raiseTotal}
                </p>
              </div>
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <p className="label-text">Comments</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {feedStats.commentTotal}
                </p>
              </div>
            </div>
          </div>

          {loadingFeed ? (
            <StateBlock
              title="Loading feed"
              description="Pulling the public issue stream."
            />
          ) : error && !filteredFeed.length ? (
            <StateBlock
              title="Feed unavailable"
              description={error}
              actionLabel="Reload"
              actionHref="/"
            />
          ) : filteredFeed.length ? (
            filteredFeed.map((post) => (
              <PostCardView
                key={post.id}
                post={post}
                readOnly={!session}
                followBusy={followBusyPostId === post.id}
                onToggleFollow={handleToggleFollow}
              />
            ))
          ) : (
            <StateBlock
              title="No posts match these filters"
              description="Try a broader search, change the lane, or switch status filters."
              actionLabel={session ? "Create post" : "Join now"}
              actionHref={session ? "/posts/new" : "/register"}
            />
          )}
        </div>
      </div>
    </section>
  );
}
