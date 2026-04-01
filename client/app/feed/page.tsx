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
        const response = await apiFetch<FeedResponse>(`/feed?limit=20&sort=${sort}`, {
          accessToken: session?.access_token,
        });

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
    const openCount = filteredFeed.filter((post) => post.workflowStatus === "open").length;
    const raiseTotal = filteredFeed.reduce((sum, post) => sum + post.raiseCount, 0);
    const commentTotal = filteredFeed.reduce((sum, post) => sum + post.commentCount, 0);

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
      const response = await apiFetch<FollowResponse>(`/posts/${postId}/follows`, {
        method: "POST",
        accessToken: session.access_token,
      });

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
        followError instanceof Error ? followError.message : "Unable to follow this issue.",
      );
    } finally {
      setFollowBusyPostId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="social-hero overflow-hidden rounded-[36px] border border-white/10 p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="label-text">Public civic stream</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white md:text-6xl">
              A live civic feed that feels active, local, and worth checking every day.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">
              Browse public issue threads, track what people are talking about, and see
              which local problems are gaining momentum. Guests can read everything.
              Signing in unlocks posting, raising, commenting, and reporting.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={session ? "/posts/new" : "/register"} className="button-primary">
                {session ? "Create a post" : "Join to participate"}
              </Link>
              <Link href="/institution" className="button-secondary">
                Responder view
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="surface-muted rounded-[28px] border border-white/10 p-5">
              <p className="label-text">Trending now</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {feedStats.trendingCategory}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                The current stream is clustering most around this issue area.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="surface-muted rounded-[24px] border border-white/10 p-4">
                <p className="label-text">Open</p>
                <p className="mt-2 text-2xl font-semibold text-white">{feedStats.openCount}</p>
              </div>
              <div className="surface-muted rounded-[24px] border border-white/10 p-4">
                <p className="label-text">Raises</p>
                <p className="mt-2 text-2xl font-semibold text-white">{feedStats.raiseTotal}</p>
              </div>
              <div className="surface-muted rounded-[24px] border border-white/10 p-4">
                <p className="label-text">Comments</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {feedStats.commentTotal}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!session && (
        <div className="rounded-[26px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
          You are browsing in guest mode. You can view the full public feed and open posts,
          but raising, commenting, reporting, and posting require an account.
        </div>
      )}

      {error && !loadingFeed && (
        <div className="rounded-[24px] border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <div className="surface rounded-[30px] border border-white/10 p-5">
            <p className="label-text">Explore</p>
            <input
              className="field mt-4"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search issues, places, or categories"
            />

            <div className="mt-5">
              <p className="label-text">Feed lane</p>
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
              <p className="label-text">Status</p>
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
          </div>

          <div className="surface rounded-[30px] border border-white/10 p-5">
            <p className="label-text">Pulse notes</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
              <p>The stream is designed to feel like a living social timeline, not a static archive.</p>
              <p>Open any thread to read updates and community context.</p>
              <p>Signed-in users can move issues upward by posting, commenting, and raising.</p>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {loadingFeed ? (
            <StateBlock title="Loading feed" description="Pulling the public issue stream." />
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

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <div className="surface rounded-[30px] border border-white/10 p-5">
            <p className="label-text">Join the conversation</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Guests can read the civic stream. Create an account to raise issues, add
              local context, and publish your own posts.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={session ? "/posts/new" : "/register"} className="button-primary">
                {session ? "Post now" : "Sign up"}
              </Link>
              {!session && (
                <Link href="/login" className="button-secondary">
                  Log in
                </Link>
              )}
            </div>
          </div>

          <div className="surface rounded-[30px] border border-white/10 p-5">
            <p className="label-text">Stream mix</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Local urgency</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Posts gain visibility through priority, engagement, and freshness.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Thread-style reading</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Every card is meant to feel openable, conversational, and alive.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Participation locked to accounts</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  The stream is public, but actions still stay tied to real identities.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
