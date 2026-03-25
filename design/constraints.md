# Design Constraints

## Privacy And Identity

- Citizen-facing posts must never reveal legal names, emails, or phone numbers.
- Public APIs must expose only an alias snapshot and sanitized area label for citizen-authored posts.
- Exact coordinates may be stored for ranking and response operations, but only verified institution roles can retrieve them.
- Registration should store the minimum identity-linked metadata needed to support authentication, abuse handling, and auditability.
- Anonymous posting is the default. Opting out of anonymity should be an explicit product decision in a later phase, not an accidental side effect of profile design.

## Roles And Access

- One app serves all users, but route and data access are role-based.
- Institution-only endpoints require both a role in `profiles` and a verified organization relationship.
- Moderation metadata, abuse reports, and internal case-tracking data stay hidden from citizens.
- Row-level security must protect private tables and private columns where possible.

## Feed And Ranking

- Ranking should prioritize locality first, then community engagement, then AI severity and freshness.
- Exact locality matches rank above broader-area matches, which rank above global or unknown-area posts.
- Raises and recent comment activity can increase priority, but they must not be the only signal or the feed becomes popularity-only.
- Ranking behavior should be configurable and explainable; do not hardcode vendor-specific AI semantics into the public API contract.

## Post Creation And Enrichment

- Publishing a post must remain fast. Translation, image assessment, and severity analysis run asynchronously after the initial write.
- Speech-to-text and translation are optional helpers, not blockers to post creation.
- Posts created before enrichment completes must still be visible with `enrichment_status = pending`.
- AI-derived severity informs priority but does not replace moderation decisions.
- Severe civic issues and abusive content are different concerns and must be modeled separately.

## Data And Storage

- Supabase Auth remains the identity source of truth.
- Uploaded media should live in Supabase Storage, while application tables store metadata and moderation state.
- Summary dashboards should use pre-aggregated tables or materialized views for predictable performance.
- Derived ranking scores can be cached or materialized, but source engagement events must remain auditable.

## Operational Constraints

- The backend must continue using the existing Express route-object pattern unless a future refactor is explicitly planned.
- The frontend should evolve from the current Next.js scaffold instead of introducing a second app for institutions.
- Background jobs are required for enrichment and summary refreshes; a queue or worker abstraction should be designed early even if the first runtime is simple.
- APIs should remain usable in low-bandwidth scenarios with paginated lists, compact cards, and progressive detail loading.
