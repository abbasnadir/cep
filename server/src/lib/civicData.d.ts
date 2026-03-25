import type { Request } from "express";
type DbRow = Record<string, any>;
declare function assertUuid(value: string | undefined, name: string): string;
declare function parsePagination(request: Request): {
    page: number;
    limit: number;
};
export declare function fetchProfileById(userId: string): Promise<{
    homeArea: DbRow | {
        id: any;
        name: any;
        area_type: any;
        parent_area_id: any;
    } | null | undefined;
    organization: DbRow | {
        id: any;
        name: any;
        organization_type: any;
        is_verified: any;
    } | null | undefined;
    id: any;
    organization_id: any;
    home_area_id: any;
    role: any;
    public_alias: any;
    anonymous_by_default: any;
    preferred_language: any;
    onboarding_complete: any;
    deleted_at: any;
} | null>;
export declare function requireProfile(userId: string): Promise<{
    homeArea: DbRow | {
        id: any;
        name: any;
        area_type: any;
        parent_area_id: any;
    } | null | undefined;
    organization: DbRow | {
        id: any;
        name: any;
        organization_type: any;
        is_verified: any;
    } | null | undefined;
    id: any;
    organization_id: any;
    home_area_id: any;
    role: any;
    public_alias: any;
    anonymous_by_default: any;
    preferred_language: any;
    onboarding_complete: any;
    deleted_at: any;
}>;
export declare function requireInstitutionProfile(userId: string): Promise<{
    homeArea: DbRow | {
        id: any;
        name: any;
        area_type: any;
        parent_area_id: any;
    } | null | undefined;
    organization: DbRow | {
        id: any;
        name: any;
        organization_type: any;
        is_verified: any;
    } | null | undefined;
    id: any;
    organization_id: any;
    home_area_id: any;
    role: any;
    public_alias: any;
    anonymous_by_default: any;
    preferred_language: any;
    onboarding_complete: any;
    deleted_at: any;
}>;
export declare function mapProfileResponse(profile: DbRow, user: Request["user"]): {
    user: {
        id: string;
        email: string | null;
        role: any;
        onboardingComplete: boolean;
    };
    profile: {
        id: any;
        role: any;
        publicAlias: any;
        anonymousByDefault: boolean;
        preferredLanguage: any;
        onboardingComplete: boolean;
        homeArea: {
            id: any;
            name: any;
            areaType: any;
            parentAreaId: any;
        };
        organization: {
            id: any;
            name: any;
            organizationType: any;
            verified: boolean;
        } | undefined;
    };
};
export declare function hydratePosts(rows: DbRow[], options?: {
    includeExactLocation?: boolean;
}): Promise<{
    exactLocation?: {
        latitude: number;
        longitude: number;
    } | null;
    id: any;
    categoryId: any;
    categoryLabel: any;
    description: any;
    descriptionExcerpt: string;
    sourceLanguage: any;
    displayLanguage: any;
    authorAlias: any;
    area: {
        id: any;
        name: any;
        areaType: any;
        parentAreaId: any;
    };
    workflowStatus: any;
    enrichmentStatus: any;
    priorityScore: number;
    raiseCount: number;
    commentCount: number;
    reportCount: number;
    isAnonymous: boolean;
    media: {
        id: any;
        mediaType: any;
        url: any;
        thumbnailUrl: null;
    }[];
    createdAt: any;
    updatedAt: any;
    rankingReason: {
        localityMatch: string;
        engagementWeight: number;
        aiSeverityWeight: number;
    };
    aiAssessment: {
        enrichmentStatus: any;
        severity: any;
        complexity: any;
        hazardTags: any;
        translatedText: any;
        summary: any;
        confidence: any;
        modelVersion: any;
        processedAt: any;
    };
}[]>;
export declare function fetchPostDetail(postId: string, options?: {
    includeExactLocation?: boolean;
}): Promise<{
    exactLocation?: {
        latitude: number;
        longitude: number;
    } | null;
    id: any;
    categoryId: any;
    categoryLabel: any;
    description: any;
    descriptionExcerpt: string;
    sourceLanguage: any;
    displayLanguage: any;
    authorAlias: any;
    area: {
        id: any;
        name: any;
        areaType: any;
        parentAreaId: any;
    };
    workflowStatus: any;
    enrichmentStatus: any;
    priorityScore: number;
    raiseCount: number;
    commentCount: number;
    reportCount: number;
    isAnonymous: boolean;
    media: {
        id: any;
        mediaType: any;
        url: any;
        thumbnailUrl: null;
    }[];
    createdAt: any;
    updatedAt: any;
    rankingReason: {
        localityMatch: string;
        engagementWeight: number;
        aiSeverityWeight: number;
    };
    aiAssessment: {
        enrichmentStatus: any;
        severity: any;
        complexity: any;
        hazardTags: any;
        translatedText: any;
        summary: any;
        confidence: any;
        modelVersion: any;
        processedAt: any;
    };
} | undefined>;
export declare function fetchComments(postId: string, page: number, limit: number): Promise<{
    id: any;
    postId: any;
    body: any;
    authorAlias: any;
    createdAt: any;
}[]>;
export declare function fetchFeed(request: Request): Promise<{
    items: {
        exactLocation?: {
            latitude: number;
            longitude: number;
        } | null;
        id: any;
        categoryId: any;
        categoryLabel: any;
        description: any;
        descriptionExcerpt: string;
        sourceLanguage: any;
        displayLanguage: any;
        authorAlias: any;
        area: {
            id: any;
            name: any;
            areaType: any;
            parentAreaId: any;
        };
        workflowStatus: any;
        enrichmentStatus: any;
        priorityScore: number;
        raiseCount: number;
        commentCount: number;
        reportCount: number;
        isAnonymous: boolean;
        media: {
            id: any;
            mediaType: any;
            url: any;
            thumbnailUrl: null;
        }[];
        createdAt: any;
        updatedAt: any;
        rankingReason: {
            localityMatch: string;
            engagementWeight: number;
            aiSeverityWeight: number;
        };
        aiAssessment: {
            enrichmentStatus: any;
            severity: any;
            complexity: any;
            hazardTags: any;
            translatedText: any;
            summary: any;
            confidence: any;
            modelVersion: any;
            processedAt: any;
        };
    }[];
    page: number;
    limit: number;
    total: number;
    rankingPolicy: {
        factors: string[];
        localityPriority: string[];
    };
}>;
export declare function fetchSummary(request: Request, areaId?: string): Promise<{
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
    bySeverity: {
        severity: string;
        count: number;
    }[];
    byCategory: {
        categoryId: string;
        label: any;
        count: number;
    }[];
    byStatus: {
        status: string;
        count: number;
    }[];
    area?: never;
    topIssues?: never;
} | {
    area: {
        id: any;
        name: any;
        areaType: any;
        parentAreaId: any;
    };
    totals: {
        totalPosts: number;
        unresolvedPosts: number;
        highPriorityPosts: number;
    };
    byCategory: {
        categoryId: string;
        label: any;
        count: number;
    }[];
    topIssues: {
        exactLocation?: {
            latitude: number;
            longitude: number;
        } | null;
        id: any;
        categoryId: any;
        categoryLabel: any;
        description: any;
        descriptionExcerpt: string;
        sourceLanguage: any;
        displayLanguage: any;
        authorAlias: any;
        area: {
            id: any;
            name: any;
            areaType: any;
            parentAreaId: any;
        };
        workflowStatus: any;
        enrichmentStatus: any;
        priorityScore: number;
        raiseCount: number;
        commentCount: number;
        reportCount: number;
        isAnonymous: boolean;
        media: {
            id: any;
            mediaType: any;
            url: any;
            thumbnailUrl: null;
        }[];
        createdAt: any;
        updatedAt: any;
        rankingReason: {
            localityMatch: string;
            engagementWeight: number;
            aiSeverityWeight: number;
        };
        aiAssessment: {
            enrichmentStatus: any;
            severity: any;
            complexity: any;
            hazardTags: any;
            translatedText: any;
            summary: any;
            confidence: any;
            modelVersion: any;
            processedAt: any;
        };
    }[];
    dateRange?: never;
    bySeverity?: never;
    byStatus?: never;
}>;
export declare function fetchAreas(request: Request): Promise<{
    id: any;
    name: any;
    areaType: any;
    parentAreaId: any;
}[]>;
export declare function fetchCategories(): Promise<{
    id: any;
    slug: any;
    label: any;
    severityHint: any;
}[]>;
export declare function createProfile(userId: string, body: DbRow): Promise<{
    homeArea: DbRow | {
        id: any;
        name: any;
        area_type: any;
        parent_area_id: any;
    } | null | undefined;
    organization: DbRow | {
        id: any;
        name: any;
        organization_type: any;
        is_verified: any;
    } | null | undefined;
    id: any;
    organization_id: any;
    home_area_id: any;
    role: any;
    public_alias: any;
    anonymous_by_default: any;
    preferred_language: any;
    onboarding_complete: any;
    deleted_at: any;
}>;
export declare function createPost(userId: string, body: DbRow): Promise<{
    exactLocation?: {
        latitude: number;
        longitude: number;
    } | null;
    id: any;
    categoryId: any;
    categoryLabel: any;
    description: any;
    descriptionExcerpt: string;
    sourceLanguage: any;
    displayLanguage: any;
    authorAlias: any;
    area: {
        id: any;
        name: any;
        areaType: any;
        parentAreaId: any;
    };
    workflowStatus: any;
    enrichmentStatus: any;
    priorityScore: number;
    raiseCount: number;
    commentCount: number;
    reportCount: number;
    isAnonymous: boolean;
    media: {
        id: any;
        mediaType: any;
        url: any;
        thumbnailUrl: null;
    }[];
    createdAt: any;
    updatedAt: any;
    rankingReason: {
        localityMatch: string;
        engagementWeight: number;
        aiSeverityWeight: number;
    };
    aiAssessment: {
        enrichmentStatus: any;
        severity: any;
        complexity: any;
        hazardTags: any;
        translatedText: any;
        summary: any;
        confidence: any;
        modelVersion: any;
        processedAt: any;
    };
} | undefined>;
export declare function createComment(userId: string, postId: string, body: DbRow): Promise<{
    id: any;
    postId: any;
    body: any;
    authorAlias: any;
    createdAt: any;
}>;
export declare function toggleRaise(userId: string, postId: string): Promise<{
    postId: string;
    raised: boolean;
    raiseCount: number;
}>;
export declare function createReport(userId: string, postId: string, body: DbRow): Promise<{
    postId: any;
    reasonCode: any;
    notes: any;
    submittedAt: any;
}>;
export declare function fetchInstitutionPostDetail(postId: string): Promise<{
    moderationState: {
        contentStatus: string;
        reviewState: string;
        reportCount: number;
        flaggedAt: any;
    };
    internalNotes: any;
    assignedOrganization: {
        id: any;
        name: any;
        organizationType: any;
        verified: boolean;
    } | null | undefined;
    exactLocation?: {
        latitude: number;
        longitude: number;
    } | null;
    id?: any;
    categoryId?: any;
    categoryLabel?: any;
    description?: any;
    descriptionExcerpt?: string;
    sourceLanguage?: any;
    displayLanguage?: any;
    authorAlias?: any;
    area?: {
        id: any;
        name: any;
        areaType: any;
        parentAreaId: any;
    };
    workflowStatus?: any;
    enrichmentStatus?: any;
    priorityScore?: number;
    raiseCount?: number;
    commentCount?: number;
    reportCount?: number;
    isAnonymous?: boolean;
    media?: {
        id: any;
        mediaType: any;
        url: any;
        thumbnailUrl: null;
    }[];
    createdAt?: any;
    updatedAt?: any;
    rankingReason?: {
        localityMatch: string;
        engagementWeight: number;
        aiSeverityWeight: number;
    };
    aiAssessment?: {
        enrichmentStatus: any;
        severity: any;
        complexity: any;
        hazardTags: any;
        translatedText: any;
        summary: any;
        confidence: any;
        modelVersion: any;
        processedAt: any;
    };
}>;
export { assertUuid, parsePagination };
//# sourceMappingURL=civicData.d.ts.map