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

## Key Features Built
1. **Landing page**: 3D Three.js globe hero, bento grid, pricing, FAQ, testimonials
2. **Auth**: Signup/Login/Logout with JWT cookies, auto-workspace creation
3. **Jobs**: Scraping from 5+ platforms, enrichment, filtering, pagination
4. **Signals**: Intent signal detection and display (funding, hiring spike, etc.)
5. **Companies**: Auto-created from enrichment with domain blacklist
6. **Contacts**: Waterfall enrichment (A-Leads, Prospeo, Apollo, Hunter)
7. **Outreach**: AI-generated emails using GPT-4o-mini
8. **Agent Runs**: Async SDR agent with step-by-step trace
9. **Settings**: Profile, BYOK API keys, waterfall config, billing, notifications
10. **Admin**: User/workspace management (admin-only)
11. **Analytics**: Dashboard with funnel, charts, credit tracking
12. **Billing**: Stripe checkout + customer portal

## Bugs Fixed (T008 Polish Pass)
1. **Critical route-ordering bug in `server/routes/jobs.ts`**: `GET /stats/overview` and `POST /bulk-delete` were defined AFTER `GET /:id`, causing Express to capture "stats" as a job ID and return 404. Both static routes moved before `/:id`.
2. **`bufferAttribute` duplicate props in `Landing.tsx`**: Had both `args={[positions, 3]}` AND `count/array/itemSize` props simultaneously — removed the redundant `args` prop to use the explicit props-only form expected by React-Three-Fiber.

## Tested Endpoints (all 200 ✅)
- Auth: login, signup, /me, logout, switch-workspace
- Jobs: list, stats/overview, get-by-id, create, patch, delete, bulk-delete
- Companies: list, get-by-id, patch
- Contacts: list, get-by-id, patch, mark-champion
- Signals: list, stats, create, act
- Outreach: list, stats, create, patch, generate
- Analytics: dashboard, jobs-over-time
- Settings: get/patch settings, api-keys CRUD + test, waterfall CRUD
- Agent: list runs, create run, get run, cancel run
- Scrape: platforms, post scrape, list runs, get run
- Billing: plans, create-checkout, portal
- Admin: stats, workspaces, users, patch credits/plan

## Lessons from V1 Applied
- A-Leads: never filter by job_title, fetch ≥10 contacts, domain-only search
- Domain resolver: blacklists 25+ job aggregator domains
- Anonymous jobs: skip enrichment for Confidential/Stealth postings
- Every query includes workspaceId (cross-workspace isolation)
- Pagination on all list endpoints (LIMIT/OFFSET)
- Settings split into tabs (Profile, API Keys, Waterfall, Billing, Notifications)
