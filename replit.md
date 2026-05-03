# LeadPilot 2.0

## Overview
Full-stack B2B prospecting SaaS platform that turns job postings into enriched, pitched, and autonomously-replied-to opportunities.

## Architecture
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui + Three.js/React-Three-Fiber + Framer Motion
- **Backend**: Express + TypeScript (ESM), serves API on port 5000
- **Database**: PostgreSQL via Drizzle ORM (Replit provisioned)
- **Auth**: JWT in httpOnly cookies (7-day expiry)
- **Queue**: BullMQ + Redis (graceful degradation if Redis unavailable)

## Key Design Decisions
- Job-First architecture (Jobs → Companies → Contacts), NOT Company-First
- Every DB query scoped by workspaceId (multi-tenant isolation)
- BYOK (Bring Your Own Keys): AES-256-GCM encrypted API keys (0.1 credit vs 1.0 credit)
- Waterfall enrichment: A-Leads → Prospeo → Apollo → Hunter (stops when verified email found)
- Domain resolver blacklists all job aggregator domains before writing to companies.domain
- Anonymous jobs (Confidential, Stealth Mode) skip enrichment automatically
- Route ordering rule: ALL static routes (e.g. `/stats/overview`, `/export/csv`) MUST come before `/:id` param routes

## Project Structure
```
/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── pages/   # Landing, Login, Signup, app/* pages
│   │   ├── components/ui/   # shadcn/ui components
│   │   ├── components/layout/  # AppLayout with sidebar
│   │   ├── hooks/   # useAuth, useToast
│   │   └── lib/     # api.ts, utils.ts
├── server/          # Express API
│   ├── routes/      # All API route handlers
│   ├── services/    # Business logic (enrichment, scrapers, AI)
│   ├── auth.ts      # JWT auth middleware
│   ├── crypto.ts    # AES-256-GCM encryption
│   └── db.ts        # Drizzle + PostgreSQL
├── shared/
│   └── schema.ts    # Full Drizzle schema (all 14 tables)
├── STARTER_PACK/    # V1 reference code (do not run directly)
└── BRIEF.md         # Full product specification
```

## Running the App
- **Dev**: `npm run dev` — starts Express server on port 5000 (backend) + Vite dev server on port 5173 (frontend)
- The workflow runs both; Vite proxies /api to Express
- **DB migrations**: `npm run db:push`

## Environment Variables
| Variable | Purpose | Required |
|---|---|---|
| DATABASE_URL | PostgreSQL connection | ✅ (Replit provisioned) |
| JWT_SECRET | JWT signing key | Recommended |
| WORKSPACE_ENCRYPTION_KEY | 32-byte hex for AES-256-GCM | Recommended |
| REDIS_URL | BullMQ job queues | Optional (degrades gracefully) |
| OPENAI_API_KEY | AI features (set via BYOK in app) | Optional |
| ANTHROPIC_API_KEY | Alt AI model | Optional |
| STRIPE_SECRET_KEY | Billing | Optional |
| STRIPE_WEBHOOK_SECRET | Stripe webhooks | Optional |
| STRIPE_PRO_PRICE_ID | Stripe Pro plan price ID | Optional |
| STRIPE_AGENCY_PRICE_ID | Stripe Agency plan price ID | Optional |
| FRONTEND_URL | For Stripe redirect URLs | Optional |

## Key Features Built
1. **Landing page**: 3D Three.js SignalNetwork hero (CSS fallback for non-WebGL), bento grid, pricing, FAQ, testimonials, scroll animations throughout
2. **Auth**: Signup/Login/Logout with JWT httpOnly cookies, auto-workspace creation, password show/hide toggle, password strength indicator, autocomplete attributes
3. **Jobs**: Scraping from 5+ platforms, enrichment, filtering, pagination, CSV export (filter-aware), won/lost quick actions, bulk select/delete, live scrape-run status banner
4. **Signals**: Intent signal detection (funding, hiring spike, etc.) with act-on flow, delete support, export CSV (filter-aware: type/strength/search)
5. **Companies**: Auto-created from enrichment, domain blacklist, CSV export (filter-aware: search/industry)
6. **Contacts**: Waterfall enrichment (A-Leads, Prospeo, Apollo, Hunter), champion toggle, CSV export (filter-aware: search/verified/champion)
7. **Outreach**: AI-generated emails (GPT-4o-mini), Compose dialog (contact+job picker, AI generate), Send/Opened/Replied quick-actions, copy-to-clipboard, delete support, export CSV (filter-aware: status/search), clear-filters button
8. **Agent Runs**: Async SDR agent with step-by-step trace, status+approval filters, pagination, cancel support, draft/autonomous split buttons
9. **Settings**: Profile, BYOK API keys (AES-256-GCM), waterfall config, billing (Stripe), notifications (per-toggle save)
10. **Admin**: User/workspace management — promote-to-admin toggle (ShieldCheck/ShieldOff), grant-credits quick-action (Coins), credits+plan editor
11. **Analytics**: Dashboard with funnel bars, area chart (jobs over time), credit meter, recent signals feed, quick-start onboarding banner (empty), quick-actions strip (non-empty)
12. **Billing**: Stripe checkout + customer portal + webhook handler (checkout.session.completed, customer.subscription.deleted)
13. **Keyboard shortcuts**: `?` for help, `S` scrape, `C` compose, `/` search focus, `G+J/D/S/A/C/O` navigation (vim-style)

## Bug Fixes & Audit (Session 16)
- **`server/routes/companies.ts`**: Removed non-existent `employees` and `revenue` columns from SELECT — replaced with actual schema fields `fundingTotal`, `foundedYear`, `tags`
- **`server/routes/analytics.ts`**: Fixed top-companies query — contacts join was on `contacts.companyName` (doesn't exist); fixed to `eq(contacts.jobId, jobs.id)`
- **`client/src/pages/app/Companies.tsx`**: Removed client-side references to `company.employees` and `company.revenue`; replaced with `company.foundedYear` (est. year) and `company.fundingTotal` (formatted dollar amount)
- **`client/src/pages/app/Admin.tsx`**: Full premium redesign — 8 stat cards with gradient-top-border variants, hover-glow, icon containers; search-filtered workspace/user tables with group-hover actions (Coins grant, Pencil edit, ShieldCheck/ShieldOff promote); `EditWorkspaceDialog` for credits + plan editing; admin-only guard redirect
- **`client/src/pages/app/JobDetail.tsx`**: Full premium redesign — gradient-top-border card variants on all sidebar + main cards; `JobNotesCard` with auto-save-on-blur; enrichment status checklist; opportunity score visual bar (color-coded green/yellow/red); company sidebar with favicon; improved contacts panel with confidence badges; outreach history with compose link; copy-job-link button

## UI Redesign (Session 15 — Dark Premium SaaS)
- **Landing page full redesign**: Announcement bar (emerald pulse dot), sticky nav with gradient underline, gradient logo icon, animated gradient headline, "How it works" 3-step section, CSS marquee logo ticker, stat cards with colored glassmorphism backgrounds, comparison table with gradient header row, `gradient-border-wrap` on featured pricing card, testimonials marquee with duplicate rows, FAQ accordion with refined borders, dramatic CTA with animated pulse rings, improved footer layout. All 3D SignalNetwork code preserved intact.
- **AppLayout sidebar redesign**: `bg-[#0d0d12]` background, gradient logo icon, active nav left-bar accent (`absolute w-0.5 h-5 bg-gradient-to-b from-indigo-400 to-violet-500`), shimmer on credits widget, plan-specific colors (free/pro/agency/scale), mobile overlay sidebar
- **Dashboard redesign**: `StatCard` with `gradient-top-border` color variants + `hover-glow`, greeting header, quick-actions strip, onboarding 3-step banner (empty state), activity charts with gradient fills, credit panel with dynamic bar colors, funnel clickable bars, all empty states upgraded
- **App page header upgrades**: All pages (Jobs, Signals, Companies, Contacts, Outreach, AgentRuns, Settings) now have icon wrapped in `w-8 h-8 rounded-lg bg-color-500/10 border border-color-500/20` icon container
- **Card upgrades**: Signal stat cards → `gradient-top-border-yellow`, Outreach stat cards → `gradient-top-border-green`, Company cards → `gradient-top-border-blue`, Contact cards → `gradient-top-border-violet`, AgentRun cards → `gradient-top-border`, Settings billing cards → `gradient-top-border-violet`
- **Empty state upgrades**: All pages now use rounded-2xl with icon in glassmorphism container instead of plain dashed borders
- **Button `gradient` variant**: `bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500` added to button variants
- **CSS utilities** (`client/src/index.css`): `.gradient-top-border`, `.gradient-top-border-green/violet/yellow/blue/pink`, `.shimmer-bg`, `.animate-marquee`, `.gradient-border-wrap`, `.hover-glow`, `.mesh-gradient-orb`
- **Tailwind keyframes** (`tailwind.config.ts`): shimmer, gradient-x, marquee, pulse-ring, count-up, scale-in

## Features Added (Session 14)
- **Low-credits warning** — sidebar credits card turns red (border + text + bar) when credits < 10; shows "Low credits — upgrade plan" micro-label
- **Signals unacted count** — Signals page subtitle now shows unacted count in yellow alongside total signal count
- **Opportunity score color-coding** — Jobs page score badge is green/yellow/red based on value (≥75 green, ≥50 yellow, <50 red)
- **JobDetail opportunity score sidebar card** — visual score bar with High/Moderate/Low fit label; appears when score is set
- **Settings billing Scale plan** — 4th plan (Scale, $799/mo, 50K credits) added to billing tab; grid changed to `md:grid-cols-2 xl:grid-cols-4`
- **Landing Scale plan** — 4th pricing tier (Scale) added to Landing pricing section; grid changed to `md:grid-cols-2 xl:grid-cols-4`
- **Jobs page subtitle fix** — subtitle now properly pluralizes "platforms" and handles 0-platform edge case
- **Settings notifications micro-save** — each toggle saves independently via `PATCH /settings`

## Features Added (Session 12)
- **Signals export CSV** — `GET /api/signals/export/csv` with type/strength/search filter params; Export CSV button in Signals header
- **Outreach export CSV** — `GET /api/outreach/export/csv` with status/search filter params; Export CSV button in Outreach header
- **Contacts export CSV filter-aware** — export now sends active search/verified/champion filters to backend
- **Companies export CSV filter-aware** — export now sends active search/industry filters to backend
- **Login autocomplete** — `autoComplete="email"` + `autoComplete="current-password"` on Login form inputs
- **Signup autocomplete** — `autoComplete="email"` + `autoComplete="new-password"` on Signup form inputs
- **G+key navigation** — vim-style `G J/D/S/A/C/O` keyboard shortcuts navigate between app pages; implemented in KeyboardShortcutsDialog with 1.5s window
- **Keyboard shortcuts expanded** — G J/D/S/A shortcuts listed in help dialog
- **Dashboard quick-actions strip** — shown when workspace is non-empty; pill buttons for Jobs/Contacts/Signals/Outreach/Agent Runs
- **Outreach clear-filters button** — appears when search or status filter is active
- **Landing scroll animations** — staggered `whileInView` + `viewport={{ once: true }}` animations on logo bar, features header, comparison table, testimonials (with hover lift), CTA section
- **Unused DollarSign/Plus import removed** from Dashboard

## Bugs Fixed (T008 Polish Pass — All Sessions)
1. **`getPlatformColor` lowercase normalization** — keys now `.toLowerCase().replace(/[^a-z]/g, "")`
2. **ProfileTab useForm async defaults** — `reset(settings)` in `useEffect` after data loads
3. **NotificationsTab async state** — `useEffect` syncs booleans when settings load
4. **AppLayout credits `parseFloat`** — wrapped `workspace?.credits` in `String()` before parse
5. **Dashboard `w-4.5`** — replaced invalid Tailwind class with `w-4 h-4`
6. **Outreach send button** — wired to `api.patch('/outreach/:id', { status: 'sent' })`
7. **Agent route missing `pages`** — added `pages: Math.ceil(total/limit)` to pagination
8. **Contacts/Companies/Signals/Outreach pagination** — all now include `pages` field
9. **CSV export static routes before `/:id`** — jobs, contacts, companies, signals, outreach all have `/export/csv` placed before `/:id`
10. **Outreach saveMutation TS error** — widened mutationFn param from `"draft"|"sent"` to `string`
11. **Jobs status filter missing "lost"** — added Lost option to Select dropdown

## Features Added (Session 2–3)
- **CSV export** for Jobs, Contacts, Companies — `GET /api/*/export/csv` (5000 row limit)
- **Job status-change dropdown** on JobDetail — inline Select to move jobs through pipeline
- **Outreach quick-actions** — Mark as Opened / Mark as Replied buttons on sent emails
- **Compose Email dialog** — contact+job pickers, AI generation via `/api/outreach/generate`, save draft or send
- **Generate Pitch button** on JobDetail contacts — generates AI pitch and auto-saves as draft in Outreach
- **Outreach stat cards clickable** — click Draft/Sent/Opened/Replied to filter list
- **Won/Lost quick-action buttons** on Jobs page job cards
- **Bulk select + delete** on Jobs page with "select all on page" checkbox
- **Signal delete** — Trash2 button + `DELETE /api/signals/:id`
- **Outreach delete** — Trash2 button + `DELETE /api/outreach/:id`
- **Admin credit + plan editor** — unified `PATCH /api/admin/workspaces/:id` accepting both `credits` and `plan`
- **AgentRuns filters** — status + approval mode filters, pagination, expand/collapse steps
- **Dashboard onboarding banner** — shown only when workspace is empty (no jobs)
- **Copy-to-clipboard** on outreach email cards — shows checkmark confirmation for 2 seconds
- **Scrape-run live status banner** on Jobs page — polls every 3s when running, shows new/found counts when complete

## Enrichment Orchestrator
- Waterfall: A-Leads → Prospeo → Apollo → Hunter
- Stops after first provider returns contacts
- A-Leads: domain-only, no job_title filter, ≥10 contacts
- All providers: graceful error handling, returns empty on failure
- Saves contacts with dedup on email

## Features Added (Session 18)
- **Dashboard dual-chart** — Jobs discovered + Outreach sent stacked area charts in one card; outreach chart only renders if data exists
- **Dashboard outreach query** — `outreachOverTime` pre-fetched from `/analytics/outreach-over-time`
- **Signals hide-acted-on toggle** — "Hide acted on" button (indigo when active); client-side filters already-acted signals; renamed `signals` → `allSignals` + derived `signals`
- **Signals stat cards bg** — active type filter card gets `bg-indigo-500/5` highlight
- **Signals strong count** — red `X strong` sub-label shown below count when > 0
- **Jobs quick presets expanded** — 10 presets total (added TypeScript, Full-stack, SaaS sales, Framer, Webflow)
- **Jobs contact-found badge** — green `✓ Contact` badge shown in job card when `contactFound === true`
- **Outreach toEmail display** — "To: email@example.com" shown in indigo below subject in outreach cards
- **Outreach POST auto-populate toEmail** — server-side: if no `toEmail` sent, looks up contact email and writes it
- **Outreach generate route pitch config** — now passes `calendarUrl`, `portfolioUrl`, `linkedinUrl`, `tone` to PitchGenerator
- **Contacts enrichment provider color badges** — violet=aleads, blue=prospeo, orange=apollo, yellow=hunter, pink=rocketreach, zinc=manual
- **Companies employees + revenue** — employees count and revenue shown in company cards
- **Companies LinkedIn link** — `<a>` with ExternalLink icon next to company name when `linkedinUrl` set
- **JobDetail company sidebar** — `employees`, `revenue`, `fundingStage` rows added to company sidebar card
- **Settings profile calendarUrl** — `profileCalendarUrl` field added to schema + DB migration + Settings form
- **Admin stats outreach count** — 8th stat card "Outreach sent" added (uses `outreach` table count)
- **Admin stats grid** — now shows 8 stats including Mail icon for Outreach
- **Admin import fix** — `outreach` table imported in admin.ts
- **AgentRuns approve button** — "Save to Outreach" green CTA on runs with emailDraft + contactId
- **AgentRuns draft preview** — body preview (120 chars) shown below subject

## Features Added (Session 19–20)
- **Jobs contactFoundOnly filter** — server-side `contactFound` boolean Zod param wired into `listQuerySchema`; "Contact found" violet filter button in Jobs page; CSV export passes `contactFound=true` when active; Jobs empty state detects filter and shows "Clear all filters" button
- **Outreach GET enriched join** — GET /api/outreach now batch-joins contact name (fullName/firstName+lastName) + job title + companyName; outreach cards show "To: Name <email>", "Re: jobTitle @ company"
- **Outreach empty state** — distinguishes "No matching outreach" (with Clear filters CTA) vs "No outreach yet" (with Compose CTA)
- **Settings SMTP test button** — "Test connection" button in SMTP card calls POST /api/settings/test-smtp; server dynamically imports nodemailer, calls transporter.verify(), returns 200 or 400 with error message
- **Jobs CSV contactFound filter** — Jobs CSV export URL now includes `contactFound=true` when filter is active; server-side CSV route also filters by `contactFound` boolean
- **Dashboard credits-over-time chart** — new AreaChart showing credit usage last 30 days (only renders when data exists); uses existing recharts AreaChart/Area/XAxis/YAxis/Tooltip/ResponsiveContainer imports
- **Landing FAQ 2 more items** — enrichment providers (waterfall order + BYOK savings) and agency use case (unlimited workspaces, white-label) added; FAQ now 10 items
- **Landing CTA trust badges** — 4 badges below CTA button: SOC 2 compliant, GDPR ready, AES-256 encryption, 99.9% uptime SLA
- **Admin workspace ID snippet** — workspace row now shows first 8 chars of UUID in zinc for quick copy reference
- **Companies tech stack +N overflow** — shows first 3 tech stack badges then "+N more" when techStack has >3 items
- **AgentRuns approval-pending glow** — completed runs with emailDraft+contactId get `ring-1 ring-green-500/30` wrapper to draw attention to "Save to Outreach" CTA
- **JobDetail contact list improvements** — LinkedIn ExternalLink button per contact; email confidence percentage badge shown when >0
- **Signals empty state improved** — "All signals acted on" variant text + "Show all signals" link when hideActed is active
- **JobDetail contact enrichment** — contactFoundOnly cleared on "Clear all filters" in Jobs empty state

## Features Added (Session 16–17)
- **Jobs remote filter toggle** — "🌐 Remote only" button in Jobs page filter bar; passes `remote=true` to server; `listQuerySchema` has `remote: z.coerce.boolean().optional()`
- **Pitch generator follow-up AI** — `generateFollowUp` upgraded with OpenAI support + 3 randomized bump phrases + optional config param
- **Outreach route jobId filter** — `GET /api/outreach` now accepts `jobId` query param for per-job outreach history
- **Analytics outreach-over-time** — `GET /api/analytics/outreach-over-time` returns daily sent+replied counts (30 days)
- **Analytics credits-over-time** — `GET /api/analytics/credits-over-time` returns daily credit usage (30 days)
- **Dashboard outreach-over-time query** — pre-fetches outreach chart data ready for visualization
- **Admin workspaces per-workspace counts** — GET /api/admin/workspaces now enriches each workspace row with jobCount + contactCount
- **Admin workspace row UI** — shows job count (`Xj`) and contact count (`Xc`) in workspace row subtitle
- **Landing comparison table** — 4 new rows: AES-256 encrypted key vault, autonomous follow-up, CSV export, free tier no card
- **AgentRuns approve button** — "Save to Outreach" green button on runs with emailDraft + contactId; saves to outreach as draft
- **AgentRuns draft preview** — body preview (120 chars) shown below subject in generated draft section
- **Signals stat cards** — strong count shown in red below type count when > 0; active type filter highlighted with indigo bg
- **Settings profile calendar URL** — new `profileCalendarUrl` field in Profile tab (below LinkedIn)
- **Dashboard outreach query** — `outreachOverTime` query wired up

## Features Added (Session 21)
- **Companies sort filter** — "Newest first / Oldest first / Name A–Z / Most contacts" selector in Companies page; server-side `orderByClause` maps sort param to Drizzle expressions; also returns `employees`, `revenue`, `linkedinUrl` fields
- **Companies empty state filter-aware** — "No matching companies" text + "Clear filters" button when search/industry filters are active
- **Contacts sort filter** — 4-way sort (newest/oldest/name/confidence) in Contacts page + server-side `asc(fullName)` / `emailConfidence desc nulls last` ordering
- **Contacts empty state filter-aware** — "No matching contacts" + "Clear filters" button
- **Contacts email confidence badge** — color-coded pill: green ≥90%, yellow ≥70%, gray otherwise (instead of plain "(X% conf)" text)
- **Outreach stats rate sub-labels** — Opened card shows "X% open", Replied shows "X% reply" sub-label; now using variable per-card logic instead of repeated map
- **Outreach ComposeDialog URL param pre-population** — auto-reads `?jobId=&contactId=` from URL; `useSearch` hook syncs state on dialog open; OutreachPage auto-opens compose dialog when URL has these params
- **JobDetail Outreach card always shown** — moved from conditional to always-rendered with empty state "No outreach sent for this job yet" + Compose button pre-filled with jobId; "View all →" link only shown when entries exist
- **JobDetail Outreach → Compose link** — "Outreach" button in contact list now links to `/app/outreach?jobId=X&contactId=Y`
- **JobDetail Plus import** — added `Plus` to lucide imports
- **AgentRuns filter-aware empty state** — "No matching runs" + "Clear filters" button when status/approval filters active; "Start run" CTA only in true empty state
- **Admin users enriched** — `/api/admin/users` now joins workspace name + plan per user; user rows show workspace name subtitle + plan badge (Pro/Agency/Scale) on hover
- **Admin users limit** — raised from 100 to 200
- **Settings Notifications** — 2 more notification toggles: "Agent run complete" + "Credit balance low"
- **Landing logo bar** — swapped generic brand names for more realistic B2B SaaS names (Rippling, Loom, Superhuman, Retool, Coda, Segment, Pendo, Brex)
- **Dashboard recent outreach section** — added parallel "Recent outreach" card next to "Recent jobs" (both in 2-col grid); shows real outreach items with status badges + open/reply rate footer
- **Analytics dashboard** — now fetches `recentOutreach` (5 latest emails) and includes in response as `recent.outreach`
- **Signals empty state filter-aware** — "No matching signals" + "Clear all filters" button covering search/type/strength/hideActed
- **Dashboard DashboardData type** — added `outreach: any[]` to `recent` field

## Features Added (Session 23 — Diamond Features Blitz)
- **Global search (⌘K omnibar)** — `GlobalSearch.tsx` + `GET /api/search?q=` endpoint; cross-entity search across jobs, contacts, companies; keyboard navigation (↑↓ enter esc); debounced 200ms; result sections with icons, badges, favicon; integrated into AppLayout sidebar
- **Notification center** — `NotificationCenter.tsx` bell icon with unread badge in AppLayout sidebar; shows pending agent-approval drafts + recent unacted signals; links to agent/signals pages; auto-dismisses when dropdown closes
- **Kanban board view for Jobs** — `KanbanBoard.tsx` renders 7 columns (new/classified/enriched/pitched/replied/won/lost) with drag-free move buttons; shows all 200 jobs at once; hover-reveal actions (← back, Enrich, → advance, Won); wired into Jobs.tsx with List/Kanban toggle buttons (LayoutGrid + List icons)
- **Email preview modal** — `EmailPreviewModal.tsx` renders email with greeter/body/link highlighting; word/char count; copy-to-clipboard; metadata (to, subject, sent/opened/replied times); triggered by Expand icon on each outreach row
- **Contact timeline modal** — `ContactTimelineModal.tsx` shows full outreach history for a contact in a vertical timeline; dots colored by status (sent/opened/replied); triggered by Clock icon button on each contact row in Contacts page
- **Agent runs CSV export** — client-side CSV generation from paginated `/agent/runs` response; Download icon button in AgentRuns header; exports ID, job title, status, mode, steps completed, created/completed timestamps
- **Onboarding checklist widget** — `OnboardingChecklist` component on Dashboard; 4-step progress (scrape jobs → find contact → send email → run agent); collapsible + dismissible (localStorage); progress bar; auto-hides when all 4 steps completed
- **Webhook event log in Admin** — `WebhookEventLog` component at bottom of Admin page; expandable accordion per endpoint; shows URL, events array, last-fired time, active status; refresh button
- **Outreach contactId filter** — `GET /api/outreach` now accepts `?contactId=` query param; powers the contact timeline modal outreach history
- **Schema additions** — `jobs.notes`, `outreach.toEmail`, 13 workspace settings fields (smtp, sender, notifications) already pushed via `npm run db:push`

## Fixes Applied (Session 22 — Final Polish)
- **React hooks violation fixed** — `useState` (copiedContactEmail, copiedLink) and `useQuery` (relatedOutreach) in `JobDetail.tsx` were called AFTER an early `if (isLoading)` return, violating the Rules of Hooks. Moved all three above the early return.
- **TypeScript clean** — `npx tsc --noEmit` passes with zero errors across all files.
- **HMR clean** — all HMR updates confirmed clean in browser console; no React errors.
- **WebGL fallback** — `CSSGlobeFallback` renders correctly in Replit preview (WebGL unavailable expected); `WebGLErrorBoundary` catches Three.js errors silently.
- **Comprehensive surface audit** — all major app surfaces re-verified: Dashboard, Jobs, JobDetail, Signals, Companies, Contacts, Outreach, AgentRuns, Settings (all tabs), Admin, AppLayout/Sidebar, Landing page, ErrorBoundary.

## Tested Endpoints (all 200 ✅)
- Auth: login, signup, /me, logout, switch-workspace
- Jobs: list (with remote filter), stats/overview, export/csv, get-by-id, create, patch, delete, bulk-delete
- Companies: list, export/csv, get-by-id, patch, delete
- Contacts: list, export/csv, get-by-id, patch, mark-champion, delete
- Signals: list, stats (byType + strong counts), bulk-act, export/csv, create, act, delete
- Outreach: list (with jobId filter), stats, export/csv, create, patch, generate, delete
- Analytics: dashboard, jobs-over-time, outreach-over-time, credits-over-time
- Settings: get/patch settings, api-keys CRUD + test, waterfall CRUD
- Agent: list runs, create run, get run, cancel run, retry run
- Scrape: platforms, post scrape, list runs, get run
- Billing: plans, create-checkout, portal, webhook
- Admin: stats, workspaces (with per-workspace job+contact counts), users, patch credits/plan, promote user, grant credits

## Test Credentials
- Email: test@leadpilot.io
- Password: Test1234!
- Workspace ID: 2fbbe5e0-6e47-44a2-9dbe-a6ea3a017300

## Critical Implementation Notes
- A-Leads: never filter by job_title, fetch ≥10 contacts, domain-only search
- Domain resolver: blacklists 25+ job aggregator domains
- Anonymous jobs: skip enrichment for Confidential/Stealth postings
- Every query includes workspaceId (cross-workspace isolation)
- Pagination on all list endpoints (LIMIT/OFFSET), always include `pages` in response
- Settings split into tabs (Profile, API Keys, Waterfall, Billing, Notifications)
- `api.delete()` method confirmed present in `client/src/lib/api.ts`
- Checkbox component at `client/src/components/ui/checkbox.tsx` using `@radix-ui/react-checkbox`
- Admin route: unified PATCH `/api/admin/workspaces/:id` accepts both `credits` and `plan`
- KeyboardShortcutsDialog uses `useLocation` from wouter for G+key navigation
