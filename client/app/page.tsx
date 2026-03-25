"use client";

import type { Session } from "@supabase/supabase-js";
import {
  startTransition,
  type FormEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import { ENV } from "@/lib/env";
import { DEFAULT_COMPOSER_STATE, demoFeed, demoSummary } from "@/lib/mockData";
import { supabase } from "@/lib/supabaseClient";
import type {
  AreaRef,
  ComposerState,
  FeedResponse,
  MeResponse,
  PostCard,
  PostCreateRequest,
  PostDetail,
  Role,
  SummaryOverview,
} from "@/lib/types";

const categoryOptions = [
  "Sanitation",
  "Flooding",
  "Public Safety",
  "Water Access",
  "Road Damage",
  "Environment",
];

const roleLabels: Record<Role, string> = {
  citizen: "Citizen Reporter",
  ngo_staff: "NGO Responder",
  government_staff: "Government Desk",
  admin: "Platform Admin",
};

const statusTone: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  acknowledged: "bg-sky-100 text-sky-900",
  in_progress: "bg-emerald-100 text-emerald-900",
  resolved: "bg-zinc-200 text-zinc-800",
  rejected: "bg-rose-100 text-rose-900",
};

const severityTone: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-900",
};

function isInstitutionRole(role?: Role | null): boolean {
  return role === "ngo_staff" || role === "government_staff" || role === "admin";
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60_000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildLocalPreviewPost(
  composer: ComposerState,
  selectedArea: AreaRef,
  authorAlias: string,
): PostCard {
  const createdAt = new Date().toISOString();

  return {
    id: `local-${createdAt}`,
    categoryId: composer.categoryId,
    categoryLabel: composer.categoryId,
    description: composer.description,
    descriptionExcerpt: composer.description.slice(0, 170),
    sourceLanguage: composer.sourceLanguage,
    displayLanguage: composer.translateEnabled ? "en" : composer.sourceLanguage,
    authorAlias,
    area: selectedArea,
    workflowStatus: "open",
    enrichmentStatus: "pending",
    priorityScore: composer.locationMode === "manual" ? 78 : 70,
    raiseCount: 0,
    commentCount: 0,
    reportCount: 0,
    isAnonymous: composer.isAnonymous,
    media: composer.mediaFiles.map((file, index) => ({
      id: `${createdAt}-${index}`,
      mediaType: "image",
      url: "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=1200&q=80",
    })),
    createdAt,
    updatedAt: createdAt,
    rankingReason: {
      localityMatch:
        composer.locationMode === "manual" ? "exact" : composer.locationMode === "auto_detected" ? "nearby" : "global",
      engagementWeight: 0,
      aiSeverityWeight: 0.32,
    },
    aiAssessment: {
      enrichmentStatus: "pending",
      hazardTags: [],
      summary: "Waiting for image, translation, and severity enrichment.",
    },
  };
}

function toPostCard(post: PostDetail | PostCard): PostCard {
  return {
    ...post,
    descriptionExcerpt:
      "descriptionExcerpt" in post && post.descriptionExcerpt
        ? post.descriptionExcerpt
        : post.description.slice(0, 170),
  };
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="panel-muted rounded-[24px] border border-white/60 p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function PostCardView({
  post,
  isSelected,
  onSelect,
}: {
  post: PostCard;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const severity = post.aiAssessment?.severity ?? "pending";
  const complexity = post.aiAssessment?.complexity ?? "Awaiting scan";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`panel group w-full rounded-[28px] border p-5 text-left transition ${
        isSelected
          ? "border-[var(--accent)] shadow-[0_18px_50px_rgba(198,101,39,0.18)]"
          : "border-white/60 hover:-translate-y-0.5 hover:border-[var(--accent)]/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-[var(--accent-soft)] text-[var(--accent-ink)]">
              {post.categoryLabel}
            </span>
            <span className={`badge ${statusTone[post.workflowStatus] ?? "bg-zinc-100 text-zinc-800"}`}>
              {post.workflowStatus.replace("_", " ")}
            </span>
            <span
              className={`badge ${
                severityTone[severity] ?? "bg-slate-100 text-slate-800"
              }`}
            >
              {severity}
            </span>
          </div>
          <h3 className="mt-4 max-w-3xl text-xl font-semibold tracking-tight text-[var(--ink)]">
            {post.descriptionExcerpt}
          </h3>
        </div>
        <div className="rounded-[22px] border border-[var(--line)] bg-white/80 px-4 py-3 text-right">
          <p className="eyebrow">Priority</p>
          <p className="text-2xl font-semibold text-[var(--accent-ink)]">
            {Math.round(post.priorityScore)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span>{post.authorAlias}</span>
        <span className="text-[var(--line-strong)]">/</span>
        <span>{post.area.name}</span>
        <span className="text-[var(--line-strong)]">/</span>
        <span>{timeAgo(post.createdAt)}</span>
        <span className="text-[var(--line-strong)]">/</span>
        <span>Complexity: {complexity}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/60 bg-white/75">
        <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
          <div className="p-4">
            <p className="text-sm leading-6 text-[var(--muted)]">
              {post.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {post.aiAssessment?.hazardTags?.map((tag) => (
                <span key={tag} className="badge bg-slate-100 text-slate-700">
                  {tag}
                </span>
              ))}
              {!post.aiAssessment?.hazardTags?.length && (
                <span className="badge bg-white text-[var(--muted)]">
                  Enrichment {post.enrichmentStatus}
                </span>
              )}
            </div>
          </div>
          <div className="border-t border-[var(--line)] p-4 md:border-l md:border-t-0">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Raises
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                  {post.raiseCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Comments
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                  {post.commentCount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Reach
                </p>
                <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                  {post.rankingReason?.localityMatch ?? "nearby"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [feed, setFeed] = useState<PostCard[]>(demoFeed);
  const [summary, setSummary] = useState<SummaryOverview>(demoSummary);
  const [selectedPostId, setSelectedPostId] = useState<string>(demoFeed[0]?.id ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState("ranked");
  const [isLoading, setIsLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [notice, setNotice] = useState<string>("Demo feed is active until your backend routes are online.");
  const [feedSource, setFeedSource] = useState<"demo" | "live">("demo");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    alias: "",
  });
  const [composer, setComposer] = useState<ComposerState>(DEFAULT_COMPOSER_STATE);

  const deferredSearch = useDeferredValue(searchQuery);
  const currentRole = me?.profile.role ?? "citizen";
  const institutionView = isInstitutionRole(currentRole);
  const availableAreas = useMemo(
    () => Array.from(new Map([...demoFeed, ...feed].map((post) => [post.area.id, post.area])).values()),
    [feed],
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);

      if (!session?.access_token) {
        if (!ignore) {
          setMe(null);
          setFeed(demoFeed);
          setSummary(demoSummary);
          setFeedSource("demo");
          setSelectedPostId(demoFeed[0]?.id ?? "");
          setIsLoading(false);
        }
        return;
      }

      try {
        const meResponse = await apiFetch<MeResponse>("/me", {
          accessToken: session.access_token,
        });

        const feedResponse = await apiFetch<FeedResponse>("/feed?limit=8&sort=ranked", {
          accessToken: session.access_token,
        });

        let nextSummary = demoSummary;
        if (isInstitutionRole(meResponse.profile.role)) {
          try {
            nextSummary = await apiFetch<SummaryOverview>(
              "/institution/summaries/overview",
              {
                accessToken: session.access_token,
              },
            );
          } catch {
            nextSummary = demoSummary;
          }
        }

        if (!ignore) {
          const nextFeed = feedResponse.items.length
            ? feedResponse.items.map((item) => toPostCard(item))
            : demoFeed;

          setMe(meResponse);
          setFeed(nextFeed);
          setSummary(nextSummary);
          setFeedSource("live");
          setNotice("Live session connected. Feed and summaries are reading from your API where available.");
          setSelectedPostId((current) => current || nextFeed[0]?.id || "");
        }
      } catch {
        if (!ignore) {
          setFeed(demoFeed);
          setSummary(demoSummary);
          setFeedSource("demo");
          setNotice(
            "Signed in successfully. The API is still offline, so the interface is showing realistic demo data.",
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [session]);

  const filteredFeed = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const nextFeed = feed.filter((post) => {
      const matchesQuery =
        !query ||
        post.description.toLowerCase().includes(query) ||
        post.categoryLabel.toLowerCase().includes(query) ||
        post.area.name.toLowerCase().includes(query) ||
        post.aiAssessment?.hazardTags?.some((tag) => tag.toLowerCase().includes(query));

      const matchesStatus = statusFilter === "all" || post.workflowStatus === statusFilter;
      const matchesArea = areaFilter === "all" || post.area.id === areaFilter;
      const matchesCategory =
        categoryFilter === "all" || post.categoryLabel === categoryFilter;

      return matchesQuery && matchesStatus && matchesArea && matchesCategory;
    });

    return [...nextFeed].sort((left, right) => {
      if (sortMode === "newest") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }

      if (sortMode === "most_raised") {
        return right.raiseCount - left.raiseCount;
      }

      if (sortMode === "most_commented") {
        return right.commentCount - left.commentCount;
      }

      return right.priorityScore - left.priorityScore;
    });
  }, [areaFilter, categoryFilter, deferredSearch, feed, sortMode, statusFilter]);

  useEffect(() => {
    if (!filteredFeed.length) {
      setSelectedPostId("");
      return;
    }

    if (!filteredFeed.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(filteredFeed[0].id);
    }
  }, [filteredFeed, selectedPostId]);

  useEffect(() => {
    if (!availableAreas.length) return;

    if (!availableAreas.some((area) => area.id === composer.areaId)) {
      setComposer((current) => ({
        ...current,
        areaId: availableAreas[0].id,
      }));
    }
  }, [availableAreas, composer.areaId]);

  const selectedPost =
    filteredFeed.find((post) => post.id === selectedPostId) ?? filteredFeed[0] ?? null;

  const totalComments = filteredFeed.reduce((sum, post) => sum + post.commentCount, 0);
  const totalRaises = filteredFeed.reduce((sum, post) => sum + post.raiseCount, 0);
  const areaPressure = summary.byArea?.length ? summary.byArea : demoSummary.byArea;

  async function handleGoogleAuth() {
    setAuthBusy(true);
    setNotice("Redirecting to Supabase OAuth...");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: ENV.NEXT_PUBLIC_SITE_URL,
        },
      });

      if (error) throw error;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google sign-in failed.");
      setAuthBusy(false);
    }
  }

  async function handleCredentialAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);

    try {
      if (authMode === "register") {
        const { error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: {
            emailRedirectTo: ENV.NEXT_PUBLIC_SITE_URL,
            data: {
              public_alias: authForm.alias.trim(),
            },
          },
        });

        if (error) throw error;
        setNotice(
          "Registration started. Check your inbox if email confirmation is enabled, then complete your anonymous profile.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });

        if (error) throw error;
        setNotice("Welcome back. Your session is live.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setNotice("You have been signed out. Demo data is still available for UI preview.");
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!composer.description.trim()) {
      setNotice("Write a short issue description before posting.");
      return;
    }

    const selectedArea =
      availableAreas.find((area) => area.id === composer.areaId) ?? availableAreas[0];
    const previewPost = buildLocalPreviewPost(
      composer,
      selectedArea,
      me?.profile.publicAlias ?? "anonymous-signal",
    );

    setComposerBusy(true);

    if (!session?.access_token) {
      setFeed((current) => [previewPost, ...current]);
      setSelectedPostId(previewPost.id);
      setNotice("Preview added locally. Sign in with Supabase to publish to the real feed.");
      setComposer(DEFAULT_COMPOSER_STATE);
      setComposerBusy(false);
      return;
    }

    const payload: PostCreateRequest = {
      categoryId: composer.categoryId,
      description: composer.description.trim(),
      sourceLanguage: composer.sourceLanguage,
      translateTargets: composer.translateEnabled ? ["en"] : [],
      isAnonymous: composer.isAnonymous,
      location: {
        mode: composer.locationMode,
        areaId: composer.locationMode === "none" ? null : composer.areaId,
        geoPoint:
          composer.locationMode === "none"
            ? undefined
            : {
                latitude: composer.locationMode === "manual" ? 28.535 : 28.536,
                longitude: composer.locationMode === "manual" ? 77.391 : 77.392,
              },
      },
      media: composer.mediaFiles.map((file) => ({
        storagePath: `pending/${file.name}`,
        mediaType: "image",
      })),
    };

    try {
      const response = await apiFetch<PostDetail>("/posts", {
        method: "POST",
        accessToken: session.access_token,
        body: JSON.stringify(payload),
      });

      const createdPost = toPostCard(response);
      setFeed((current) => [createdPost, ...current]);
      setSelectedPostId(createdPost.id);
      setFeedSource("live");
      setNotice("Issue published. AI enrichment will continue in the background.");
      setComposer(DEFAULT_COMPOSER_STATE);
    } catch {
      setFeed((current) => [previewPost, ...current]);
      setSelectedPostId(previewPost.id);
      setFeedSource("demo");
      setNotice(
        "The API post route is not reachable yet, so your draft was added as a local preview with pending enrichment.",
      );
      setComposer(DEFAULT_COMPOSER_STATE);
    } finally {
      setComposerBusy(false);
    }
  }

  return (
    <main className="app-shell min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="panel relative overflow-hidden rounded-[36px] border border-white/60 px-6 py-6 shadow-[var(--shadow)] sm:px-8 lg:px-10">
          <div className="hero-glow" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Anonymous civic reporting / one shared platform</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">
                A social issue feed built for people who need to speak up, and institutions that need to respond.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Citizens can report local problems in real time, raise or comment on nearby issues,
                and stay anonymous by default. NGOs and government teams see the same stream with
                richer summaries, exact-location access, and priority signals from AI enrichment.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Issues in view"
                  value={filteredFeed.length}
                  tone="text-[var(--ink)]"
                />
                <MetricCard
                  label="Community raises"
                  value={totalRaises}
                  tone="text-[var(--accent-ink)]"
                />
                <MetricCard
                  label="Active comments"
                  value={totalComments}
                  tone="text-[var(--emerald-ink)]"
                />
              </div>
            </div>

            <div className="panel-muted w-full max-w-md rounded-[30px] border border-white/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Access</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    {session ? "Session active" : "Sign in or register"}
                  </h2>
                </div>
                <span className={`badge ${feedSource === "live" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                  {feedSource === "live" ? "Live data" : "Demo mode"}
                </span>
              </div>

              {session ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[24px] border border-[var(--line)] bg-white/85 p-4">
                    <p className="eyebrow">Signed in as</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                      {me?.profile.publicAlias ?? session.user.user_metadata.public_alias ?? "Anonymous member"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {roleLabels[currentRole]} / {session.user.email}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-highlight)] p-4">
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      Use the composer to publish a new issue. If the backend is still under construction,
                      the page will keep showing a local preview so the interface remains usable.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full rounded-full border border-[var(--line-strong)] px-4 py-3 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-5 flex rounded-full border border-[var(--line)] bg-white/80 p-1">
                    {(["login", "register"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAuthMode(mode)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                          authMode === mode
                            ? "bg-[var(--ink)] text-white"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {mode === "login" ? "Log in" : "Register"}
                      </button>
                    ))}
                  </div>

                  <form className="mt-5 space-y-3" onSubmit={handleCredentialAuth}>
                    {authMode === "register" && (
                      <label className="block">
                        <span className="form-label">Public alias</span>
                        <input
                          className="input-surface mt-2 w-full"
                          value={authForm.alias}
                          onChange={(event) =>
                            setAuthForm((current) => ({
                              ...current,
                              alias: event.target.value,
                            }))
                          }
                          placeholder="street-watch-21"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="form-label">Email</span>
                      <input
                        className="input-surface mt-2 w-full"
                        type="email"
                        value={authForm.email}
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="reporter@example.org"
                      />
                    </label>
                    <label className="block">
                      <span className="form-label">Password</span>
                      <input
                        className="input-surface mt-2 w-full"
                        type="password"
                        value={authForm.password}
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Use a strong password"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={authBusy}
                      className="cta-primary w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {authBusy
                        ? "Working..."
                        : authMode === "login"
                          ? "Continue with email"
                          : "Create anonymous account"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={authBusy}
                    className="mt-3 w-full rounded-full border border-[var(--line-strong)] px-4 py-3 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue with Google
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <section className="space-y-6">
            <form
              onSubmit={handleCreatePost}
              className="panel rounded-[32px] border border-white/60 p-6 shadow-[var(--shadow)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Issue composer</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    Publish now, enrich in the background.
                  </h2>
                </div>
                <span className="badge bg-white text-[var(--muted)]">
                  AI severity + translation async
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="form-label">Category</span>
                  <select
                    className="input-surface mt-2 w-full"
                    value={composer.categoryId}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="form-label">Location mode</span>
                  <select
                    className="input-surface mt-2 w-full"
                    value={composer.locationMode}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        locationMode: event.target.value as ComposerState["locationMode"],
                      }))
                    }
                  >
                    <option value="manual">Manual area</option>
                    <option value="auto_detected">Auto-detect</option>
                    <option value="none">Post as global</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="form-label">Describe the issue</span>
                <textarea
                  className="input-surface mt-2 min-h-36 w-full resize-y"
                  value={composer.description}
                  onChange={(event) =>
                    setComposer((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Example: Overflowing drain outside the market is forcing pedestrians into traffic and wastewater is entering homes after each rain."
                />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="form-label">Visible area</span>
                  <select
                    className="input-surface mt-2 w-full"
                    value={composer.areaId}
                    disabled={composer.locationMode === "none"}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        areaId: event.target.value,
                      }))
                    }
                  >
                    {availableAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="form-label">Source language</span>
                  <select
                    className="input-surface mt-2 w-full"
                    value={composer.sourceLanguage}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        sourceLanguage: event.target.value,
                      }))
                    }
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="bn">Bengali</option>
                    <option value="ta">Tamil</option>
                    <option value="mr">Marathi</option>
                  </select>
                </label>

                <label className="block">
                  <span className="form-label">Media attachment</span>
                  <input
                    className="input-surface mt-2 w-full file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--accent-ink)]"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        mediaFiles: Array.from(event.target.files ?? []),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setComposer((current) => ({
                      ...current,
                      speechToTextEnabled: !current.speechToTextEnabled,
                    }))
                  }
                  className="chip-button"
                  data-active={composer.speechToTextEnabled}
                >
                  Speech to text
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setComposer((current) => ({
                      ...current,
                      translateEnabled: !current.translateEnabled,
                    }))
                  }
                  className="chip-button"
                  data-active={composer.translateEnabled}
                >
                  Translate to English
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setComposer((current) => ({
                      ...current,
                      isAnonymous: !current.isAnonymous,
                    }))
                  }
                  className="chip-button"
                  data-active={composer.isAnonymous}
                >
                  Anonymous by default
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-[var(--line)] bg-white/75 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {composer.mediaFiles.length
                      ? `${composer.mediaFiles.length} media file(s) queued`
                      : "No media selected"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Posts publish immediately with pending enrichment so users never wait on AI processing.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={composerBusy || isLoading}
                  className="cta-primary rounded-full px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {composerBusy ? "Publishing..." : "Publish issue"}
                </button>
              </div>
            </form>

            <section className="panel rounded-[32px] border border-white/60 p-6 shadow-[var(--shadow)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Ranked feed</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    Social discovery with civic urgency built in.
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge bg-white text-[var(--muted)]">
                    Locality first
                  </span>
                  <span className="badge bg-white text-[var(--muted)]">
                    Comments + raises
                  </span>
                  <span className="badge bg-white text-[var(--muted)]">
                    AI severity
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <input
                  className="input-surface w-full"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search area, issue type, or hazard tag"
                />
                <select
                  className="input-surface w-full"
                  value={sortMode}
                  onChange={(event) => {
                    startTransition(() => {
                      setSortMode(event.target.value);
                    });
                  }}
                >
                  <option value="ranked">Sort by ranked priority</option>
                  <option value="newest">Sort by newest</option>
                  <option value="most_raised">Sort by raises</option>
                  <option value="most_commented">Sort by comments</option>
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["all", "open", "acknowledged", "in_progress", "resolved"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setStatusFilter(status);
                      })
                    }
                    className="chip-button"
                    data-active={statusFilter === status}
                  >
                    {status === "all" ? "All status" : status.replace("_", " ")}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select
                  className="input-surface w-full"
                  value={areaFilter}
                  onChange={(event) =>
                    startTransition(() => {
                      setAreaFilter(event.target.value);
                    })
                  }
                >
                  <option value="all">All areas</option>
                  {availableAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>

                <select
                  className="input-surface w-full"
                  value={categoryFilter}
                  onChange={(event) =>
                    startTransition(() => {
                      setCategoryFilter(event.target.value);
                    })
                  }
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 space-y-4">
                {filteredFeed.length ? (
                  filteredFeed.map((post) => (
                    <PostCardView
                      key={post.id}
                      post={post}
                      isSelected={selectedPostId === post.id}
                      onSelect={() => setSelectedPostId(post.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-[26px] border border-dashed border-[var(--line-strong)] p-8 text-center text-[var(--muted)]">
                    No posts match the current filters.
                  </div>
                )}
              </div>
            </section>
          </section>

          <aside className="space-y-6">
            <section className="panel rounded-[32px] border border-white/60 p-6 shadow-[var(--shadow)] xl:sticky xl:top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">
                    {institutionView ? "Institution command center" : "Responder lens preview"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    {institutionView
                      ? "Operational summary"
                      : "What NGOs and government teams will see"}
                  </h2>
                </div>
                <span className="badge bg-[var(--emerald-soft)] text-[var(--emerald-ink)]">
                  {institutionView ? roleLabels[currentRole] : "Dashboard demo"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Total posts"
                  value={summary.totals.totalPosts}
                  tone="text-[var(--ink)]"
                />
                <MetricCard
                  label="High priority"
                  value={summary.totals.highPriorityPosts}
                  tone="text-[var(--accent-ink)]"
                />
                <MetricCard
                  label="Unresolved"
                  value={summary.totals.unresolvedPosts}
                  tone="text-[var(--warning-ink)]"
                />
                <MetricCard
                  label="Resolved"
                  value={summary.totals.resolvedPosts}
                  tone="text-[var(--emerald-ink)]"
                />
              </div>

              <div className="mt-5 rounded-[26px] border border-[var(--line)] bg-white/75 p-4">
                <p className="eyebrow">Area pressure</p>
                <div className="mt-3 space-y-3">
                  {areaPressure.map((area) => (
                    <div key={area.area.id}>
                      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                        <span>{area.area.name}</span>
                        <span>{area.totals.highPriorityPosts} high-priority</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[var(--line)]">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{
                            width: `${Math.min(
                              100,
                              (area.totals.highPriorityPosts / Math.max(summary.totals.highPriorityPosts, 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPost && (
                <div className="mt-5 rounded-[26px] border border-[var(--line)] bg-[var(--panel-highlight)] p-5">
                  <p className="eyebrow">Selected issue</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
                    {selectedPost.descriptionExcerpt}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`badge ${statusTone[selectedPost.workflowStatus]}`}>
                      {selectedPost.workflowStatus.replace("_", " ")}
                    </span>
                    <span
                      className={`badge ${
                        severityTone[selectedPost.aiAssessment?.severity ?? "medium"]
                      }`}
                    >
                      {selectedPost.aiAssessment?.severity ?? "pending"}
                    </span>
                    <span className="badge bg-white text-[var(--muted)]">
                      {selectedPost.area.name}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/70 bg-white/80 p-4">
                      <p className="eyebrow">Public detail</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Public cards show locality, alias snapshot, community engagement, and enrichment state.
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/70 bg-white/80 p-4">
                      <p className="eyebrow">Institution-only detail</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        Exact coordinates remain private and unlock only for verified NGO or government roles.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-white/70 bg-white/80 p-4">
                    <p className="eyebrow">AI summary</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {selectedPost.aiAssessment?.summary ??
                        "Awaiting AI enrichment for translation, hazard tags, and severity scoring."}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="panel rounded-[32px] border border-white/60 p-6 shadow-[var(--shadow)]">
              <p className="eyebrow">Session note</p>
              <p className="mt-2 text-base leading-7 text-[var(--muted)]">
                {notice}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="badge bg-white text-[var(--muted)]">
                  API base: {ENV.NEXT_PUBLIC_API_BASE_URL}
                </span>
                <span className="badge bg-white text-[var(--muted)]">
                  Session: {session ? "authenticated" : "guest preview"}
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
