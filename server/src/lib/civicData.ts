import type { Request } from "express";

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../errors/httpErrors.js";
import { supabase } from "./supabaseClient.js";

type DbRow = Record<string, any>;

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

function toExcerpt(text: string): string {
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

  return new Map(
    ensureSuccess(data ?? [], error, "Failed to load areas").map((row) => [row.id, row]),
  );
}

async function fetchCategoriesByIds(categoryIds: string[]) {
  if (!categoryIds.length) return new Map<string, DbRow>();

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, display_name, severity_hint")
    .in("id", categoryIds);

  return new Map(
    ensureSuccess(data ?? [], error, "Failed to load categories").map((row) => [row.id, row]),
  );
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
  const role = profile.role;
  const allowedRoles = ["ngo_staff", "government_staff", "admin"];

  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError("Institution access required");
  }

  if (role !== "admin" && !profile.organization?.is_verified) {
    throw new ForbiddenError("Institution role is not verified");
  }

  return profile;
}

export function mapProfileResponse(profile: DbRow, user: Request["user"]) {
  const resolvedRole = profile.role ?? user.role ?? "citizen";

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
    },
  };
}

async function fetchPostSupportData(postIds: string[]) {
  const [mediaResult, aiResult, commentResult, raiseResult, reportResult] = await Promise.all([
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

export async function hydratePosts(rows: DbRow[], options?: { includeExactLocation?: boolean }) {
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

  return rows.map((row) => {
    const category = categoryMap.get(row.category_id);
    const area = areaMap.get(row.area_id);
    const ai = aiByPost[row.id]?.[0];

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryLabel: category?.display_name ?? "Uncategorized",
      description: row.description,
      descriptionExcerpt: toExcerpt(row.description),
      sourceLanguage: row.source_language ?? null,
      displayLanguage: row.display_language ?? null,
      authorAlias: row.public_alias_snapshot ?? "anonymous",
      area: mapArea(area, row.sanitized_area_label),
      workflowStatus: row.workflow_status ?? "open",
      enrichmentStatus: row.enrichment_status ?? "pending",
      priorityScore: Number(row.priority_score ?? 0),
      raiseCount: raiseCounts[row.id] ?? 0,
      commentCount: commentCounts[row.id] ?? 0,
      reportCount: reportCounts[row.id] ?? 0,
      isAnonymous: Boolean(row.is_anonymous),
      media: mapMedia(mediaByPost[row.id] ?? []),
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null,
      rankingReason: {
        localityMatch: row.area_id ? "exact" : "global",
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

export async function fetchPostDetail(postId: string, options?: { includeExactLocation?: boolean }) {
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
    .order("created_at", { ascending: false })
    .range(0, 99);

  if (areaId) query.eq("area_id", assertUuid(areaId, "areaId"));
  if (categoryId) query.eq("category_id", assertUuid(categoryId, "categoryId"));
  if (status) query.eq("workflow_status", status);

  const { data, error } = await query;
  const posts = await hydratePosts(
    ensureSuccess(data ?? [], error, "Failed to load feed posts"),
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
      right.commentCount - left.commentCount
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
      factors: ["locality", "raises", "comments", "ai_severity", "freshness"],
      localityPriority: ["exact", "nearby", "global"],
    },
  };
}

export async function fetchSummary(request: Request, areaId?: string) {
  const { from, to } = parseDateRange(request);

  const query = supabase
    .from("posts")
    .select("id, category_id, area_id, workflow_status, priority_score, created_at")
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  if (areaId) query.eq("area_id", assertUuid(areaId, "areaId"));

  const { data, error } = await query;
  const posts = ensureSuccess(data ?? [], error, "Failed to load posts for summary");
  const postIds = posts.map((post) => post.id);

  const [categories, areas, aiResult] = await Promise.all([
    fetchCategoriesByIds(Array.from(new Set(posts.map((post) => post.category_id).filter(Boolean)))),
    fetchAreasByIds(Array.from(new Set(posts.map((post) => post.area_id).filter(Boolean)))),
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

  if (!areaId) {
    return {
      dateRange: { from, to },
      totals,
      bySeverity,
      byCategory,
      byStatus,
    };
  }

  const area = areas.get(areaId);
  if (!area) {
    throw new NotFoundError("Area not found");
  }

  const topRows = [...posts]
    .sort((left, right) => Number(right.priority_score ?? 0) - Number(left.priority_score ?? 0))
    .slice(0, 5);
  const topIssues = await hydratePosts(
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
    totals: {
      totalPosts: totals.totalPosts,
      unresolvedPosts: totals.unresolvedPosts,
      highPriorityPosts: totals.highPriorityPosts,
    },
    byCategory,
    topIssues,
  };
}

export async function fetchAreas(request: Request) {
  const q = typeof request.query.q === "string" ? request.query.q : undefined;
  const parentAreaId =
    typeof request.query.parentAreaId === "string"
      ? request.query.parentAreaId
      : undefined;
  const type = typeof request.query.type === "string" ? request.query.type : undefined;

  const query = supabase
    .from("areas")
    .select("id, name, area_type, parent_area_id")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(25);

  if (q) query.ilike("name", `%${q}%`);
  if (parentAreaId) query.eq("parent_area_id", assertUuid(parentAreaId, "parentAreaId"));
  if (type) query.eq("area_type", type);

  const { data, error } = await query;
  return ensureSuccess(data ?? [], error, "Failed to load areas").map((row) =>
    mapArea(row),
  );
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, display_name, severity_hint")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  return ensureSuccess(data ?? [], error, "Failed to load categories").map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.display_name,
    severityHint: row.severity_hint ?? null,
  }));
}

export async function createProfile(userId: string, body: DbRow) {
  assert(typeof body.publicAlias === "string", "publicAlias is required");
  assert(body.publicAlias.trim().length >= 3, "publicAlias must be at least 3 characters");
  assert(typeof body.preferredLanguage === "string", "preferredLanguage is required");

  const payload = {
    id: userId,
    role: "citizen",
    public_alias: body.publicAlias.trim(),
    anonymous_by_default: body.anonymousByDefault ?? true,
    preferred_language: body.preferredLanguage,
    home_area_id: body.homeAreaId ?? null,
    onboarding_complete: true,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  ensureSuccess(null, error, "Failed to create or update profile");

  return requireProfile(userId);
}

export async function createPost(userId: string, body: DbRow) {
  assert(typeof body.categoryId === "string", "categoryId is required");
  assert(typeof body.description === "string", "description is required");

  const profile = await requireProfile(userId);
  const areaId =
    body.location?.mode === "manual" && typeof body.location.areaId === "string"
      ? assertUuid(body.location.areaId, "location.areaId")
      : null;

  let sanitizedAreaLabel = "Global";
  if (areaId) {
    const areaMap = await fetchAreasByIds([areaId]);
    sanitizedAreaLabel = areaMap.get(areaId)?.name ?? "Global";
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: userId,
      category_id: assertUuid(body.categoryId, "categoryId"),
      area_id: areaId,
      public_alias_snapshot: profile.public_alias,
      description: body.description.trim(),
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

export async function fetchInstitutionPostDetail(postId: string) {
  const post = await fetchPostDetail(postId, { includeExactLocation: true });
  const reportRowsResult = await supabase
    .from("post_reports")
    .select("created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  const caseViewResult = await supabase
    .from("institution_case_views")
    .select("organization_id, response_notes")
    .eq("post_id", postId)
    .limit(1)
    .maybeSingle();

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

  return {
    ...post,
    moderationState: {
      contentStatus: reportRows.length ? "under_review" : "visible",
      reviewState: reportRows.length ? "pending_review" : "clean",
      reportCount: reportRows.length,
      flaggedAt: reportRows[0]?.created_at ?? null,
    },
    internalNotes: caseView?.response_notes ?? null,
    assignedOrganization: caseView?.organization_id
      ? mapOrganization(organizationMap.get(caseView.organization_id))
      : null,
  };
}

export { assertUuid, parsePagination };
