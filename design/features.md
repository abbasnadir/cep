# Features

## V1

- Supabase authentication for citizens, NGOs, and government staff in one shared app
- Public feed served directly on `/`, with `/feed` retained as a compatible alias
- Front-page AI civic assistant chatbot that answers user questions, explains platform capabilities, guides users to reporting and institution workflows, and helps users discover the right next action without replacing formal issue-post creation
- Anonymous-by-default citizen profiles with public alias, preferred language, and home area
- Ranked issue feed with filters for area, category, status, and sort mode
- Issue post creation with:
  - text description
  - optional image upload to Supabase Storage
  - auto-detected or manual location
  - optional speech-to-text helper
  - optional translation helper
  - problem category selection
- Public post detail with sanitized area labels, engagement counts, and enrichment state
- Raise, comment, report post, and report image actions on posts
- Institution-only post detail with exact coordinates, AI severity breakdown, and moderation state
- Institution summary views for counts by status, area, category, severity, and time window
- Role-tiered institution dashboard access:
  - NGO staff can maintain case progress and internal response notes for their organization
  - government staff can additionally move public workflow status through acknowledgement, in-progress, and resolution
  - admins can additionally review reported posts, moderate report queues, and reassign organization ownership
- Admin moderation queue for pending reported posts inside the institution dashboard
- Institution case and workflow mutations backed by audit-safe status history
- Background enrichment jobs for:
  - image severity and complexity analysis
  - translation normalization
  - post priority recalculation
  - summary refreshes
- Supabase Storage-backed media handling
- Role checks and row-level security for private and institution-only data

## Later

- Notifications for status changes, comments, and escalations
- Saved filters and followed areas for institutions
- Citizen post editing windows with audit-safe revision history
- Map-based exploration of issue clusters
- SLA and response-time tracking for institutional teams
- Real-time feed refresh and live comment updates

## Aspirational

- Cross-city and national issue heatmaps
- Predictive prioritization based on seasonal and infrastructure patterns
- AI-assisted duplicate issue clustering
- Voice-first reporting flows for low-literacy or accessibility-focused users
- Offline-first mobile capture with delayed sync
- Community verification badges for recurring trusted reporters while preserving anonymity
- Institution collaboration threads across NGO and government responders
