"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { PostCardView } from "@/components/post-card";
import { StateBlock } from "@/components/state-block";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type {
  Category,
  CategoryListResponse,
  InstitutionAccess,
  InstitutionPostUpdateRequest,
  PostCard,
  SummaryOverview,
} from "@/lib/types";

const roleSummary: Record<InstitutionAccess["role"], string> = {
  ngo_staff:
    "NGO teams manage operational case progress, organize field response, and mark reports as actively being worked on inside their organization scope.",
  government_staff:
    "Government teams handle operational triage and public workflow movement from acknowledgement to resolution.",
  admin:
    "Admins oversee global responder workload, moderation queues, reassignment, and cross-system workflow control.",
};

const roleActionHints: Record<InstitutionAccess["role"], string> = {
  ngo_staff: "NGO case updates stay operational. They do not change citizen-facing workflow state.",
  government_staff:
    "Government responders can move public workflow after triage and field validation.",
  admin: "Admins can act across case tracking, workflow, moderation, and organization ownership.",
};

const caseStatusActionsByRole: Record<
  InstitutionAccess["role"],
  Array<{
    value: "triage" | "investigating" | "responding" | "monitoring" | "closed";
    label: string;
  }>
> = {
  ngo_staff: [
    { value: "triage", label: "Queue for triage" },
    { value: "investigating", label: "Start assessment" },
    { value: "responding", label: "Mark being worked on" },
    { value: "monitoring", label: "Move to monitoring" },
    { value: "closed", label: "Close case" },
  ],
  government_staff: [
    { value: "triage", label: "Queue for triage" },
    { value: "investigating", label: "Investigate" },
    { value: "responding", label: "Dispatch work" },
    { value: "monitoring", label: "Monitor progress" },
    { value: "closed", label: "Close case" },
  ],
  admin: [
    { value: "triage", label: "Send to triage" },
    { value: "investigating", label: "Investigate" },
    { value: "responding", label: "Mark active" },
    { value: "monitoring", label: "Monitor" },
    { value: "closed", label: "Close case" },
  ],
};

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

const queueOptions = [
  { value: "active", label: "Active queue" },
  { value: "high_priority", label: "High priority" },
  { value: "all", label: "All reports" },
  { value: "reported", label: "Reported only" },
] as const;

const workflowOptions = [
  { value: "all", label: "All workflow states" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
] as const;

const severityOptions = [
  { value: "all", label: "All severity levels" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "unknown", label: "Unknown" },
] as const;

const sortOptions = [
  { value: "priority_desc", label: "Priority first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const;

type DashboardFilters = {
  queue: "all" | "active" | "high_priority" | "reported";
  status: string;
  severity: string;
  categoryId: string;
  q: string;
  sort: "priority_desc" | "newest" | "oldest";
};

function formatPercent(count: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function formatRole(role: string) {
  return role.replace("_", " ");
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MetricCard({
  tone = "blue",
  title,
  value,
  subtext,
}: {
  tone?: "blue" | "green" | "orange" | "rose";
  title: string;
  value: string | number;
  subtext: string;
}) {
  const toneClass =
    tone === "green"
      ? "from-emerald-500/18 to-emerald-400/8 border-emerald-200/30"
      : tone === "orange"
        ? "from-amber-500/18 to-orange-400/8 border-amber-200/30"
        : tone === "rose"
          ? "from-rose-500/18 to-rose-400/8 border-rose-200/30"
          : "from-cyan-500/20 to-blue-500/8 border-cyan-200/30";

  return (
    <div
      className={`rounded-[26px] border bg-gradient-to-br ${toneClass} p-5 shadow-[0_14px_40px_rgba(15,23,42,0.12)]`}
    >
      <p className="label-text text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{subtext}</p>
    </div>
  );
}

function DistributionCard({
  title,
  subtitle,
  items,
  total,
  colorClass,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; count: number }>;
  total: number;
  colorClass: string;
}) {
  return (
    <div className="surface rounded-[30px] border border-white/10 p-6">
      <p className="label-text">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-500">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
                <span className="capitalize">{item.label.replace("_", " ")}</span>
                <span>
                  {item.count} / {formatPercent(item.count, total)}
                </span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                <div
                  className={`h-2.5 rounded-full ${colorClass}`}
                  style={{ width: `${Math.max(6, Math.min(100, (item.count / Math.max(total, 1)) * 100))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-500">No data for selected range.</p>
        )}
      </div>
    </div>
  );
}

function TimelineCard({
  items,
}: {
  items: NonNullable<SummaryOverview["timeline"]>;
}) {
  const peak = Math.max(
    1,
    ...items.flatMap((item) => [item.totalPosts, item.highPriorityPosts]),
  );

  return (
    <div className="surface rounded-[30px] border border-white/10 p-6">
      <p className="label-text">Daily intake</p>
      <p className="mt-2 text-sm leading-7 text-slate-500">
        New reports versus high-priority arrivals across selected date range.
      </p>
      {items.length ? (
        <div className="mt-6 grid grid-cols-7 gap-3">
          {items.map((item) => (
            <div key={item.date} className="flex flex-col items-center gap-2">
              <div className="flex h-36 items-end gap-1">
                <div
                  className="w-3 rounded-full bg-slate-300"
                  style={{ height: `${Math.max(10, (item.totalPosts / peak) * 100)}%` }}
                  title={`${item.totalPosts} total`}
                />
                <div
                  className="w-3 rounded-full bg-cyan-500"
                  style={{ height: `${Math.max(10, (item.highPriorityPosts / peak) * 100)}%` }}
                  title={`${item.highPriorityPosts} high priority`}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {formatDateLabel(item.date)}
                </p>
                <p className="mt-1 text-xs text-slate-400">{item.totalPosts} reports</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-slate-500">No timeline data yet.</p>
      )}
    </div>
  );
}

function RoleAccessCard({
  access,
  capabilities,
}: {
  access: InstitutionAccess;
  capabilities: string[];
}) {
  return (
    <div className="surface rounded-[30px] border border-white/10 p-6">
      <p className="label-text">Role access</p>
      <div className="mt-4 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-800">
          {formatRole(access.role)} / {access.scope} scope
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-600">{roleSummary[access.role]}</p>
        <div className="mt-5 grid gap-3">
          {capabilities.map((capability) => (
            <div
              key={capability}
              className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            >
              {capability}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const caseActions = caseStatusActionsByRole[access.role];

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
    <div className="surface rounded-[24px] border border-white/10 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <span>{formatRole(access.role)}</span>
        <span>/</span>
        <span>{access.scope} scope</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">{roleActionHints[access.role]}</p>

      {access.canUpdateCaseStatus && (
        <div className="mt-5">
          <p className="label-text">Case handling</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {caseActions.map((action) => (
              <button
                key={action.value}
                type="button"
                className="pill-button"
                disabled={busyKey !== null}
                onClick={() =>
                  runAction(`case-${action.value}`, {
                    caseStatus: action.value,
                    changeReason: `case_${action.value}`,
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
        <div className="mt-5">
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
        <div className="mt-5">
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
        <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-black">
          {actionError}
        </div>
      )}
    </div>
  );
}

export default function InstitutionPage() {
  const { session, me, loading, refreshProfile } = useAuth();
  const [summary, setSummary] = useState<SummaryOverview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>({
    queue: "active",
    status: "all",
    severity: "all",
    categoryId: "",
    q: "",
    sort: "priority_desc",
  });
  const deferredSearch = useDeferredValue(filters.q);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    params.set("queue", filters.queue);
    params.set("sort", filters.sort);

    if (filters.status !== "all") {
      params.set("status", filters.status);
    }

    if (filters.severity !== "all") {
      params.set("severity", filters.severity);
    }

    if (filters.categoryId) {
      params.set("categoryId", filters.categoryId);
    }

    if (deferredSearch.trim()) {
      params.set("q", deferredSearch.trim());
    }

    params.set("queueLimit", "10");
    return params.toString();
  }, [deferredSearch, filters]);

  const loadDashboard = useCallback(async () => {
    if (!me) {
      setSummary(null);
      setLoadingPage(false);
      return;
    }

    setLoadingPage(true);
    setPageError(null);

    try {
      const fetchDashboardData = async (accessToken: string) =>
        Promise.all([
          apiFetch<SummaryOverview>(`/institution/summaries/overview?${queryString}`, {
            accessToken,
          }),
          categories.length
            ? Promise.resolve<CategoryListResponse | null>(null)
            : apiFetch<CategoryListResponse>("/categories", {
                accessToken,
              }),
        ]);

      let activeToken = session?.access_token ?? null;

      if (!activeToken) {
        const { data } = await supabase.auth.getSession();
        activeToken = data.session?.access_token ?? null;
      }

      if (!activeToken) {
        throw new Error("Authentication required");
      }

      let summaryResponse: SummaryOverview;
      let categoryResponse: CategoryListResponse | null;

      try {
        [summaryResponse, categoryResponse] = await fetchDashboardData(activeToken);
      } catch (dashboardError) {
        const message =
          dashboardError instanceof Error ? dashboardError.message : "Authentication required";

        if (
          message !== "Authentication required" &&
          message !== "Invalid or expired token"
        ) {
          throw dashboardError;
        }

        const { data } = await supabase.auth.getSession();
        const refreshedToken = data.session?.access_token ?? null;

        if (!refreshedToken) {
          throw dashboardError;
        }

        await refreshProfile();
        [summaryResponse, categoryResponse] = await fetchDashboardData(refreshedToken);
      }

      setSummary(summaryResponse);
      if (categoryResponse?.items?.length) {
        setCategories(categoryResponse.items);
      }
    } catch (dashboardError) {
      setPageError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Unable to load the institution dashboard.",
      );
    } finally {
      setLoadingPage(false);
    }
  }, [categories.length, me, queryString, refreshProfile, session?.access_token]);

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
      "Exact-location post detail for responder teams",
      access.canUpdateCaseStatus ? "Case ownership and progress handling" : null,
      access.canUpdateWorkflowStatus ? "Citizen-facing workflow movement" : null,
      access.canReviewReports ? "Moderation review queue controls" : null,
      access.canAssignOrganization ? "Cross-organization assignment authority" : null,
    ].filter((value): value is string => Boolean(value));
  }, [access]);

  const categoryOptions = useMemo(() => {
    if (categories.length) {
      return categories
        .slice()
        .sort((left, right) => left.label.localeCompare(right.label));
    }

    return (summary?.byCategory ?? []).map((item) => ({
      id: item.categoryId,
      label: item.label,
    })) as Category[];
  }, [categories, summary?.byCategory]);

  const activeQueueOption = useMemo(
    () =>
      access?.canViewReportedQueue
        ? queueOptions
        : queueOptions.filter((option) => option.value !== "reported"),
    [access?.canViewReportedQueue],
  );

  if (loading) {
    return <StateBlock title="Loading session" description="Checking your account." />;
  }

  if (!session) {
    return (
      <StateBlock
        title="Sign in to open dashboard"
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
        description="Your current role does not have access to responder dashboard."
        actionLabel="Back to feed"
        actionHref="/"
      />
    );
  }

  if (loadingPage) {
    return (
      <StateBlock
        title="Loading dashboard"
        description="Fetching queue stats, charts, and responder workload."
      />
    );
  }

  if (pageError || !summary || !access) {
    return (
      <StateBlock
        title="Dashboard unavailable"
        description={pageError ?? "Institution dashboard could not be loaded."}
        actionLabel="Back to feed"
        actionHref="/"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="surface overflow-hidden rounded-[36px] border border-white/10 p-6">
        <div className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_35%)]" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="label-text">Institution dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                Professional operations console
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{roleSummary[access.role]}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-[18px] border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700">
                <p className="label-text">Responder role</p>
                <p className="mt-2 font-semibold text-slate-950">{formatRole(access.role)}</p>
              </div>
              <Link href="/" className="button-secondary">
                View public feed
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              title="Total reports"
              value={summary.totals.totalPosts}
              subtext={`Selected range: ${summary.dateRange.from} to ${summary.dateRange.to}`}
            />
            <MetricCard
              tone="orange"
              title="Unresolved"
              value={summary.totals.unresolvedPosts}
              subtext="Still need responder attention."
            />
            <MetricCard
              tone="rose"
              title="High priority"
              value={summary.totals.highPriorityPosts}
              subtext="Priority score 75 or above."
            />
            <MetricCard
              tone="green"
              title="Resolved"
              value={summary.totals.resolvedPosts}
              subtext="Citizen-facing closure reached."
            />
            <MetricCard
              title="Reported items"
              value={summary.totals.reportedPosts ?? 0}
              subtext="Moderation-linked reports in selected range."
            />
            <MetricCard
              tone="green"
              title="Avg priority"
              value={summary.totals.avgPriorityScore ?? 0}
              subtext="Average priority score across current scope."
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <RoleAccessCard access={access} capabilities={capabilityLabels} />

        <div className="surface rounded-[30px] border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-text">Work filters</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Filter by workflow, severity, category, and queue focus so teams can pick work they want.
              </p>
            </div>
            <div className="rounded-[18px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
              {summary.queueMeta?.label ?? "Queue"}: {summary.queueMeta?.totalMatching ?? 0} matching
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <p className="label-text">Search</p>
              <input
                className="field mt-2"
                value={filters.q}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, q: event.target.value }))
                }
                placeholder="Search text, area, or category"
              />
            </div>

            <label className="block">
              <span className="label-text">Queue</span>
              <select
                className="select-field mt-2"
                value={filters.queue}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    queue: event.target.value as DashboardFilters["queue"],
                  }))
                }
              >
                {activeQueueOption.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-text">Workflow</span>
              <select
                className="select-field mt-2"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                {workflowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-text">Severity</span>
              <select
                className="select-field mt-2"
                value={filters.severity}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, severity: event.target.value }))
                }
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-text">Category</span>
              <select
                className="select-field mt-2"
                value={filters.categoryId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, categoryId: event.target.value }))
                }
              >
                <option value="">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label-text">Sort</span>
              <select
                className="select-field mt-2"
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value as DashboardFilters["sort"],
                  }))
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {activeQueueOption.map((option) => (
              <button
                key={option.value}
                type="button"
                className="pill-button"
                data-active={filters.queue === option.value}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    queue: option.value,
                  }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <DistributionCard
          title="Workflow mix"
          subtitle="How current report volume splits across citizen-facing workflow states."
          items={summary.byStatus.map((item) => ({
            label: item.status,
            count: item.count,
          }))}
          total={summary.totals.totalPosts}
          colorClass="bg-gradient-to-r from-slate-700 to-slate-500"
        />

        <DistributionCard
          title="Severity breakdown"
          subtitle="AI severity helps responders separate urgent safety problems from lower-impact work."
          items={summary.bySeverity.map((item) => ({
            label: item.severity,
            count: item.count,
          }))}
          total={summary.totals.totalPosts}
          colorClass="bg-gradient-to-r from-cyan-500 to-blue-500"
        />

        <DistributionCard
          title="Case progress"
          subtitle="Operational case states help teams understand whether reports are still waiting, being worked on, or closed."
          items={(summary.byCaseStatus ?? []).map((item) => ({
            label: item.status,
            count: item.count,
          }))}
          total={(summary.byCaseStatus ?? []).reduce((sum, item) => sum + item.count, 0)}
          colorClass="bg-gradient-to-r from-emerald-500 to-teal-500"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TimelineCard items={summary.timeline ?? []} />

        <div className="space-y-6">
          <div className="surface rounded-[30px] border border-white/10 p-6">
            <p className="label-text">Top categories</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              Category mix shows what responder team is receiving most often.
            </p>
            <div className="mt-5 space-y-3">
              {summary.byCategory.length ? (
                summary.byCategory.map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-950">{item.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-slate-500">No category data yet.</p>
              )}
            </div>
          </div>

          <div className="surface rounded-[30px] border border-white/10 p-6">
            <p className="label-text">Area hotspots</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              Places with strongest unresolved and high-priority concentration.
            </p>
            <div className="mt-5 space-y-3">
              {summary.byArea?.length ? (
                summary.byArea.map((item) => (
                  <div
                    key={item.area.id}
                    className="rounded-[18px] border border-slate-200 bg-white px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.area.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                          {item.area.areaType}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-slate-950">
                        {item.totals.totalPosts}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <span>Unresolved: {item.totals.unresolvedPosts}</span>
                      <span>High priority: {item.totals.highPriorityPosts}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-slate-500">No hotspot data for this range.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="surface rounded-[30px] border border-white/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="label-text">Focused queue</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {summary.queueMeta?.label ?? "Operational queue"}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Filter reports so each institution role can pick exact work lane they want to process.
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Showing {summary.queue?.length ?? 0} of {summary.queueMeta?.totalMatching ?? 0}
            </div>
          </div>
        </div>

        {summary.queue?.length ? (
          summary.queue.map((post) => (
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
            title="No matching reports"
            description="Try broader filters or switch queue lane to find work."
          />
        )}
      </section>

      {access.canViewReportedQueue && (
        <section className="space-y-4">
          <div className="surface rounded-[30px] border border-white/10 p-6">
            <p className="label-text">Admin moderation queue</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              Admins can review reported content without leaving main operations console.
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
              description="Moderation queue clear right now."
            />
          )}
        </section>
      )}
    </section>
  );
}
