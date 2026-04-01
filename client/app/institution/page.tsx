"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PostCardView } from "@/components/post-card";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import type { SummaryOverview } from "@/lib/types";

export default function InstitutionPage() {
  const { session, me, loading } = useAuth();
  const [summary, setSummary] = useState<SummaryOverview | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!session?.access_token || !me) {
      setLoadingPage(false);
      return;
    }

    const activeSession = session;
    let ignore = false;

    async function loadDashboard() {
      const accessToken = activeSession.access_token;
      setLoadingPage(true);
      setPageError(null);

      try {
        const summaryResponse = await apiFetch<SummaryOverview>(
          "/institution/summaries/overview",
          {
            accessToken,
          },
        );

        if (!ignore) {
          setSummary(summaryResponse);
        }
      } catch (dashboardError) {
        if (!ignore) {
          setPageError(
            dashboardError instanceof Error
              ? dashboardError.message
              : "Unable to load the institution dashboard.",
          );
        }
      } finally {
        if (!ignore) setLoadingPage(false);
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [me, session]);

  if (loading) {
    return <StateBlock title="Loading session" description="Checking your account." />;
  }

  if (!session) {
    return (
      <StateBlock
        title="Sign in to open the dashboard"
        description="Institution summaries are available only to authenticated responder accounts."
        actionLabel="Go to login"
        actionHref="/login"
      />
    );
  }

  if (!me || (me.profile.role !== "ngo_staff" && me.profile.role !== "government_staff" && me.profile.role !== "admin")) {
    return (
      <StateBlock
        title="Institution access only"
        description="Your current role does not have access to the responder dashboard."
        actionLabel="Back to feed"
        actionHref="/feed"
      />
    );
  }

  if (loadingPage) {
    return <StateBlock title="Loading dashboard" description="Fetching summaries and priority issues." />;
  }

  if (pageError || !summary) {
    return (
      <StateBlock
        title="Dashboard unavailable"
        description={pageError ?? "The institution dashboard could not be loaded."}
        actionLabel="Back to feed"
        actionHref="/feed"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="surface rounded-[32px] border border-white/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-text">Institution dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
              Operational summary
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Monitor issue load, severity distribution, and the most urgent posts that need triage.
            </p>
          </div>
          <Link href="/feed" className="button-secondary">
            View public feed
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Total posts</p>
            <p className="mt-3 text-3xl font-semibold text-white">{summary.totals.totalPosts}</p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Unresolved</p>
            <p className="mt-3 text-3xl font-semibold text-white">{summary.totals.unresolvedPosts}</p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">High priority</p>
            <p className="mt-3 text-3xl font-semibold text-white">{summary.totals.highPriorityPosts}</p>
          </div>
          <div className="surface-muted rounded-[24px] border border-white/10 p-5">
            <p className="label-text">Resolved</p>
            <p className="mt-3 text-3xl font-semibold text-white">{summary.totals.resolvedPosts}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="surface rounded-[32px] border border-white/10 p-6">
          <p className="label-text">Severity breakdown</p>
          <div className="mt-5 space-y-4">
            {summary.bySeverity.map((item) => (
              <div key={item.severity}>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span className="capitalize">{item.severity}</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-cyan-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (item.count / Math.max(summary.totals.totalPosts, 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {summary.topIssues?.length ? (
            summary.topIssues.map((post) => <PostCardView key={post.id} post={post} />)
          ) : (
            <StateBlock
              title="No priority posts"
              description="There are no posts available for the dashboard right now."
            />
          )}
        </div>
      </div>
    </section>
  );
}
