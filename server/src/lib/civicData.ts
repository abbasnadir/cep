import type { Request } from "express";
import { randomUUID } from "node:crypto";

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../errors/httpErrors.js";
import { supabase } from "./supabaseClient.js";
import { assertPostIsNotSpam } from "./spamFilter.js";

type DbRow = Record<string, any>;
const APP_ROLES = new Set(["citizen", "ngo_staff", "government_staff", "admin"]);
const INSTITUTION_ROLES = ["ngo_staff", "government_staff", "admin"] as const;
const WORKFLOW_STATUSES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "rejected",
] as const;
const CASE_STATUSES = ["triage", "investigating", "responding", "monitoring", "closed"] as const;
const REPORT_REVIEW_STATUSES = [
  "pending_review",
  "dismissed",
  "actioned",
  "escalated",
] as const;
const INSTITUTION_ACCESS_BY_ROLE = {
  ngo_staff: {
    scope: "organization",
    canUpdateCaseNotes: true,
    canUpdateCaseStatus: true,
    allowedWorkflowStatuses: [] as string[],
    canViewReportedQueue: false,
    canReviewReports: false,
    canAssignOrganization: false,
  },
  government_staff: {
    scope: "organization",
    canUpdateCaseNotes: true,
    canUpdateCaseStatus: true,
    allowedWorkflowStatuses: ["acknowledged", "in_progress", "resolved"],
    canViewReportedQueue: false,
    canReviewReports: false,
    canAssignOrganization: false,
  },
  admin: {
    scope: "global",
    canUpdateCaseNotes: true,
    canUpdateCaseStatus: true,
    allowedWorkflowStatuses: [...WORKFLOW_STATUSES],
    canViewReportedQueue: true,
    canReviewReports: true,
    canAssignOrganization: true,
  },
} as const;
const DEFAULT_CATEGORIES = [
  { slug: "sanitation", label: "Sanitation", severityHint: "medium" },
  { slug: "flooding", label: "Flooding", severityHint: "high" },
  { slug: "public-safety", label: "Public Safety", severityHint: "high" },
  { slug: "water-access", label: "Water Access", severityHint: "high" },
  { slug: "road-damage", label: "Road Damage", severityHint: "medium" },
  { slug: "environment", label: "Environment", severityHint: "medium" },
] as const;
const DEFAULT_AREAS = [
  { id: "builtin-india", name: "India", areaType: "country", parentAreaId: null },
  { id: "builtin-delhi", name: "Delhi", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-dwarka", name: "Dwarka", areaType: "locality", parentAreaId: "builtin-delhi" },
  { id: "builtin-saket", name: "Saket", areaType: "locality", parentAreaId: "builtin-delhi" },
  { id: "builtin-mumbai", name: "Mumbai", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-andheri", name: "Andheri", areaType: "locality", parentAreaId: "builtin-mumbai" },
  { id: "builtin-bandra", name: "Bandra", areaType: "locality", parentAreaId: "builtin-mumbai" },
  { id: "builtin-bengaluru", name: "Bengaluru", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-indiranagar", name: "Indiranagar", areaType: "locality", parentAreaId: "builtin-bengaluru" },
  { id: "builtin-whitefield", name: "Whitefield", areaType: "locality", parentAreaId: "builtin-bengaluru" },
  { id: "builtin-kolkata", name: "Kolkata", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-salt-lake", name: "Salt Lake", areaType: "locality", parentAreaId: "builtin-kolkata" },
  { id: "builtin-park-street", name: "Park Street", areaType: "locality", parentAreaId: "builtin-kolkata" },
  { id: "builtin-chennai", name: "Chennai", areaType: "city", parentAreaId: "builtin-india" },
  { id: "builtin-adyar", name: "Adyar", areaType: "locality", parentAreaId: "builtin-chennai" },
  { id: "builtin-t-nagar", name: "T Nagar", areaType: "locality", parentAreaId: "builtin-chennai" },
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new BadRequestError(message);
  }
}

function assertUuid(value: string | undefined, name: string): string {
  assert(value, `${name} is required`);
  assert(UUID_REGEX.test(value), `${name} must be a valid UUID`);
  return value;
}

function ensureSuccess<T>(data: T, error: { message: string } | null, message?: string): T {
  if (error) {
    throw new Error(message ?? error.message);
  }

  return data;
}

function logFallback(message: string, error: { message: string } | null) {
  if (!error) return;
  console.warn(`${message}: ${error.message}`);
}

function assertEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  name: string,
): T[number] {
  assert(typeof value === "string" && allowed.includes(value), `${name} is invalid`);
  return value as T[number];
}

function resolveInstitutionAccess(role: unknown) {
  const resolvedRole = resolveAppRole(role);

  if (!INSTITUTION_ROLES.includes(resolvedRole as (typeof INSTITUTION_ROLES)[number])) {
    return null;
  }

  const access = INSTITUTION_ACCESS_BY_ROLE[resolvedRole as keyof typeof INSTITUTION_ACCESS_BY_ROLE];

  return {
    role: resolvedRole as (typeof INSTITUTION_ROLES)[number],
    scope: access.scope,
    canUpdateCaseNotes: access.canUpdateCaseNotes,
    canUpdateCaseStatus: access.canUpdateCaseStatus,
    allowedWorkflowStatuses: [...access.allowedWorkflowStatuses],
    canUpdateWorkflowStatus: access.allowedWorkflowStatuses.length > 0,
    canViewReportedQueue: access.canViewReportedQueue,
    canReviewReports: access.canReviewReports,
    canAssignOrganization: access.canAssignOrganization,
  };
}

function mapInstitutionAccess(access: NonNullable<ReturnType<typeof resolveInstitutionAccess>>) {
  return {
    role: access.role,
    scope: access.scope,
    canUpdateCaseNotes: access.canUpdateCaseNotes,
    canUpdateCaseStatus: access.canUpdateCaseStatus,
    canUpdateWorkflowStatus: access.canUpdateWorkflowStatus,
    allowedWorkflowStatuses: access.allowedWorkflowStatuses,
    canViewReportedQueue: access.canViewReportedQueue,
    canReviewReports: access.canReviewReports,
    canAssignOrganization: access.canAssignOrganization,
  };
}

function resolveAppRole(role: unknown) {
  return typeof role === "string" && APP_ROLES.has(role) ? role : "citizen";
}

function getDefaultAreas({
  q,
  parentAreaId,
  type,
  limit,
}: {
  q: string | undefined;
  parentAreaId: string | undefined;
  type: string | undefined;
  limit: number;
}) {
  return DEFAULT_AREAS.filter((area) => {
    if (type && area.areaType !== type) return false;
    if (parentAreaId && area.parentAreaId !== parentAreaId) return false;
    if (q && !area.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).slice(0, limit);
}

function mapArea(area: DbRow | null | undefined, fallbackLabel?: string) {
  if (!area) {
    return {
      id: "global",
      name: fallbackLabel ?? "Global",
      areaType: "global",
      parentAreaId: null,
    };
  }

  return {
    id: area.id,
    name: area.name,
    areaType: area.area_type,
    parentAreaId: area.parent_area_id ?? null,
  };
}

function mapOrganization(organization: DbRow | null | undefined) {
  if (!organization) return undefined;

  return {
    id: organization.id,
    name: organization.name,
    organizationType: organization.organization_type,
    verified: Boolean(organization.is_verified),
  };
}

function toExcerpt(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  return text.length <= 170 ? text : `${text.slice(0, 167)}...`;
}

function severityWeight(severity?: string | null): number {
  if (severity === "critical") return 1;
  if (severity === "high") return 0.75;
  if (severity === "medium") return 0.5;
  if (severity === "low") return 0.25;
  return 0;
}

function groupByPostId(rows: DbRow[], key = "post_id"): Record<string, DbRow[]> {
  return rows.reduce<Record<string, DbRow[]>>((accumulator, row) => {
    const id = row[key];
    if (!id) return accumulator;
    accumulator[id] ??= [];
    accumulator[id].push(row);
    return accumulator;
  }, {});
}

function countByPostId(rows: DbRow[], key = "post_id"): Record<string, number> {
  return rows.reduce<Record<string, number>>((accumulator, row) => {
    const id = row[key];
    if (!id) return accumulator;
    accumulator[id] = (accumulator[id] ?? 0) + 1;
    return accumulator;
  }, {});
}

function parsePagination(request: Request) {
  const page = Math.max(1, Number(request.query.page ?? 1) || 1);
  const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? 20) || 20));
  return { page, limit };
}

function parseDateRange(request: Request) {
  const from = typeof request.query.from === "string" ? request.query.from : undefined;
  const to = typeof request.query.to === "string" ? request.query.to : undefined;

  if (from && Number.isNaN(Date.parse(from))) {
    throw new BadRequestError("from must be a valid date");
  }

  if (to && Number.isNaN(Date.parse(to))) {
    throw new BadRequestError("to must be a valid date");
  }

  return {
    from: from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    to: to ?? new Date().toISOString().slice(0, 10),
  };
}

async function fetchAreasByIds(areaIds: string[]) {
  if (!areaIds.length) return new Map<string, DbRow>();

  const { data, error } = await supabase
    .from("areas")
    .select("id, name, area_type, parent_area_id")
    .in("id", areaIds);

  if (error) {
    logFallback("Falling back to empty area lookup", error);
    return new Map<string, DbRow>();
  }

  return new Map(
    (data ?? []).map((row) => [row.id, row]),
  );
}

async function fetchCategoriesByIds(categoryIds: string[]) {
  if (!categoryIds.length) return new Map<string, DbRow>();

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, display_name, severity_hint")
    .in("id", categoryIds);

  if (error) {
    logFallback("Falling back to empty category lookup", error);
    return new Map<string, DbRow>();
  }

  return new Map(
    (data ?? []).map((row) => [row.id, row]),
  );
}

async function fetchPostRowsByIds(postIds: string[], options?: { includeExactLocation?: boolean }) {
  if (!postIds.length) return [];

  const select =
    "id, author_id, category_id, area_id, public_alias_snapshot, description, source_language, display_language, workflow_status, enrichment_status, priority_score, is_anonymous, sanitized_area_label, created_at, updated_at" +
    (options?.includeExactLocation ? ", latitude, longitude" : "");

  const { data, error } = await supabase.from("posts").select(select).in("id", postIds);
  const rows = ensureSuccess(data ?? [], error, "Failed to load posts") as DbRow[];
  const rowMap = new Map<string, DbRow>(rows.map((row) => [row.id, row]));
  const orderedRows: DbRow[] = [];

  for (const postId of postIds) {
    const row = rowMap.get(postId);
    if (row) {
      orderedRows.push(row);
    }
  }

  return orderedRows;
}

async function resolveCategoryId(categoryInput: string) {
  if (UUID_REGEX.test(categoryInput)) {
    const categoryMap = await fetchCategoriesByIds([categoryInput]);
    assert(categoryMap.has(categoryInput), "categoryId is not recognized");
    return categoryInput;
  }

  const fallbackCategory = DEFAULT_CATEGORIES.find((category) => category.slug === categoryInput);
  assert(fallbackCategory, "categoryId is not recognized");

  const existingCategoryResult = await supabase
    .from("categories")
    .select("id")
    .eq("slug", fallbackCategory.slug)
    .maybeSingle();
  const existingCategory = ensureSuccess(
    existingCategoryResult.data,
    existingCategoryResult.error,
    "Failed to load category",
  );

  if (existingCategory?.id) {
    return existingCategory.id;
  }

  const createdCategoryResult = await supabase
    .from("categories")
    .insert({
      id: randomUUID(),
      slug: fallbackCategory.slug,
      display_name: fallbackCategory.label,
      severity_hint: fallbackCategory.severityHint,
      is_active: true,
    })
    .select("id")
    .single();

  const createdCategory = ensureSuccess(
    createdCategoryResult.data,
    createdCategoryResult.error,
    "Failed to create fallback category",
  );
  assert(createdCategory?.id, "Fallback category creation did not return an id");
  return createdCategory.id;
}

function resolveBuiltinArea(areaId: string) {
  return DEFAULT_AREAS.find((area) => area.id === areaId);
}

async function fetchOrganizationsByIds(organizationIds: string[]) {
  if (!organizationIds.length) return new Map<string, DbRow>();

  const { data, error } = await supabase
    .from("institution_organizations")
    .select("id, name, organization_type, is_verified")
    .in("id", organizationIds);

  return new Map(
    ensureSuccess(data ?? [], error, "Failed to load organizations").map((row) => [row.id, row]),
  );
}

export async function fetchProfileById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, home_area_id, role, public_alias, anonymous_by_default, preferred_language, onboarding_complete, deleted_at",
    )
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  const profile = ensureSuccess(data, error, "Failed to load profile");
  if (!profile) return null;

  const [areaMap, organizationMap] = await Promise.all([
    fetchAreasByIds(profile.home_area_id ? [profile.home_area_id] : []),
    fetchOrganizationsByIds(profile.organization_id ? [profile.organization_id] : []),
  ]);

  return {
    ...profile,
    homeArea: profile.home_area_id ? areaMap.get(profile.home_area_id) : null,
    organization: profile.organization_id
      ? organizationMap.get(profile.organization_id)
      : null,
  };
}

export async function requireProfile(userId: string) {
  const profile = await fetchProfileById(userId);
  if (!profile) {
    throw new NotFoundError("Profile not found");
  }

  return profile;
}

export async function requireInstitutionProfile(userId: string) {
  const profile = await requireProfile(userId);
  const access = resolveInstitutionAccess(profile.role);

  if (!access) {
    throw new ForbiddenError("Institution access required");
  }

  if (access.role !== "admin" && !profile.organization?.is_verified) {
    throw new ForbiddenError("Institution role is not verified");
  }

  return profile;
}

export function mapProfileResponse(profile: DbRow, user: Request["user"]) {
  const resolvedRole = resolveAppRole(profile.role ?? user.role);

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      role: resolvedRole,
      onboardingComplete: Boolean(profile.onboarding_complete),
    },
    profile: {
      id: profile.id,
      role: resolvedRole,
      publicAlias: profile.public_alias,
      anonymousByDefault: Boolean(profile.anonymous_by_default),
      preferredLanguage: profile.preferred_language ?? "en",
      onboardingComplete: Boolean(profile.onboarding_complete),
      homeArea: mapArea(profile.homeArea),
      organization: mapOrganization(profile.organization),
      ...(resolveInstitutionAccess(resolvedRole)
        ? {
            institutionAccess: mapInstitutionAccess(
              resolveInstitutionAccess(resolvedRole)!,
            ),
          }
        : {}),
    },
  };
}

async function fetchPostSupportData(postIds: string[]) {
  const [mediaResult, aiResult, commentResult, raiseResult, reportResult, followResult] =
    await Promise.all([
      supabase
        .from("post_media")
        .select("id, post_id, storage_bucket, storage_path, media_type")
        .in("post_id", postIds),
      supabase
        .from("post_ai_assessments")
        .select(
          "post_id, enrichment_status, severity_level, complexity_level, summary, translated_text, hazard_tags, confidence_score, model_version, processed_at",
        )
        .in("post_id", postIds),
      supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds)
        .eq("is_deleted", false),
      supabase.from("post_raises").select("post_id").in("post_id", postIds),
      supabase.from("post_reports").select("post_id, created_at").in("post_id", postIds),
      supabase.from("post_follows").select("post_id, user_id").in("post_id", postIds),
    ]);

  return {
    mediaRows: ensureSuccess(
      mediaResult.data ?? [],
      mediaResult.error,
      "Failed to load post media",
    ),
    aiRows: ensureSuccess(
      aiResult.data ?? [],
      aiResult.error,
      "Failed to load AI assessments",
    ),
    commentRows: ensureSuccess(
      commentResult.data ?? [],
      commentResult.error,
      "Failed to load comments",
    ),
    raiseRows: ensureSuccess(
      raiseResult.data ?? [],
      raiseResult.error,
      "Failed to load raises",
    ),
    reportRows: ensureSuccess(
      reportResult.data ?? [],
      reportResult.error,
      "Failed to load reports",
    ),
    followRows: ensureSuccess(
      followResult.data ?? [],
      followResult.error,
      "Failed to load follows",
    ),
  };
}

function mapAiAssessment(row: DbRow | undefined, fallbackStatus?: string) {
  return {
    enrichmentStatus: row?.enrichment_status ?? fallbackStatus ?? "pending",
    severity: row?.severity_level ?? null,
    complexity: row?.complexity_level ?? null,
    hazardTags: row?.hazard_tags ?? [],
    translatedText: row?.translated_text ?? null,
    summary: row?.summary ?? null,
    confidence: row?.confidence_score ?? null,
    modelVersion: row?.model_version ?? null,
    processedAt: row?.processed_at ?? null,
  };
}

function mapMedia(mediaRows: DbRow[]) {
  return mediaRows.map((row) => ({
    id: row.id,
    mediaType: row.media_type,
    url: row.storage_bucket
      ? supabase.storage.from(row.storage_bucket).getPublicUrl(row.storage_path).data.publicUrl
      : row.storage_path,
    thumbnailUrl: null,
  }));
}

export async function hydratePosts(
  rows: DbRow[],
  options?: { includeExactLocation?: boolean; viewerUserId?: string },
) {
  if (!rows.length) return [];

  const postIds = rows.map((row) => row.id);
  const categoryIds = Array.from(new Set(rows.map((row) => row.category_id).filter(Boolean)));
  const areaIds = Array.from(new Set(rows.map((row) => row.area_id).filter(Boolean)));

  const [categoryMap, areaMap, supportData] = await Promise.all([
    fetchCategoriesByIds(categoryIds),
    fetchAreasByIds(areaIds),
    fetchPostSupportData(postIds),
  ]);

  const aiByPost = groupByPostId(supportData.aiRows);
  const mediaByPost = groupByPostId(supportData.mediaRows);
  const commentCounts = countByPostId(supportData.commentRows);
  const raiseCounts = countByPostId(supportData.raiseRows);
  const reportCounts = countByPostId(supportData.reportRows);
  const followCounts = countByPostId(supportData.followRows);
  const followedPostIds = new Set(
    options?.viewerUserId
      ? supportData.followRows
          .filter((row) => row.user_id === options.viewerUserId)
          .map((row) => row.post_id)
      : [],
  );

  return rows.map((row) => {
    const category = categoryMap.get(row.category_id);
    const area = areaMap.get(row.area_id);
    const ai = aiByPost[row.id]?.[0];
    const description = typeof row.description === "string" ? row.description : "";

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryLabel: category?.display_name ?? "Uncategorized",
      description,
      descriptionExcerpt: toExcerpt(description),
      sourceLanguage: row.source_language ?? null,
      displayLanguage: row.display_language ?? null,
      authorAlias: row.public_alias_snapshot ?? "anonymous",
      area: mapArea(area, row.sanitized_area_label),
      workflowStatus: row.workflow_status ?? "open",
      enrichmentStatus: row.enrichment_status ?? "pending",
      priorityScore: Number(row.priority_score ?? 0),
      raiseCount: raiseCounts[row.id] ?? 0,
      commentCount: commentCounts[row.id] ?? 0,
      followerCount: followCounts[row.id] ?? 0,
      reportCount: reportCounts[row.id] ?? 0,
      isAnonymous: Boolean(row.is_anonymous),
      isFollowing: followedPostIds.has(row.id),
      media: mapMedia(mediaByPost[row.id] ?? []),
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null,
      rankingReason: {
        localityMatch:
          row.area_id || row.sanitized_area_label === "Detected location"
            ? "unknown"
            : "global",
        engagementWeight:
          ((raiseCounts[row.id] ?? 0) + (commentCounts[row.id] ?? 0)) / 100,
        aiSeverityWeight: severityWeight(ai?.severity_level),
      },
      aiAssessment: mapAiAssessment(ai, row.enrichment_status),
      ...(options?.includeExactLocation
        ? {
            exactLocation:
              row.latitude != null && row.longitude != null
                ? {
                    latitude: Number(row.latitude),
                    longitude: Number(row.longitude),
                  }
                : null,
          }
        : {}),
    };
  });
}

export async function fetchPostDetail(
  postId: string,
  options?: { includeExactLocation?: boolean; viewerUserId?: string },
) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, category_id, area_id, public_alias_snapshot, description, source_language, display_language, workflow_status, enrichment_status, priority_score, is_anonymous, sanitized_area_label, latitude, longitude, created_at, updated_at",
    )
    .eq("id", postId)
    .maybeSingle();

  const row = ensureSuccess(data, error, "Failed to load post");
  if (!row) {
    throw new NotFoundError("Post not found");
  }

  const [post] = await hydratePosts([row], options);
  return post;
}

export async function fetchComments(postId: string, page: number, limit: number) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, body, public_alias_snapshot, created_at")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  return ensureSuccess(data ?? [], error, "Failed to load comments").map((row) => ({
    id: row.id,
    postId: row.post_id,
    body: row.body,
    authorAlias: row.public_alias_snapshot ?? "anonymous",
    createdAt: row.created_at,
  }));
}

export async function fetchFeed(request: Request) {
  const { page, limit } = parsePagination(request);
  const areaId =
    typeof request.query.areaId === "string" ? request.query.areaId : undefined;
  const categoryId =
    typeof request.query.categoryId === "string" ? request.query.categoryId : undefined;
  const status =
    typeof request.query.status === "string" ? request.query.status : undefined;
  const sort =
    typeof request.query.sort === "string" ? request.query.sort : "ranked";

  const query = supabase
    .from("posts")
    .select(
      "id, author_id, category_id, area_id, public_alias_snapshot, description, source_language, display_language, workflow_status, enrichment_status, priority_score, is_anonymous, sanitized_area_label, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (areaId) query.eq("area_id", assertUuid(areaId, "areaId"));
  if (categoryId) query.eq("category_id", assertUuid(categoryId, "categoryId"));
  if (status) query.eq("workflow_status", status);

  const { data, error } = await query;
  const viewerUserId = request.user?.id;
  const posts = await hydratePosts(
    ensureSuccess(data ?? [], error, "Failed to load feed posts"),
    viewerUserId ? { viewerUserId } : undefined,
  );

  const sortedPosts = [...posts].sort((left, right) => {
    if (sort === "newest") {
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    }

    if (sort === "most_raised") {
      return right.raiseCount - left.raiseCount;
    }

    if (sort === "most_commented") {
      return right.commentCount - left.commentCount;
    }

    return (
      right.priorityScore - left.priorityScore ||
      right.raiseCount - left.raiseCount ||
      right.commentCount - left.commentCount ||
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });

  const start = (page - 1) * limit;
  const items = sortedPosts.slice(start, start + limit);

  return {
    items,
    page,
    limit,
    total: sortedPosts.length,
    rankingPolicy: {
      factors: ["priority_score", "raises", "comments", "freshness"],
    },
  };
}

async function fetchReportedQueue(limit = 5) {
  const { data, error } = await supabase
    .from("post_reports")
    .select("post_id, created_at, review_status")
    .eq("review_status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, limit));

  const reportRows = ensureSuccess(data ?? [], error, "Failed to load reported posts") as DbRow[];
  const orderedPostIds = Array.from(
    new Set(reportRows.map((row) => row.post_id).filter(Boolean)),
  ).slice(0, limit);

  if (!orderedPostIds.length) return [];

  const reportedRows = await fetchPostRowsByIds(orderedPostIds, { includeExactLocation: true });
  return hydratePosts(reportedRows, { includeExactLocation: true });
}

export async function fetchSummary(request: Request, areaId?: string, institutionProfile?: DbRow) {
  const { from, to } = parseDateRange(request);
  const access = institutionProfile ? resolveInstitutionAccess(institutionProfile.role) : null;

  const query = supabase
    .from("posts")
    .select("id, category_id, area_id, workflow_status, priority_score, created_at")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  if (areaId) query.eq("area_id", assertUuid(areaId, "areaId"));

  const { data, error } = await query;
  const posts = ensureSuccess(data ?? [], error, "Failed to load posts for summary");
  const postIds = posts.map((post) => post.id);

  const [categories, requestedAreaMap, aiResult] = await Promise.all([
    fetchCategoriesByIds(Array.from(new Set(posts.map((post) => post.category_id).filter(Boolean)))),
    areaId ? fetchAreasByIds([areaId]) : Promise.resolve(new Map<string, DbRow>()),
    supabase
      .from("post_ai_assessments")
      .select("post_id, severity_level")
      .in("post_id", postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const aiRows = ensureSuccess(aiResult.data ?? [], aiResult.error, "Failed to load severity data");
  const severityByPost = new Map(aiRows.map((row) => [row.post_id, row.severity_level ?? "unknown"]));

  const totals = {
    totalPosts: posts.length,
    unresolvedPosts: posts.filter((post) => post.workflow_status !== "resolved").length,
    highPriorityPosts: posts.filter((post) => Number(post.priority_score ?? 0) >= 75).length,
    resolvedPosts: posts.filter((post) => post.workflow_status === "resolved").length,
  };

  const bySeverity = Array.from(
    posts.reduce<Map<string, number>>((accumulator, post) => {
      const severity = severityByPost.get(post.id) ?? "unknown";
      accumulator.set(severity, (accumulator.get(severity) ?? 0) + 1);
      return accumulator;
    }, new Map()),
  ).map(([severity, count]) => ({ severity, count }));

  const byCategory = Array.from(
    posts.reduce<Map<string, number>>((accumulator, post) => {
      accumulator.set(post.category_id, (accumulator.get(post.category_id) ?? 0) + 1);
      return accumulator;
    }, new Map()),
  ).map(([categoryId, count]) => ({
    categoryId,
    label: categories.get(categoryId)?.display_name ?? "Uncategorized",
    count,
  }));

  const byStatus = Array.from(
    posts.reduce<Map<string, number>>((accumulator, post) => {
      accumulator.set(
        post.workflow_status ?? "open",
        (accumulator.get(post.workflow_status ?? "open") ?? 0) + 1,
      );
      return accumulator;
    }, new Map()),
  ).map(([status, count]) => ({ status, count }));

  const topRows = [...posts]
    .sort(
      (left, right) =>
        Number(right.priority_score ?? 0) - Number(left.priority_score ?? 0) ||
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, 5);
  const [topIssues, reportedPosts] = await Promise.all([
    hydratePosts(topRows, { includeExactLocation: true }),
    access?.canViewReportedQueue ? fetchReportedQueue(5) : Promise.resolve(undefined),
  ]);

  if (!areaId) {
    return {
      dateRange: { from, to },
      totals,
      bySeverity,
      byCategory,
      byStatus,
      ...(access ? { access: mapInstitutionAccess(access) } : {}),
      topIssues,
      ...(reportedPosts ? { reportedPosts } : {}),
    };
  }

  const area = requestedAreaMap.get(areaId);
  if (!area) {
    throw new NotFoundError("Area not found");
  }

  const sanitizedTopIssues = await hydratePosts(
    topRows.map((row) => ({
      ...row,
      public_alias_snapshot: "anonymous",
      description: "",
      source_language: null,
      display_language: null,
      enrichment_status: "pending",
      is_anonymous: true,
      sanitized_area_label: area.name,
      updated_at: row.created_at,
    })),
  );

  return {
    area: mapArea(area),
    ...(access ? { access: mapInstitutionAccess(access) } : {}),
    totals: {
      totalPosts: totals.totalPosts,
      unresolvedPosts: totals.unresolvedPosts,
      highPriorityPosts: totals.highPriorityPosts,
    },
    byCategory,
    topIssues: sanitizedTopIssues,
  };
}

export async function fetchAreas(request: Request) {
  const q = typeof request.query.q === "string" ? request.query.q : undefined;
  const parentAreaId =
    typeof request.query.parentAreaId === "string"
      ? request.query.parentAreaId
      : undefined;
  const type = typeof request.query.type === "string" ? request.query.type : undefined;
  const requestedLimit = Number(request.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(200, Math.max(1, requestedLimit))
    : q
      ? 25
      : 200;

  const query = supabase
    .from("areas")
    .select("id, name, area_type, parent_area_id")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (q) query.ilike("name", `%${q}%`);
  if (parentAreaId) query.eq("parent_area_id", assertUuid(parentAreaId, "parentAreaId"));
  if (type) query.eq("area_type", type);

  const { data, error } = await query;
  if (error) {
    logFallback("Falling back to built-in areas", error);
    return getDefaultAreas({ q, parentAreaId, type, limit }).map((area) => ({
      id: area.id,
      name: area.name,
      areaType: area.areaType,
      parentAreaId: area.parentAreaId,
    }));
  }

  const rows = data ?? [];

  if (rows.length) {
    return rows.map((row) => mapArea(row));
  }

  return getDefaultAreas({ q, parentAreaId, type, limit }).map((area) => ({
    id: area.id,
    name: area.name,
    areaType: area.areaType,
    parentAreaId: area.parentAreaId,
  }));
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, display_name, severity_hint")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) {
    logFallback("Falling back to built-in categories", error);
    return DEFAULT_CATEGORIES.map((category) => ({
      id: category.slug,
      slug: category.slug,
      label: category.label,
      severityHint: category.severityHint,
    }));
  }

  const rows = data ?? [];
  if (rows.length) {
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      label: row.display_name,
      severityHint: row.severity_hint ?? null,
    }));
  }

  return DEFAULT_CATEGORIES.map((category) => ({
    id: category.slug,
    slug: category.slug,
    label: category.label,
    severityHint: category.severityHint,
  }));
}

export async function createProfile(userId: string, body: DbRow) {
  assert(typeof body.publicAlias === "string", "publicAlias is required");
  assert(body.publicAlias.trim().length >= 3, "publicAlias must be at least 3 characters");
  assert(typeof body.preferredLanguage === "string", "preferredLanguage is required");
  const existingProfile = await fetchProfileById(userId);

  const payload = {
    id: userId,
    role: existingProfile?.role ?? "citizen",
    organization_id: existingProfile?.organization_id ?? null,
    public_alias: body.publicAlias.trim(),
    anonymous_by_default:
      body.anonymousByDefault ?? existingProfile?.anonymous_by_default ?? true,
    preferred_language: body.preferredLanguage,
    home_area_id:
      body.homeAreaId !== undefined
        ? body.homeAreaId
        : existingProfile?.home_area_id ?? null,
    onboarding_complete: true,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  ensureSuccess(null, error, "Failed to create or update profile");

  return requireProfile(userId);
}

export async function createPost(userId: string, body: DbRow) {
  assert(typeof body.categoryId === "string", "categoryId is required");
  assert(typeof body.description === "string", "description is required");
  const description = body.description.trim();
  assert(description, "description is required");

  const profile = await requireProfile(userId);
  const categoryId = await resolveCategoryId(body.categoryId);
  const hasDetectedGeoPoint =
    body.location?.mode === "auto_detected" &&
    typeof body.location?.geoPoint?.latitude === "number" &&
    typeof body.location?.geoPoint?.longitude === "number";
  const areaLabel =
    typeof body.location?.areaLabel === "string" ? body.location.areaLabel.trim() : "";
  const requestedAreaId =
    body.location?.mode === "manual" && typeof body.location.areaId === "string"
      ? body.location.areaId
      : null;

  let sanitizedAreaLabel = hasDetectedGeoPoint ? "Detected location" : "Global";
  let areaId: string | null = null;
  if (requestedAreaId) {
    if (UUID_REGEX.test(requestedAreaId)) {
      const resolvedAreaId = requestedAreaId;
      areaId = resolvedAreaId;
      const areaMap = await fetchAreasByIds([resolvedAreaId]);
      assert(areaMap.has(resolvedAreaId), "location.areaId is not recognized");
      sanitizedAreaLabel = areaLabel || areaMap.get(resolvedAreaId)?.name || "Global";
    } else {
      const builtinArea = resolveBuiltinArea(requestedAreaId);
      assert(builtinArea, "location.areaId is not recognized");
      sanitizedAreaLabel = areaLabel || builtinArea.name;
    }
  } else if (areaLabel) {
    sanitizedAreaLabel = areaLabel;
  }

  const locationMode =
    body.location?.mode === "auto_detected" ||
    body.location?.mode === "manual" ||
    body.location?.mode === "none"
      ? body.location.mode
      : "none";

  await assertPostIsNotSpam({
    description,
    locationMode,
    locationLabel: sanitizedAreaLabel,
    ...(typeof body.categoryId === "string" ? { categoryHint: body.categoryId } : {}),
  });

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      category_id: categoryId,
      area_id: areaId,
      public_alias_snapshot: profile.public_alias,
      description,
      source_language: body.sourceLanguage ?? profile.preferred_language ?? "en",
      display_language:
        Array.isArray(body.translateTargets) && body.translateTargets[0]
          ? body.translateTargets[0]
          : body.sourceLanguage ?? profile.preferred_language ?? "en",
      visibility: "public",
      workflow_status: "open",
      enrichment_status: "pending",
      latitude: body.location?.geoPoint?.latitude ?? null,
      longitude: body.location?.geoPoint?.longitude ?? null,
      sanitized_area_label: sanitizedAreaLabel,
      priority_score: 0,
      is_anonymous: body.isAnonymous ?? profile.anonymous_by_default ?? true,
    })
    .select("id")
    .single();

  const createdPost = ensureSuccess(data, error, "Failed to create post");
  assert(createdPost?.id, "Post creation did not return an id");

  const media = Array.isArray(body.media) ? body.media : [];
  if (media.length) {
    const { error: mediaError } = await supabase.from("post_media").insert(
      media.map((item: DbRow) => ({
        post_id: createdPost.id,
        storage_bucket: "post-media",
        storage_path: item.storagePath,
        media_type: item.mediaType,
        moderation_state: "visible",
      })),
    );
    ensureSuccess(null, mediaError, "Failed to attach post media");
  }

  await supabase.from("post_status_history").insert({
    post_id: createdPost.id,
    changed_by_profile_id: userId,
    from_status: null,
    to_status: "open",
    change_reason: "post_created",
  });

  return fetchPostDetail(createdPost.id);
}

export async function createComment(userId: string, postId: string, body: DbRow) {
  assert(typeof body.body === "string" && body.body.trim(), "body is required");
  await fetchPostDetail(postId);
  const profile = await requireProfile(userId);

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      author_id: userId,
      public_alias_snapshot: profile.public_alias,
      body: body.body.trim(),
      is_deleted: false,
    })
    .select("id, post_id, body, public_alias_snapshot, created_at")
    .single();

  const row = ensureSuccess(data, error, "Failed to create comment");
  assert(row, "Comment creation did not return a row");
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    authorAlias: row.public_alias_snapshot ?? "anonymous",
    createdAt: row.created_at,
  };
}

export async function toggleRaise(userId: string, postId: string) {
  await fetchPostDetail(postId);

  const existingRaiseResult = await supabase
    .from("post_raises")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  const existingRaise = ensureSuccess(
    existingRaiseResult.data,
    existingRaiseResult.error,
    "Failed to check raise state",
  );

  let raised = false;
  if (existingRaise?.id) {
    const { error } = await supabase
      .from("post_raises")
      .delete()
      .eq("id", existingRaise.id);
    ensureSuccess(null, error, "Failed to remove raise");
  } else {
    const { error } = await supabase.from("post_raises").insert({
      post_id: postId,
      user_id: userId,
    });
    ensureSuccess(null, error, "Failed to create raise");
    raised = true;
  }

  const { count, error } = await supabase
    .from("post_raises")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  ensureSuccess(null, error, "Failed to count raises");

  return {
    postId,
    raised,
    raiseCount: count ?? 0,
  };
}

export async function toggleFollow(userId: string, postId: string) {
  await fetchPostDetail(postId);

  const existingFollowResult = await supabase
    .from("post_follows")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  const existingFollow = ensureSuccess(
    existingFollowResult.data,
    existingFollowResult.error,
    "Failed to check follow state",
  );

  let following = false;
  if (existingFollow?.id) {
    const { error } = await supabase
      .from("post_follows")
      .delete()
      .eq("id", existingFollow.id);
    ensureSuccess(null, error, "Failed to remove follow");
  } else {
    const { error } = await supabase.from("post_follows").insert({
      post_id: postId,
      user_id: userId,
    });
    ensureSuccess(null, error, "Failed to create follow");
    following = true;
  }

  const { count, error } = await supabase
    .from("post_follows")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  ensureSuccess(null, error, "Failed to count follows");

  return {
    postId,
    following,
    followerCount: count ?? 0,
  };
}

export async function createReport(userId: string, postId: string, body: DbRow) {
  assert(typeof body.reasonCode === "string", "reasonCode is required");
  await fetchPostDetail(postId);

  const { data, error } = await supabase
    .from("post_reports")
    .insert({
      post_id: postId,
      reporter_id: userId,
      reason_code: body.reasonCode,
      notes: body.notes ?? null,
      review_status: "pending_review",
    })
    .select("post_id, reason_code, notes, created_at")
    .single();

  const row = ensureSuccess(data, error, "Failed to submit report");
  assert(row, "Report creation did not return a row");
  return {
    postId: row.post_id,
    reasonCode: row.reason_code,
    notes: row.notes ?? null,
    submittedAt: row.created_at,
  };
}

export async function fetchInstitutionPostDetail(postId: string, institutionProfile: DbRow) {
  const access = resolveInstitutionAccess(institutionProfile.role);
  if (!access) {
    throw new ForbiddenError("Institution access required");
  }

  const [postRow] = await fetchPostRowsByIds([postId], { includeExactLocation: true });
  if (!postRow) {
    throw new NotFoundError("Post not found");
  }

  const [post] = await hydratePosts([postRow], { includeExactLocation: true });
  const reportRowsResult = await supabase
    .from("post_reports")
    .select("id, reason_code, notes, review_status, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  let caseViewQuery = supabase
    .from("institution_case_views")
    .select("organization_id, case_status, response_notes, updated_at")
    .eq("post_id", postId)
    .limit(1)
    .order("updated_at", { ascending: false });

  if (access.scope === "organization" && institutionProfile.organization_id) {
    caseViewQuery = caseViewQuery.eq("organization_id", institutionProfile.organization_id);
  }

  const caseViewResult = await caseViewQuery.maybeSingle();

  const reportRows = ensureSuccess(
    reportRowsResult.data ?? [],
    reportRowsResult.error,
    "Failed to load moderation state",
  );
  const caseView = ensureSuccess(
    caseViewResult.data,
    caseViewResult.error,
    "Failed to load institution case view",
  );
  const organizationMap = await fetchOrganizationsByIds(
    caseView?.organization_id ? [caseView.organization_id] : [],
  );
  const pendingReports = reportRows.filter((row) => row.review_status === "pending_review");
  const actionedReports = reportRows.filter((row) =>
    ["actioned", "escalated"].includes(row.review_status),
  );

  return {
    ...post,
    access: mapInstitutionAccess(access),
    moderationState: {
      contentStatus: pendingReports.length
        ? "under_review"
        : actionedReports.length
          ? "hidden"
          : "visible",
      reviewState: pendingReports.length
        ? "pending_review"
        : actionedReports.length
          ? "actioned"
          : reportRows.length
            ? "flagged"
            : "clean",
      reportCount: reportRows.length,
      flaggedAt: reportRows[0]?.created_at ?? null,
    },
    caseStatus: caseView?.case_status ?? null,
    internalNotes: caseView?.response_notes ?? null,
    assignedOrganization: caseView?.organization_id
      ? mapOrganization(organizationMap.get(caseView.organization_id))
      : null,
    ...(access.canReviewReports
      ? {
          reports: reportRows.map((row) => ({
            id: row.id,
            reasonCode: row.reason_code,
            notes: row.notes ?? null,
            reviewStatus: row.review_status ?? "pending_review",
            createdAt: row.created_at,
          })),
        }
      : {}),
  };
}

export async function updateInstitutionPost(
  userId: string,
  postId: string,
  body: DbRow,
  institutionProfile?: DbRow,
) {
  const profile = institutionProfile ?? (await requireInstitutionProfile(userId));
  const access = resolveInstitutionAccess(profile.role);

  if (!access) {
    throw new ForbiddenError("Institution access required");
  }

  const workflowStatus =
    body.workflowStatus === undefined
      ? undefined
      : assertEnumValue(body.workflowStatus, WORKFLOW_STATUSES, "workflowStatus");
  const caseStatus =
    body.caseStatus === undefined
      ? undefined
      : assertEnumValue(body.caseStatus, CASE_STATUSES, "caseStatus");
  const reportReviewStatus =
    body.reportReviewStatus === undefined
      ? undefined
      : assertEnumValue(
          body.reportReviewStatus,
          REPORT_REVIEW_STATUSES,
          "reportReviewStatus",
        );
  const internalNotes =
    body.internalNotes === undefined
      ? undefined
      : body.internalNotes === null
        ? null
        : typeof body.internalNotes === "string"
          ? body.internalNotes.trim()
          : assert(false, "internalNotes must be a string or null");
  const assignedOrganizationId =
    body.assignedOrganizationId === undefined
      ? undefined
      : assertUuid(body.assignedOrganizationId, "assignedOrganizationId");
  const changeReason =
    typeof body.changeReason === "string" && body.changeReason.trim()
      ? body.changeReason.trim()
      : null;

  assert(
    workflowStatus !== undefined ||
      caseStatus !== undefined ||
      internalNotes !== undefined ||
      reportReviewStatus !== undefined ||
      assignedOrganizationId !== undefined,
    "At least one institution update is required",
  );

  if (workflowStatus !== undefined && !access.allowedWorkflowStatuses.includes(workflowStatus)) {
    throw new ForbiddenError("This role cannot change the post workflow to the requested status");
  }

  if (
    (caseStatus !== undefined || internalNotes !== undefined) &&
    !(access.canUpdateCaseStatus || access.canUpdateCaseNotes)
  ) {
    throw new ForbiddenError("This role cannot update institution case details");
  }

  if (caseStatus !== undefined && !access.canUpdateCaseStatus) {
    throw new ForbiddenError("This role cannot update institution case status");
  }

  if (internalNotes !== undefined && !access.canUpdateCaseNotes) {
    throw new ForbiddenError("This role cannot update institution case notes");
  }

  if (reportReviewStatus !== undefined && !access.canReviewReports) {
    throw new ForbiddenError("Only admins can review reported posts");
  }

  if (assignedOrganizationId !== undefined && !access.canAssignOrganization) {
    throw new ForbiddenError("Only admins can reassign institution ownership");
  }

  const postResult = await supabase
    .from("posts")
    .select("id, workflow_status")
    .eq("id", postId)
    .maybeSingle();
  const post = ensureSuccess(postResult.data, postResult.error, "Failed to load post");

  if (!post) {
    throw new NotFoundError("Post not found");
  }

  const now = new Date().toISOString();

  if (workflowStatus !== undefined && workflowStatus !== post.workflow_status) {
    const updateResult = await supabase
      .from("posts")
      .update({
        workflow_status: workflowStatus,
        updated_at: now,
      })
      .eq("id", postId);
    ensureSuccess(null, updateResult.error, "Failed to update post workflow");

    const historyResult = await supabase.from("post_status_history").insert({
      post_id: postId,
      changed_by_profile_id: userId,
      from_status: post.workflow_status ?? null,
      to_status: workflowStatus,
      change_reason: changeReason ?? "institution_update",
    });
    ensureSuccess(null, historyResult.error, "Failed to record post status history");
  }

  if (
    caseStatus !== undefined ||
    internalNotes !== undefined ||
    assignedOrganizationId !== undefined
  ) {
    const organizationId =
      assignedOrganizationId ?? profile.organization_id ?? undefined;

    assert(
      organizationId,
      "An organization assignment is required before updating institution case details",
    );

    const [organization] = await Promise.all([
      fetchOrganizationsByIds([organizationId]),
    ]);
    assert(organization.has(organizationId), "assignedOrganizationId is not recognized");

    const existingCaseViewResult = await supabase
      .from("institution_case_views")
      .select("id, case_status, response_notes")
      .eq("post_id", postId)
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle();
    const existingCaseView = ensureSuccess(
      existingCaseViewResult.data,
      existingCaseViewResult.error,
      "Failed to load institution case view",
    );

    if (existingCaseView?.id) {
      const caseUpdateResult = await supabase
        .from("institution_case_views")
        .update({
          profile_id: userId,
          case_status: caseStatus ?? existingCaseView.case_status ?? "triage",
          response_notes:
            internalNotes !== undefined
              ? internalNotes
              : existingCaseView.response_notes ?? null,
          updated_at: now,
          last_viewed_at: now,
        })
        .eq("id", existingCaseView.id);
      ensureSuccess(null, caseUpdateResult.error, "Failed to update institution case view");
    } else {
      const caseInsertResult = await supabase.from("institution_case_views").insert({
        id: randomUUID(),
        post_id: postId,
        profile_id: userId,
        organization_id: organizationId,
        case_status: caseStatus ?? "triage",
        response_notes: internalNotes ?? null,
        updated_at: now,
        last_viewed_at: now,
      });
      ensureSuccess(null, caseInsertResult.error, "Failed to create institution case view");
    }
  }

  if (reportReviewStatus !== undefined) {
    const reviewResult = await supabase
      .from("post_reports")
      .update({ review_status: reportReviewStatus })
      .eq("post_id", postId);
    ensureSuccess(null, reviewResult.error, "Failed to update report review status");
  }

  return fetchInstitutionPostDetail(postId, profile);
}

export { assertUuid, parsePagination };
export { resolveAppRole };
