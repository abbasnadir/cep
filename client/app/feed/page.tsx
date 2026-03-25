"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PostCardView } from "@/components/post-card";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import type { FeedResponse, PostCard } from "@/lib/types";

export default function FeedPage() {
  const { session, loading } = useAuth();
  const [feed, setFeed] = useState<PostCard[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("ranked");
  const [status, setStatus] = useState("all");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!session?.access_token) {
      setLoadingFeed(false);
      return;
    }

    const activeSession = session;
    let ignore = false;

    async function loadFeed() {
      const accessToken = activeSession.access_token;
      setLoadingFeed(true);
      setError(null);

      try {
        const response = await apiFetch<FeedResponse>(
          `/feed?limit=20&sort=${sort}`,
          { accessToken },
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
        if (!ignore) setLoadingFeed(false);
      }
    }

    loadFeed();

    return () => {
      ignore = true;
    };
  }, [session, sort]);

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

  if (loading) {
    return <StateBlock title="Loading session" description="Checking your account." />;
  }

  if (!session) {
    return (
      <StateBlock
        title="Sign in to view the feed"
        description="The ranked issue feed is available to authenticated users so raises, comments, and locality preferences can be tied to a real session."
        actionLabel="Go to login"
        actionHref="/login"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="surface rounded-[32px] border border-white/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-text">Citizen feed</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
              Ranked civic issues
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Explore nearby issues, filter by status, and open any post for comments,
              raises, and reporting.
            </p>
          </div>
          <Link href="/posts/new" className="button-primary">
            Create post
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <input
            className="field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by issue, area, or category"
          />
          <select
            className="select-field"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="ranked">Ranked priority</option>
            <option value="newest">Newest first</option>
            <option value="most_raised">Most raised</option>
            <option value="most_commented">Most commented</option>
          </select>
          <select
            className="select-field"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {loadingFeed ? (
        <StateBlock title="Loading feed" description="Fetching ranked posts from the backend." />
      ) : error ? (
        <StateBlock
          title="Feed unavailable"
          description={error}
          actionLabel="Reload"
          actionHref="/feed"
        />
      ) : filteredFeed.length ? (
        <div className="space-y-4">
          {filteredFeed.map((post) => (
            <PostCardView key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <StateBlock
          title="No posts yet"
          description="There are no issues matching the current filters. Try a broader search or publish the first report."
          actionLabel="Create post"
          actionHref="/posts/new"
        />
      )}
    </section>
  );
}
