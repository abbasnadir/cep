import type { ComposerState, PostCard, SummaryOverview } from "@/lib/types";

const northWard = {
  id: "area-north-ward",
  name: "North Ward 18",
  areaType: "ward" as const,
};

const riverside = {
  id: "area-riverside",
  name: "Riverside Locality",
  areaType: "locality" as const,
};

const centralMarket = {
  id: "area-central-market",
  name: "Central Market",
  areaType: "locality" as const,
};

export const demoFeed: PostCard[] = [
  {
    id: "post-flooding-01",
    categoryId: "Flooding",
    categoryLabel: "Flooding",
    description:
      "Drainage beside the bus stop has collapsed and every evening the lane floods. School children are walking through contaminated water and bikes keep skidding near the crossing.",
    descriptionExcerpt:
      "Drainage beside the bus stop has collapsed and every evening the lane floods. School children are walking through contaminated water and bikes keep skidding...",
    sourceLanguage: "hi",
    displayLanguage: "en",
    authorAlias: "monsoon-watch",
    area: northWard,
    workflowStatus: "open",
    enrichmentStatus: "completed",
    priorityScore: 94,
    raiseCount: 82,
    commentCount: 27,
    reportCount: 1,
    isAnonymous: true,
    media: [
      {
        id: "media-01",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    createdAt: "2026-03-25T06:05:00.000Z",
    updatedAt: "2026-03-25T07:30:00.000Z",
    rankingReason: {
      localityMatch: "exact",
      engagementWeight: 0.74,
      aiSeverityWeight: 0.82,
    },
    aiAssessment: {
      enrichmentStatus: "completed",
      severity: "critical",
      complexity: "severe",
      hazardTags: ["flood risk", "pedestrian danger", "wastewater"],
      summary:
        "Waterlogging is obstructing a busy pedestrian route and may worsen into a public health issue during the next rainfall.",
    },
  },
  {
    id: "post-safety-02",
    categoryId: "Public Safety",
    categoryLabel: "Public Safety",
    description:
      "Three streetlights have been dead for over a week outside the women’s hostel approach road. The stretch is dark after 8 PM and there are no patrols nearby.",
    descriptionExcerpt:
      "Three streetlights have been dead for over a week outside the women’s hostel approach road. The stretch is dark after 8 PM and there are no patrols nearby.",
    sourceLanguage: "en",
    displayLanguage: "en",
    authorAlias: "lane-signal-12",
    area: riverside,
    workflowStatus: "acknowledged",
    enrichmentStatus: "completed",
    priorityScore: 87,
    raiseCount: 64,
    commentCount: 19,
    reportCount: 0,
    isAnonymous: true,
    media: [
      {
        id: "media-02",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    createdAt: "2026-03-25T04:45:00.000Z",
    updatedAt: "2026-03-25T05:50:00.000Z",
    rankingReason: {
      localityMatch: "nearby",
      engagementWeight: 0.65,
      aiSeverityWeight: 0.58,
    },
    aiAssessment: {
      enrichmentStatus: "completed",
      severity: "high",
      complexity: "moderate",
      hazardTags: ["dark zone", "safety risk"],
      summary:
        "Repeated lack of lighting on a hostel access road raises direct safety concerns, especially for women returning after dark.",
    },
  },
  {
    id: "post-sanitation-03",
    categoryId: "Sanitation",
    categoryLabel: "Sanitation",
    description:
      "Garbage has been piling up behind Central Market for days and now stray animals are tearing open the bags. Vendors are asking for urgent clearance and pest control.",
    descriptionExcerpt:
      "Garbage has been piling up behind Central Market for days and now stray animals are tearing open the bags. Vendors are asking for urgent clearance and pest control.",
    sourceLanguage: "bn",
    displayLanguage: "en",
    authorAlias: "market-whistle",
    area: centralMarket,
    workflowStatus: "in_progress",
    enrichmentStatus: "completed",
    priorityScore: 83,
    raiseCount: 41,
    commentCount: 14,
    reportCount: 0,
    isAnonymous: true,
    media: [
      {
        id: "media-03",
        mediaType: "image",
        url: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80",
      },
    ],
    createdAt: "2026-03-24T22:10:00.000Z",
    updatedAt: "2026-03-25T02:20:00.000Z",
    rankingReason: {
      localityMatch: "exact",
      engagementWeight: 0.48,
      aiSeverityWeight: 0.54,
    },
    aiAssessment: {
      enrichmentStatus: "completed",
      severity: "high",
      complexity: "moderate",
      hazardTags: ["waste accumulation", "animal exposure", "market hygiene"],
      summary:
        "The issue is concentrated near dense commercial activity and is likely to spread health complaints quickly if unaddressed.",
    },
  },
  {
    id: "post-water-04",
    categoryId: "Water Access",
    categoryLabel: "Water Access",
    description:
      "Handpump servicing stopped in our lane and the nearest drinking water point is now more than fifteen minutes away. Elderly residents are depending on paid delivery.",
    descriptionExcerpt:
      "Handpump servicing stopped in our lane and the nearest drinking water point is now more than fifteen minutes away. Elderly residents are depending on paid delivery.",
    sourceLanguage: "hi",
    displayLanguage: "en",
    authorAlias: "silent-witness-44",
    area: northWard,
    workflowStatus: "open",
    enrichmentStatus: "pending",
    priorityScore: 76,
    raiseCount: 22,
    commentCount: 8,
    reportCount: 0,
    isAnonymous: true,
    media: [],
    createdAt: "2026-03-25T08:20:00.000Z",
    updatedAt: "2026-03-25T08:20:00.000Z",
    rankingReason: {
      localityMatch: "exact",
      engagementWeight: 0.26,
      aiSeverityWeight: 0.31,
    },
    aiAssessment: {
      enrichmentStatus: "pending",
      hazardTags: [],
      summary: "Awaiting image scan and translated summary from the worker queue.",
    },
  },
];

export const demoSummary: SummaryOverview = {
  dateRange: {
    from: "2026-03-18",
    to: "2026-03-25",
  },
  totals: {
    totalPosts: 328,
    unresolvedPosts: 201,
    highPriorityPosts: 49,
    resolvedPosts: 92,
  },
  bySeverity: [
    { severity: "critical", count: 14 },
    { severity: "high", count: 35 },
    { severity: "medium", count: 97 },
    { severity: "low", count: 68 },
  ],
  byCategory: [
    { categoryId: "Flooding", label: "Flooding", count: 63 },
    { categoryId: "Sanitation", label: "Sanitation", count: 78 },
    { categoryId: "Public Safety", label: "Public Safety", count: 41 },
    { categoryId: "Water Access", label: "Water Access", count: 29 },
  ],
  byStatus: [
    { status: "open", count: 143 },
    { status: "acknowledged", count: 38 },
    { status: "in_progress", count: 55 },
    { status: "resolved", count: 92 },
  ],
  byArea: [
    {
      area: northWard,
      totals: {
        totalPosts: 119,
        unresolvedPosts: 72,
        highPriorityPosts: 21,
      },
    },
    {
      area: riverside,
      totals: {
        totalPosts: 87,
        unresolvedPosts: 52,
        highPriorityPosts: 17,
      },
    },
    {
      area: centralMarket,
      totals: {
        totalPosts: 61,
        unresolvedPosts: 33,
        highPriorityPosts: 11,
      },
    },
  ],
};

export const DEFAULT_COMPOSER_STATE: ComposerState = {
  categoryId: "Sanitation",
  description: "",
  locationMode: "manual",
  areaId: northWard.id,
  sourceLanguage: "en",
  speechToTextEnabled: false,
  translateEnabled: true,
  isAnonymous: true,
  mediaFiles: [],
};
