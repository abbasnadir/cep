# Database Feature Inventory

This document separates what the platform stores permanently from what it derives for ranking, dashboards, and moderation.

## Persisted Core Data

- Auth identities in Supabase Auth
- User profiles with public alias, role, preferred language, anonymity defaults, home area, and institution linkage
- Institution organization records and verification state
- Geography hierarchy for countries, states, cities, wards, and localities
- Problem categories and status taxonomy
- Posts with author linkage, area linkage, sanitized location labels, exact coordinates, language metadata, and publish state
- Media metadata for uploaded images or videos
- Comments, raises, and abuse reports
- Post lifecycle history such as open, acknowledged, in progress, resolved, and rejected
- Institution case-tracking and ownership metadata
- Audit timestamps for every mutable entity

## Persisted AI And Moderation Data

- Enrichment status per post
- Image-derived severity, complexity, hazard tags, and confidence
- Translated text and normalized language metadata
- Moderation state for uploaded media
- Abuse report reasons, reporter id, and review status
- Model metadata such as provider, version, and last processed timestamp

## Derived Or Aggregated Data

- Feed priority score
- Area relevance score used for ranking
- Per-post engagement counters such as comment count and raise count
- Daily or periodic summary rows for dashboards
- Institution-facing overview metrics by area, category, status, and severity
- Cached or materialized slices for trending or unresolved issues

## Sensitive Or Restricted Data

- Email addresses and authentication-linked identity data
- Exact coordinates and location confidence
- Institution verification notes
- Moderation flags and internal review decisions
- Abuse report contents and reporter identity
- AI confidence values when they could expose moderation heuristics or trigger gaming

## Suggested Data Ownership

- `profiles`, `posts`, `post_comments`, `post_raises`, and `post_reports` are the core transactional tables
- `post_ai_assessments`, `daily_post_summaries`, and ranking projections are system-managed tables or views
- `institution_case_views` or `institution_assignments` are private operational tables for NGO and government users
- Row-level security policies should distinguish:
  - public-readable post fields
  - citizen-owned write access
  - institution-only read access
  - service-role-only enrichment and aggregation writes
