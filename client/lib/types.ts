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
  reportCount: number;
  isAnonymous: boolean;
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
