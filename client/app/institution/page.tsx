"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { PostCardView } from "@/components/post-card";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import type {
  InstitutionAccess,
  InstitutionPostUpdateRequest,
  PostCard,
  SummaryOverview,
} from "@/lib/types";

const caseStatusActions = [
  { value: "triage", label: "Mark triage" },
  { value: "responding", label: "Mark responding" },
  { value: "closed", label: "Close case" },
] as const;

const workflowLabels: Record<string, string> = {
  open: "Reopen",
  acknowledged: "Acknowledge",
  in_progress: "Start work",
  resolved: "Resolve",
  rejected: "Reject",
};

const reportActions = [
  { value: "dismissed", label: "Dismiss reports" },
  { value: "actioned", label: "Action reports" },
  { value: "escalated", label: "Escalate" },
] as const;

function InstitutionIssueActions({
  access,
  accessToken,
  onUpdated,
  post,
}: {
  access: InstitutionAccess;
  accessToken: string;
  onUpdated: () => Promise<void>;
  post: PostCard;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const workflowActions = access.canUpdateWorkflowStatus
    ? access.allowedWorkflowStatuses.filter((status) => status !== post.workflowStatus)
    : [];

  const canShowActions =
    access.canUpdateCaseStatus ||
    workflowActions.length > 0 ||
    (access.canReviewReports && post.reportCount > 0);

  async function runAction(key: string, payload: InstitutionPostUpdateRequest) {
    setBusyKey(key);
    setActionError(null);

    try {
      await apiFetch(`/institution/posts/${post.id}`, {
        method: "PATCH",
        accessToken,
        body: JSON.stringify(payload),
      });
      await onUpdated();
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this institution case.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (!canShowActions) return null;

  return (
    <div className="surface-muted rounded-[24px] border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-700">
        <span>{access.role.replace("_", " ")}</span>
        <span className="text-slate-500">/</span>
        <span>{access.scope} scope</span>
      </div>

      {access.canUpdateCaseStatus && (
        <div className="mt-4">
          <p className="label-text">Case actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {caseStatusActions.map((action) => (
              <button
                key={action.value}
                type="button"
                className="pill-button"
                disabled={busyKey !== null}
                onClick={() =>
                  runAction(`case-${action.value}`, {
                    caseStatus: action.value,
                  })
                }
              >
                {busyKey === `case-${action.value}` ? "Updating..." : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {workflowActions.length > 0 && (
        <div className="mt-4">
          <p className="label-text">Public workflow</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {workflowActions.map((status) => (
              <button
                key={status}
                type="button"
                className="pill-button"
                disabled={busyKey !== null}
                onClick={() =>
                  runAction(`workflow-${status}`, {
                    workflowStatus: status,
                    changeReason: `institution_${status}`,
                  })
                }
              >
                {busyKey === `workflow-${status}`
                  ? "Updating..."
                  : workflowLabels[status] ?? status.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {access.canReviewReports && post.reportCount > 0 && (
        <div className="mt-4">
          <p className="label-text">Moderation</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reportActions.map((action) => (
              <button
                key={action.value}
                type="button"
                className="pill-button"
                disabled={busyKey !== null}
                onClick={() =>
                  runAction(`report-${action.value}`, {
                    reportReviewStatus: action.value,
                    changeReason: `report_${action.value}`,
                  })
                }
              >
                {busyKey === `report-${action.value}` ? "Updating..." : action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {actionError}
        </div>
      )}
    </div>
  );
}

export default function InstitutionPage() {
  const { session, me, loading } = useAuth();
  const [summary, setSummary] = useState<SummaryOverview | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!session?.access_token || !me) {
      setSummary(null);
      setLoadingPage(false);
      return;
    }

    setLoadingPage(true);
    setPageError(null);

    try {
      const summaryResponse = await apiFetch<SummaryOverview>("/institution/summaries/overview", {
        accessToken: session.access_token,
      });
      setSummary(summaryResponse);
    } catch (dashboardError) {
      setPageError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Unable to load the institution dashboard.",
      );
    } finally {
      setLoadingPage(false);
    }
  }, [me, session?.access_token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const access = useMemo(
    () => summary?.access ?? me?.profile.institutionAccess ?? null,
    [me?.profile.institutionAccess, summary?.access],
  );

  const capabilityLabels = useMemo(() => {
    if (!access) return [];

    return [
      "Dashboard access with exact coordinates",
      access.canUpdateCaseStatus ? "Case tracking updates" : null,
      access.canUpdateWorkflowStatus ? "Public workflow control" : null,
      access.canReviewReports ? "Report review and moderation queue" : null,
      access.canAssignOrganization ? "Organization reassignment" : null,
    ].filter((value): value is string => Boolean(value));
  }, [access]);

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

  if (
    !me ||
    (me.profile.role !== "ngo_staff" &&
      me.profile.role !== "government_staff" &&
      me.profile.role !== "admin")
  ) {
    return (
      <StateBlock
        title="Institution access only"
        description="Your current role does not have access to the responder dashboard."
        actionLabel="Back to feed"
        actionHref="/"
      />
    );
  }

  if (loadingPage) {
    return <StateBlock title="Loading dashboard" description="Fetching summaries and priority issues." />;
  }

  if (pageError || !summary || !access) {
    return (
      <StateBlock
        title="Dashboard unavailable"
        description={pageError ?? "The institution dashboard could not be loaded."}
        actionLabel="Back to feed"
        actionHref="/"
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
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              {access.role === "ngo_staff"
                ? "NGO responders can monitor exact-location issue detail and maintain case progress for their organization."
                : access.role === "government_staff"
                  ? "Government responders can triage cases and move public workflow states from acknowledgement through resolution."
                  : "Admins have global moderation visibility, reported-post review access, and full workflow control."}
            </p>
          </div>
          <Link href="/" className="button-secondary">
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

      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-6">
          <div className="surface rounded-[32px] border border-white/10 p-6">
            <p className="label-text">Role access</p>
            <div className="mt-4 rounded-[24px] border border-cyan-200 bg-cyan-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-950">
                {access.role.replace("_", " ")} / {access.scope} scope
              </p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                {capabilityLabels.map((capability) => (
                  <p key={capability}>{capability}</p>
                ))}
              </div>
            </div>
          </div>

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
        </div>

        <div className="space-y-4">
          <div className="surface rounded-[32px] border border-white/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label-text">Priority queue</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  The highest-priority active issues for this responder role.
                </p>
              </div>
            </div>
          </div>

          {summary.topIssues?.length ? (
            summary.topIssues.map((post) => (
              <div key={post.id} className="space-y-3">
                <PostCardView post={post} />
                <InstitutionIssueActions
                  access={access}
                  accessToken={session.access_token}
                  onUpdated={loadDashboard}
                  post={post}
                />
              </div>
            ))
          ) : (
            <StateBlock
              title="No priority posts"
              description="There are no posts available for the dashboard right now."
            />
          )}
        </div>
      </div>

      {access.canViewReportedQueue && (
        <section className="space-y-4">
          <div className="surface rounded-[32px] border border-white/10 p-6">
            <p className="label-text">Admin moderation queue</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Pending abuse reports are surfaced here for admins so they can review, dismiss,
              or action reported content without losing the main operational dashboard.
            </p>
          </div>

          {summary.reportedPosts?.length ? (
            summary.reportedPosts.map((post) => (
              <div key={`reported-${post.id}`} className="space-y-3">
                <PostCardView post={post} />
                <InstitutionIssueActions
                  access={access}
                  accessToken={session.access_token}
                  onUpdated={loadDashboard}
                  post={post}
                />
              </div>
            ))
          ) : (
            <StateBlock
              title="No pending reported posts"
              description="The admin moderation queue is currently clear."
            />
          )}
        </section>
      )}
    </section>
  );
}
