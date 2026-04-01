export type Role = "citizen" | "ngo_staff" | "government_staff" | "admin";

export interface AreaRef {
  id: string;
  name: string;
  areaType: "country" | "state" | "city" | "district" | "ward" | "locality" | "global";
  parentAreaId?: string | null;
}

export interface OrganizationRef {
  id: string;
  name: string;
  organizationType: "ngo" | "government";
  verified: boolean;
}

export interface Profile {
  id: string;
  role: Role;
  publicAlias: string;
  anonymousByDefault: boolean;
  preferredLanguage: string;
  onboardingComplete: boolean;
  homeArea?: AreaRef;
  organization?: OrganizationRef;
  institutionAccess?: InstitutionAccess;
}

export interface MeResponse {
  user: {
    id: string;
    email?: string | null;
    role: Role;
    onboardingComplete: boolean;
  };
  profile: Profile;
}

export interface InstitutionAccess {
  role: Exclude<Role, "citizen">;
  scope: "organization" | "global";
  canUpdateCaseNotes: boolean;
  canUpdateCaseStatus: boolean;
  canUpdateWorkflowStatus: boolean;
  allowedWorkflowStatuses: Array<
    "open" | "acknowledged" | "in_progress" | "resolved" | "rejected"
  >;
  canViewReportedQueue: boolean;
  canReviewReports: boolean;
  canAssignOrganization: boolean;
}

export interface InstitutionReportReview {
  id: string;
  reasonCode: ReportCreateRequest["reasonCode"];
  notes?: string | null;
  reviewStatus: "pending_review" | "dismissed" | "actioned" | "escalated";
  createdAt: string;
}

export interface AiAssessment {
  enrichmentStatus: "pending" | "processing" | "completed" | "failed";
  severity?: "low" | "medium" | "high" | "critical";
  complexity?: "simple" | "moderate" | "complex" | "severe";
  summary?: string | null;
  translatedText?: string | null;
  hazardTags?: string[];
  confidence?: number | null;
  modelVersion?: string | null;
  processedAt?: string | null;
}

export interface PostMedia {
  id: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
}

export interface PostCard {
  id: string;
  categoryId: string;
  categoryLabel: string;
  description: string;
  descriptionExcerpt: string;
  sourceLanguage?: string | null;
  displayLanguage?: string | null;
  authorAlias: string;
  area: AreaRef;
  workflowStatus: "open" | "acknowledged" | "in_progress" | "resolved" | "rejected";
  enrichmentStatus: "pending" | "processing" | "completed" | "failed";
  priorityScore: number;
  raiseCount: number;
  commentCount: number;
  followerCount: number;
  reportCount: number;
  isAnonymous: boolean;
  isFollowing?: boolean;
  media: PostMedia[];
  createdAt: string;
  updatedAt?: string | null;
  rankingReason?: {
    localityMatch?: "exact" | "nearby" | "global" | "unknown";
    engagementWeight?: number;
    aiSeverityWeight?: number;
  };
  aiAssessment?: AiAssessment;
}

export interface PostDetail extends PostCard {
  aiAssessment?: AiAssessment;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  authorAlias: string;
  createdAt: string;
}

export interface CommentListResponse {
  items: Comment[];
}

export interface RaiseResponse {
  postId: string;
  raised: boolean;
  raiseCount: number;
}

export interface FollowResponse {
  postId: string;
  following: boolean;
  followerCount: number;
}

export interface Category {
  id: string;
  slug?: string;
  label: string;
  severityHint?: string | null;
}

export interface CategoryListResponse {
  items: Category[];
}

export interface AreaListResponse {
  items: AreaRef[];
}

export interface ReportCreateRequest {
  reasonCode:
    | "spam"
    | "abuse"
    | "misinformation"
    | "duplicate"
    | "privacy"
    | "other";
  notes?: string;
}

export interface FeedResponse {
  items: PostCard[];
  page: number;
  limit: number;
  total: number;
}

export interface SummaryOverview {
  dateRange: {
    from: string;
    to: string;
  };
  access?: InstitutionAccess;
  totals: {
    totalPosts: number;
    unresolvedPosts: number;
    highPriorityPosts: number;
    resolvedPosts: number;
  };
  bySeverity: Array<{
    severity: string;
    count: number;
  }>;
  byCategory: Array<{
    categoryId: string;
    label: string;
    count: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  topIssues?: PostCard[];
  reportedPosts?: PostCard[];
  byArea?: Array<{
    area: AreaRef;
    totals: {
      totalPosts: number;
      unresolvedPosts: number;
      highPriorityPosts: number;
    };
  }>;
}

export interface PostCreateRequest {
  categoryId: string;
  description: string;
  sourceLanguage: string;
  translateTargets: string[];
  isAnonymous: boolean;
  location: {
    mode: "auto_detected" | "manual" | "none";
    areaId?: string | null;
    areaLabel?: string | null;
    geoPoint?:
      | {
          latitude: number;
          longitude: number;
        }
      | undefined;
  };
  media: Array<{
    storagePath: string;
    mediaType: "image" | "video";
  }>;
}

export interface ComposerState {
  categoryId: string;
  description: string;
  locationMode: "manual" | "auto_detected" | "none";
  areaId: string;
  sourceLanguage: string;
  speechToTextEnabled: boolean;
  translateEnabled: boolean;
  isAnonymous: boolean;
  mediaFiles: File[];
}

export interface UploadableMedia {
  storagePath: string;
  mediaType: "image" | "video";
}

export interface InstitutionPostUpdateRequest {
  workflowStatus?: PostCard["workflowStatus"];
  caseStatus?: "triage" | "investigating" | "responding" | "monitoring" | "closed";
  internalNotes?: string | null;
  reportReviewStatus?: InstitutionReportReview["reviewStatus"];
  assignedOrganizationId?: string;
  changeReason?: string;
}
