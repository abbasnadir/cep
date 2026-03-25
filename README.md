# Civic Issue Reporting Platform

This repository contains the design and scaffolding for an anonymous civic issue reporting platform where citizens can surface real-world problems in real time and institutions can act on them responsibly.

Users can sign in with Supabase, publish posts about civic challenges, attach media, comment, raise issues, and report abusive content. NGOs and government institutions use the same product, but with role-based access to richer summaries, exact-location detail, and triage workflows. Post priority is influenced by locality relevance, community engagement, and AI-generated severity signals from uploaded images and translated text.

## Product Goals

- Let citizens report local problems without exposing their identity.
- Help NGOs and government teams discover urgent issues faster.
- Rank the feed using community signals and geographic relevance rather than pure recency.
- Support multilingual reporting with optional speech-to-text and translation helpers.
- Enrich posts asynchronously so publishing stays fast even when AI checks are involved.

## Core Capabilities

- Supabase-backed authentication for citizens, NGOs, and government staff
- Anonymous-by-default public profiles with minimal stored identity metadata
- Ranked issue feed with filters for area, category, status, and sort mode
- Post creation with optional media, auto-detected or manual location, translation, and speech-to-text helpers
- Comments, raises, and reports on issue posts
- Institution-only post detail and aggregated summaries by area, category, severity, and status
- Background enrichment pipeline for image analysis, translation, severity scoring, and summary refreshes

## Architecture

### Frontend

The `client/` app is a Next.js application that will host:

- Citizen sign in and onboarding
- Ranked home feed
- Post creation and detail pages
- Logout and authenticated profile flows
- NGO and government dashboards behind role checks

### Backend

The `server/` app is an Express API that will:

- Validate Supabase JWTs
- Enforce role-based access rules
- Accept post, comment, raise, and report actions
- Build ranked feed responses
- Expose institution-only summaries and detailed triage views
- Coordinate asynchronous enrichment jobs and summary refreshes

### Data Layer

Supabase provides:

- Authentication
- Postgres for app data
- Storage for uploaded media
- Row-level security for sensitive records

The design assumes an app-owned schema around Supabase Auth with tables for profiles, posts, media, AI assessments, comments, raises, reports, status history, area hierarchy, and institution tracking.

## Privacy Model

- Citizens are represented publicly by aliases, not by legal names or emails.
- Exact coordinates are stored privately and only exposed to verified institution roles.
- Registration stores the minimum needed to operate the platform safely.
- Moderation data and abuse reports are hidden from normal citizens.
- Institution access depends on a verified role flag and organization linkage.

## Ranking Model

Feed ranking is configurable, but the first implementation should combine:

- Locality match: exact locality first, then nearby administrative areas, then global posts
- Raises: community validation that an issue affects more people
- Comment activity: active discussion can indicate urgency or ongoing impact
- AI severity: image and text enrichment can raise the priority of more complex or hazardous issues
- Freshness: newer issues are easier to discover when all else is similar

## Repository Layout

- [`design/`](./design/): product, API, database, user-flow, and constraint documents
- [`client/`](./client/): Next.js frontend scaffold
- [`server/`](./server/): Express backend scaffold

## Design Source Of Truth

Use the design folder as the implementation reference:

- [`design/api-design.yml`](./design/api-design.yml): external API contract
- [`design/dbDesign.md`](./design/dbDesign.md): relational model and key entity relationships
- [`design/userflow.md`](./design/userflow.md): user and system journeys
- [`design/constraints.md`](./design/constraints.md): privacy, ranking, AI, and operational constraints
- [`design/features.md`](./design/features.md): scoped functionality by phase
- [`design/databaseFeatures.md`](./design/databaseFeatures.md): persisted, derived, and sensitive data inventory

## Delivery Notes

The current repository still contains starter frontend and backend scaffolding. The intended implementation direction is to expand the existing Next.js and Express apps rather than starting over from scratch.

The first implementation pass should keep AI integrations pluggable. Image analysis, translation, and severity scoring are modeled as asynchronous enrichment jobs so posts can appear immediately in the feed with `enrichment_status = pending`.

## Acceptance Checklist

- A citizen can sign up or log in with Supabase and fetch `/me`.
- A citizen can create a post with manual or detected location and optional media.
- Newly created posts appear immediately in the feed while enrichment is pending.
- Background processing updates translations, severity, hazard tags, and priority score without creating duplicate posts.
- Raises, comments, and locality relevance visibly influence feed order.
- Public post responses hide exact coordinates and private moderation metadata.
- Institution-only endpoints expose exact location and richer summary data to verified roles only.
- Reports, comments, and raises are handled safely and without duplicate side effects where idempotency is required.
- Summary endpoints can return totals by area, category, status, severity, and time window.

## Next Steps

1. Implement the documented API routes in the Express route-object structure already present in `server/src/routes`.
2. Add Supabase schema migrations for the entities in `design/dbDesign.md`.
3. Build role-based Next.js screens for citizen and institution workflows.
4. Introduce a worker or job runner for asynchronous enrichment and summary refreshes.
