# LeadPilot 2.0 — Complete Build Brief

> **Read this entire file before writing any code.** It contains the full product spec, tech stack, database schema, pricing model, API integrations, design system, lessons learned, and build order. The previous version of this app exists at `client-hunter-pro.replit.app` — this is a clean rebuild that keeps what works and replaces what doesn't.

> **🔑 Companion folder: `STARTER_PACK/`** — Contains battle-tested code from v1 (scrapers, A-Leads with fixes, domain resolver with blacklist, classification prompts, Python microservice). **Read `STARTER_PACK/README.md` before writing ANY scraper, enrichment, classification, or domain-resolution code.** Port the proven implementations instead of rebuilding from scratch — saves 4-6 weeks.

---

## 1. Vision & Positioning

**One-liner:** The only B2B prospecting platform that turns every new job posting into an enriched, pitched, autonomously-replied-to opportunity — powered by intent signals.

**Who it's for:**
- Recruiting agencies hunting new client companies
- B2B service agencies (dev shops, marketing agencies, consultancies)
- Solo freelancers and fractional executives
- Sales teams at SMBs

**The unique moat:** 30+ job board scrapers (existing) + intent signal layer (funding, job changes, hiring spikes) + agentic AI SDR loop + waterfall enrichment with BYOK. No competitor stacks all four at SMB pricing.

**The category positioning:** "Apollo + Clay + Artisan, but signal-first and 1/5 the price."

---

## 2. Tech Stack (lock these versions)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast HMR, modern |
| Styling | TailwindCSS + shadcn/ui | Component velocity |
| Routing | wouter | Lightweight, no React Router bloat |
| Forms | react-hook-form + zod | Type-safe |
| Data fetching | @tanstack/react-query v5 | Object-form API |
| 3D / Animation | Three.js + @react-three/fiber + @react-three/drei + Framer Motion + GSAP | Landing page hero + scroll |
| Backend | Express + TypeScript | Same as v1, proven |
| Database | PostgreSQL (Replit built-in) | |
| ORM | Drizzle | Type-safe, no codegen |
| Auth | JWT in httpOnly cookie + Replit Auth optional | Same pattern as v1 |
| Billing | Stripe (subscriptions + metered usage) | Standard |
| AI | OpenAI (GPT-5 default, GPT-4o-mini fallback) + Anthropic Claude (user-selectable) | Model choice = differentiator |
| Job scraping | Python microservice (python-jobspy) — keep from v1 | 30+ sources already work |
| Background jobs | BullMQ + Redis (use Replit's Redis) | For agentic loops, scrapes |
| Email sending | Postmark (transactional) + integrations to Smartlead/Instantly (cold outreach) | Don't build deliverability |

---

## 3. Pricing Model — Hybrid Credits + BYOK

**Three tiers + BYOK overlay:**

| Tier | Price | Credits/mo | Workspace seats | BYOK |
|---|---|---|---|---|
| **Free** | $0 | 50 | 1 | ✅ |
| **Pro** | $79/mo | 2,000 | 3 | ✅ |
| **Agency** | $249/mo | 10,000 | 10 | ✅ |
| **Scale** | Custom | 50K+ | unlimited | ✅ + dedicated support |

**Credit costs:**
- 1 credit = 1 enriched contact (managed waterfall)
- 0.1 credit = 1 BYOK contact (user's own keys, platform fee only)
- 5 credits = 1 AI agent reply cycle (research + write + send)
- 0.5 credit = 1 intent signal lookup
- Free for: job scrapes, dashboard views, classification

**Stripe setup:**
- Subscription products for each tier
- Metered billing for credit overages ($0.05/credit)
- Customer portal for self-serve plan changes
- Webhook handler at `/api/stripe/webhook` for `customer.subscription.*`, `invoice.*`

---

## 4. Database Schema (full Drizzle code)

> **Critical changes from v1:** UUIDs everywhere, workspaces (not solo users), encrypted API keys, usage table, intent signals, waterfall configs, agent runs.

```typescript
// shared/schema.ts
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, uuid, integer, boolean, timestamp, jsonb, decimal, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// ENUMS
// ============================================
export const planTier = pgEnum("plan_tier", ["free", "pro", "agency", "scale"]);
export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
export const signalType = pgEnum("signal_type", ["funding", "job_change", "hiring_spike", "tech_install", "expansion", "leadership_change"]);
export const agentStatus = pgEnum("agent_status", ["idle", "running", "paused", "completed", "failed"]);
export const enrichmentProvider = pgEnum("enrichment_provider", ["apollo", "hunter", "prospeo", "rocketreach", "aleads", "anymailfinder", "snov", "clearbit", "byok_apollo", "byok_hunter", "byok_prospeo"]);

// ============================================
// USERS — individuals (auth identity only)
// ============================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }), // null if oauth
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// WORKSPACES — the billing/data boundary (B2B SaaS)
// ============================================
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  plan: planTier("plan").default("free").notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  creditsRemaining: integer("credits_remaining").default(50).notNull(),
  creditsResetAt: timestamp("credits_reset_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// WORKSPACE MEMBERS — many-to-many
// ============================================
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: memberRole("role").default("member").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  joinedAt: timestamp("joined_at"),
});

// ============================================
// API KEYS (BYOK) — encrypted at rest
// ============================================
export const workspaceApiKeys = pgTable("workspace_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  provider: enrichmentProvider("provider").notNull(),
  label: varchar("label", { length: 100 }),
  encryptedKey: text("encrypted_key").notNull(), // AES-256 encrypted
  keyHint: varchar("key_hint", { length: 20 }), // last 4 chars for UI display
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  totalCalls: integer("total_calls").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// WATERFALL CONFIGS — user-defined enrichment cascade
// ============================================
export const waterfallConfigs = pgTable("waterfall_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false),
  // ordered array of provider strategies
  // [{ provider: "apollo", useByok: true, stopOnFound: true }, ...]
  steps: jsonb("steps").$type<Array<{ provider: string; useByok: boolean; stopOnFound: boolean; minConfidence?: number }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// JOBS — primary entity (kept from v1, modernized)
// ============================================
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  budgetType: varchar("budget_type", { length: 20 }),
  platform: varchar("platform", { length: 50 }).notNull(),
  externalId: varchar("external_id", { length: 500 }),
  sourceUrl: varchar("source_url", { length: 2000 }),
  postedAt: timestamp("posted_at"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  companyName: varchar("company_name", { length: 255 }),
  companyDomain: varchar("company_domain", { length: 255 }),
  location: varchar("location", { length: 255 }),
  remote: boolean("remote").default(false),
  // enrichment state
  domainResolved: boolean("domain_resolved").default(false),
  domainConfidence: integer("domain_confidence"),
  contactFound: boolean("contact_found").default(false),
  // classification (GPT)
  jobType: varchar("job_type", { length: 30 }),
  classificationConfidence: integer("classification_confidence"),
  goodForAgency: boolean("good_for_agency"),
  classified: boolean("classified").default(false),
  // outreach state
  contacted: boolean("contacted").default(false),
  responseReceived: boolean("response_received").default(false),
  outcome: varchar("outcome", { length: 50 }),
  // intent signal cross-reference
  hasActiveSignal: boolean("has_active_signal").default(false),
  searchTerm: varchar("search_term", { length: 255 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// COMPANIES — enrichment layer
// ============================================
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  website: varchar("website", { length: 500 }),
  industry: varchar("industry", { length: 100 }),
  size: varchar("size", { length: 50 }),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  // intent enrichment
  lastFundingAmount: integer("last_funding_amount"),
  lastFundingDate: timestamp("last_funding_date"),
  lastFundingStage: varchar("last_funding_stage", { length: 50 }),
  employeeCount: integer("employee_count"),
  techStack: text("tech_stack").array(),
  totalJobsPosted: integer("total_jobs_posted").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// CONTACTS — decision makers
// ============================================
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  fullName: varchar("full_name", { length: 255 }),
  title: varchar("title", { length: 255 }),
  department: varchar("department", { length: 100 }),
  email: varchar("email", { length: 255 }),
  emailConfidence: integer("email_confidence"),
  emailVerified: boolean("email_verified").default(false),
  phone: varchar("phone", { length: 50 }),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  enrichmentSources: text("enrichment_sources").array(), // tracks which providers contributed
  enrichedAt: timestamp("enriched_at"),
  // champion tracking
  isChampion: boolean("is_champion").default(false),
  championNotes: text("champion_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// 🔥 INTENT SIGNALS — DIAMOND FEATURE
// ============================================
export const intentSignals = pgTable("intent_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  signalType: signalType("signal_type").notNull(),
  // funding: amount, round, investors. job_change: from_company, from_title, to_title. hiring_spike: roles, count
  payload: jsonb("payload").notNull(),
  source: varchar("source", { length: 50 }).notNull(), // crunchbase, usergems, news_api, internal_scraper
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  // scoring & routing
  signalStrength: integer("signal_strength").notNull(), // 0-100
  freshnessDays: integer("freshness_days"), // signals < 7 days = hot
  acted: boolean("acted").default(false),
  actedAt: timestamp("acted_at"),
});

// ============================================
// 🔥 AGENT RUNS — autonomous SDR loop tracking
// ============================================
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  agentType: varchar("agent_type", { length: 50 }).notNull(), // "researcher", "writer", "responder", "full_sdr"
  targetType: varchar("target_type", { length: 30 }), // "job", "contact", "company"
  targetId: uuid("target_id"),
  status: agentStatus("status").default("idle").notNull(),
  // step-by-step trace for debugging
  steps: jsonb("steps").$type<Array<{ step: string; input: any; output: any; tokens: number; durationMs: number; timestamp: string }>>().default(sql`'[]'::jsonb`),
  totalTokens: integer("total_tokens").default(0),
  totalCreditsCost: decimal("total_credits_cost", { precision: 10, scale: 2 }).default("0"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// OUTREACH — track sent messages (now agent-aware)
// ============================================
export const outreach = pgTable("outreach", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  companyId: uuid("company_id").references(() => companies.id),
  jobId: uuid("job_id").references(() => jobs.id),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id), // null if manual
  signalId: uuid("signal_id").references(() => intentSignals.id), // tied to triggering signal
  subject: varchar("subject", { length: 255 }),
  messageBody: text("message_body"),
  sentVia: varchar("sent_via", { length: 50 }), // "smartlead", "instantly", "postmark", "manual"
  externalMessageId: varchar("external_message_id", { length: 255 }),
  sentAt: timestamp("sent_at"),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
  replied: boolean("replied").default(false),
  bounced: boolean("bounced").default(false),
  outcome: varchar("outcome", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// USAGE LOG — credit metering
// ============================================
export const usageLog = pgTable("usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // "enrich_contact", "agent_run", "intent_lookup", "ai_email"
  creditsCost: decimal("credits_cost", { precision: 10, scale: 2 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// SETTINGS — workspace-level prefs
// ============================================
export const workspaceSettings = pgTable("workspace_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull().unique(),
  // company profile for email personalization
  profileCompanyName: varchar("profile_company_name", { length: 255 }),
  profileWebsite: varchar("profile_website", { length: 500 }),
  profileServices: text("profile_services"),
  profilePitch: text("profile_pitch"),
  profileTone: varchar("profile_tone", { length: 30 }),
  // AI model preference
  preferredAiModel: varchar("preferred_ai_model", { length: 50 }).default("gpt-5"),
  // sending integration
  smartleadApiKey: text("smartlead_api_key_encrypted"),
  instantlyApiKey: text("instantly_api_key_encrypted"),
  defaultSendingProvider: varchar("default_sending_provider", { length: 50 }),
  // filters
  minBudget: integer("min_budget").default(1000),
  qualityFilterEnabled: boolean("quality_filter_enabled").default(false),
  // agent autonomy
  autoAgentEnabled: boolean("auto_agent_enabled").default(false),
  autoAgentDailyLimit: integer("auto_agent_daily_limit").default(20),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// AUDIT LOG — enterprise requirement
// ============================================
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// WEBHOOKS — let users integrate
// ============================================
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  events: text("events").array().notNull(), // ["contact.enriched", "signal.detected", "outreach.replied"]
  secret: varchar("secret", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: integer("last_delivery_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// LOCAL LEADS — kept from v1 (Google Maps imports)
// ============================================
export const localLeads = pgTable("local_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }).notNull(),
  businessName: varchar("business_name", { length: 500 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  website: varchar("website", { length: 500 }),
  phone: varchar("phone", { length: 50 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  industry: varchar("industry", { length: 100 }),
  source: varchar("source", { length: 50 }).notNull(),
  searchQuery: varchar("search_query", { length: 255 }),
  contactEnriched: boolean("contact_enriched").default(false),
  companyId: uuid("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Generate `insertSchema`, `Insert*` and select types for every table using `createInsertSchema` + `z.infer` + `$inferSelect`. Add relations.

---

## 5. Feature Map

### A) KEPT FROM V1 (proven, port over)

1. **Job scrapers (30+ sources)** — port the scraper code:
   - Direct API/HTML: RemoteOK, WeWorkRemotely, Jobicy, Remotive, Himalayas, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, Recruitee, BambooHR, Workable, NoFluffJobs, HackerNews, DevITJobs, SwissDevJobs, BerlinStartupJobs, JustRemote, LaraJobs
   - JobSpy Python microservice: Indeed, LinkedIn, Glassdoor
   - Apify: LinkedIn Jobs, Indeed, Glassdoor, Dice, Monster, Naukri (with key rotation)
   - Upwork: API + Playwright fallback + bookmarklet
2. **Domain resolution** — Serper API with job-aggregator blacklist (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, etc. must be blacklisted)
3. **Job classification** — GPT-5 (default) classifies into CONTRACT, RECRUITING, INTERNAL, COFOUNDER, CONSULTING, PARTNERSHIP, extracts budget/timeline, agency-fit, recruiter-vs-team
4. **Local leads (Google Maps import)**
5. **Auth flows** — login/signup pages, JWT cookie pattern

### B) FIXED FROM V1 (rebuild correctly)

1. **Enrichment is now waterfall + BYOK** — no hardcoded A-Leads. Default waterfall ships preconfigured: Apollo (managed) → Hunter (managed) → Prospeo (managed) → A-Leads (managed) → user can edit. If user adds BYOK keys, those steps switch to BYOK automatically.
2. **API keys encrypted at rest** — use AES-256-GCM with `WORKSPACE_ENCRYPTION_KEY` env var. Never log decrypted keys. UI only shows last 4 chars.
3. **All UUIDs, no serial integers**
4. **Workspaces, not solo users** — every query scopes by `workspaceId`, every API checks `req.user.id` is a member of the requested workspace.
5. **A-Leads usage rules (lessons learned)**:
   - Do NOT pass `job_title` filter
   - Search by domain only
   - Fetch up to 10 contacts per company (not 5)
   - Endpoint: `https://api.a-leads.co/gateway`

### C) 🔥 NEW DIAMOND FEATURES (build these — this is what makes 2.0 worth buying)

#### C1) Intent Signal Engine
- **Funding round signals** — Crunchbase API (or scrape news), detect when target companies raise. Score: Series A = 70, Series B/C = 90, Series D+ = 60.
- **Job change tracking** — when a champion moves companies, signal fires. Use UserGems API or LinkedIn scraping.
- **Hiring spike detection** — if a company posts 3+ jobs in 7 days, signal fires.
- **Tech install signals** — detect when target adopts tools that pair with your offering (use BuiltWith API).
- **Leadership change** — new CXO joins → re-evaluate vendors signal.
- **Signal feed UI** — dedicated `/signals` page, filterable, sortable by strength + freshness, "Act Now" CTA per signal.
- **Signal-triggered automation** — user can configure "When VP Sales joins target account → run full SDR agent".

#### C2) Agentic AI SDR Loop
- **Multi-step agent** — not one-shot email gen. Agent:
  1. Researches account (web, LinkedIn, recent news)
  2. Identifies best decision-maker
  3. Drafts personalized opener referencing the trigger signal
  4. Sends via integrated provider (Smartlead/Instantly)
  5. Monitors for reply, classifies intent
  6. Drafts follow-up or books meeting via Calendly link
- **Trace UI** — every agent run shows step-by-step what the agent did, tokens used, decisions made. Critical for trust.
- **Approval modes** — "fully autonomous", "approve before send", "draft only".
- **Daily safety limits** — never exceed `autoAgentDailyLimit` setting.
- **Use OpenAI Assistants API or LangGraph for the agent loop**

#### C3) Waterfall Enrichment Designer
- **Drag-and-drop UI** at `/settings/waterfall` to order providers
- **Per-step config** — pick BYOK vs managed, set min confidence, set "stop on found"
- **Cost preview** — shows expected credit cost per enrichment based on waterfall config
- **A/B testing** — run two waterfalls side-by-side on a sample, compare hit rate

#### C4) BYOK Key Vault
- `/settings/api-keys` page — add Apollo, Hunter, Prospeo, RocketReach, A-Leads, Anymailfinder, Snov, Clearbit keys
- Test connection button per key
- Auto-rotate on quota exhaustion if multiple keys per provider
- Encrypted at rest, never sent to frontend after save

#### C5) Champion Tracking
- Mark any contact as "champion"
- When champion changes job (via signal engine) → automatic alert + suggested re-engagement campaign at new company
- "Champion graveyard" view — past champions to re-activate

#### C6) Sending Provider Integrations
- **Smartlead integration** — send via user's Smartlead account, sync replies back
- **Instantly integration** — same
- **Postmark fallback** for transactional + low-volume
- Never build a custom SMTP/warmup engine

#### C7) Webhooks API
- User registers webhook URL + events
- Fire on: `contact.enriched`, `signal.detected`, `outreach.opened`, `outreach.replied`, `agent.completed`
- HMAC-signed payloads with `secret`

#### C8) Public REST API
- `/api/v1/*` namespace, API-key authenticated (separate from user JWT)
- Endpoints: list jobs, list contacts, trigger enrichment, fetch signals, run agent
- Rate-limited per workspace plan

#### C9) Analytics Dashboard
- Funnel: scraped → classified → enriched → contacted → replied → meeting → won
- Cohort retention by signal type (do funding-signal contacts convert better?)
- Cost per meeting booked
- Provider performance leaderboard (which enrichment source delivered most replies?)

#### C10) Admin Panel
- `/admin` route, restricted to email allowlist
- Workspace list, plan changes, credit grants, impersonation, usage charts, MRR

---

## 6. Landing Page Spec

**Route:** `/` is the public landing page. Authenticated users at `/` redirect to `/app/dashboard`.

**Tech:** React + Three.js (`@react-three/fiber`, `@react-three/drei`) + Framer Motion + GSAP ScrollTrigger.

**Sections (in order):**

1. **Hero (above fold)** — Dark background, split-screen: oversized headline left ("Turn every new job posting into a booked meeting"), interactive 3D scene right. Scene: animated globe with pulsing dots representing live intent signals; on hover, dot expands to show "Acme Corp just raised $40M Series B". Glow accents in indigo/violet. Single CTA: "Start free → no credit card."
2. **Logo bar** — "Trusted by agencies at" + 6-8 grayscale logos.
3. **Bento grid: features** — 6 cards in asymmetric grid showcasing Intent Signals, Agentic SDR, Waterfall, BYOK, 30+ Scrapers, Champion Tracking. Each card has subtle Framer Motion hover, glassmorphism panel.
4. **Interactive demo** — embedded Guideflow-style click-through of the agent finding a signal → enriching → sending → getting reply.
5. **Comparison table** — vs Apollo, vs Clay, vs Smartlead. Honest checkmarks.
6. **Pricing** — 3 tier cards + "BYOK saves 80%" callout.
7. **Testimonials** — 3 cards (placeholder until real ones).
8. **FAQ accordion** — 8 questions.
9. **CTA footer** — Big "Start free" + email capture.

**Design tokens:**
- Background: `#0a0a0f` (near-black with blue tint)
- Primary: `#6366f1` (indigo-500)
- Accent: `#a78bfa` (violet-400) with glow shadow
- Text: `#fafafa` (near-white) / `#a1a1aa` (zinc-400)
- Glassmorphism: `bg-white/5 backdrop-blur-xl border border-white/10`
- Glow: `shadow-[0_0_60px_rgba(99,102,241,0.4)]`
- Font: Inter for body, **Geist** or **Cal Sans** for display headlines (oversized, tight tracking)

---

## 7. Lessons Learned from V1 (DO NOT REPEAT)

1. **A-Leads mistakes** — never filter by `job_title`, never cap at 5 contacts, always use domain-only search.
2. **Domain resolution traps** — must blacklist job aggregator domains (linkedin.com, indeed.com, glassdoor.com, greenhouse.io, lever.co, ashbyhq.com, smartrecruiters.com, jobvite.com, recruitee.com, bamboohr.com, workable.com) BEFORE writing them into `companies.domain`. Otherwise enrichment finds LinkedIn employees as "decision makers".
3. **Anonymous job posters** — many jobs say "Confidential" or "Stealth Mode". Skip enrichment for these, flag as `companyName IS NULL`.
4. **Multi-tenancy enforcement** — every single SQL query MUST include `workspaceId = $1`. Add a query helper `withWorkspace(workspaceId, query)` to make this impossible to forget. Add an integration test that asserts cross-workspace data leakage is impossible.
5. **OpenAI cost control** — classification ran on every job and got expensive. Only classify on-demand or when user explicitly enables auto-classify. Cache classification results indefinitely.
6. **Pagination from day 1** — v1 loaded all jobs into memory. Use `react-query` with `keepPreviousData` and server-side `LIMIT/OFFSET`.
7. **Settings page chaos** — v1 settings became a mega-form. Split into tabs: Profile, API Keys (BYOK), Waterfall, Sending, Notifications, Billing.
8. **Job-first architecture works** — keep it. Jobs → Companies → Contacts is the right order.

---

## 8. UI/UX Standards

- **shadcn/ui** for every primitive. Don't roll your own buttons.
- **Dark mode default**, light mode toggle. Both fully designed (no afterthought).
- **Theme:** indigo/violet accents on dark base.
- **Icons:** `lucide-react` for actions, `react-icons/si` for brand logos.
- **Sidebar:** persistent left sidebar with sections: Dashboard, Signals, Jobs, Companies, Contacts, Outreach, Agent Runs, Settings, Admin (if admin).
- **Test IDs:** every interactive element gets `data-testid`. Pattern: `{action}-{target}` or `{type}-{content}`. Dynamic: append id, e.g. `card-job-${jobId}`.
- **Empty states:** every list page must have a designed empty state, not just "no data".
- **Loading states:** skeleton loaders, not spinners (except for buttons).
- **Toasts:** `useToast` from `@/hooks/use-toast` for all confirmations/errors.
- **Keyboard:** ⌘K command palette (use `cmdk`) for navigation + actions.

---

## 9. API Integrations Cheat Sheet

| Service | Purpose | Env var | Notes |
|---|---|---|---|
| OpenAI | Classification, agent loop | `OPENAI_API_KEY` | Default model: gpt-5; fallback gpt-4o-mini |
| Anthropic | Alt model | `ANTHROPIC_API_KEY` | claude-opus-4 |
| Stripe | Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Use Replit's Stripe blueprint |
| A-Leads | Managed enrichment | `ALEADS_API_KEY` | Base: `https://api.a-leads.co/gateway`, no title filter |
| Apollo | Managed enrichment | `APOLLO_API_KEY` | |
| Hunter | Managed enrichment | `HUNTER_API_KEY` | |
| Prospeo | Managed enrichment | `PROSPEO_API_KEY` | |
| RocketReach | Managed enrichment | `ROCKETREACH_API_KEY` | |
| Serper | Domain resolution | `SERPER_API_KEY` | Google search wrapper |
| Apify | Job scraping (Apify-based) | per-workspace BYOK | Multi-key rotation |
| Crunchbase | Funding signals | `CRUNCHBASE_API_KEY` | Or use a free news API + parsing |
| BuiltWith | Tech install signals | `BUILTWITH_API_KEY` | |
| UserGems | Job change signals | `USERGEMS_API_KEY` | Or scrape LinkedIn |
| Smartlead | Outbound sending | per-workspace BYOK | |
| Instantly | Outbound sending | per-workspace BYOK | |
| Postmark | Transactional email | `POSTMARK_TOKEN` | Welcome, password reset, alerts |
| Replit DB | PostgreSQL | `DATABASE_URL` | Already provisioned |
| Redis | Job queue | `REDIS_URL` | For BullMQ |

**Encryption:** `WORKSPACE_ENCRYPTION_KEY` (32-byte hex) for AES-256-GCM on all stored API keys.

---

## 10. Build Order (phased — ship usable each phase)

### Phase 0 — Foundation (Week 1)
- Init Vite + Express + Drizzle + shadcn
- Schema migration (all tables above)
- Auth: signup, login, JWT cookies
- Workspace creation on signup (auto-create "Personal" workspace)
- Workspace switcher in sidebar
- Encryption helper for API keys

### Phase 1 — Core port (Week 2)
- Port job scrapers (start with top 10 by volume)
- Domain resolution with blacklist
- Companies + Contacts pages
- Settings tabs (Profile, API Keys with BYOK, Notifications)

### Phase 2 — Enrichment Waterfall (Week 3)
- Waterfall designer UI
- Provider adapters (Apollo, Hunter, Prospeo, A-Leads with v1 fixes)
- BYOK key vault
- Usage logging + credit deduction

### Phase 3 — Diamond #1: Intent Signals (Week 4)
- Crunchbase + news funding poller (cron)
- LinkedIn job-change scraper
- Hiring-spike detector (internal, runs on scraped jobs)
- `/signals` page with filtering
- Signal → automation triggers

### Phase 4 — Diamond #2: Agentic SDR (Week 5)
- LangGraph or OpenAI Assistants integration
- Agent run trace UI
- Smartlead + Instantly integrations for sending
- Reply classification + follow-up generation
- Approval modes

### Phase 5 — Billing & Landing (Week 6)
- Stripe subscription setup, webhook handler
- Customer portal
- Public landing page (Three.js hero, bento, pricing)
- Onboarding wizard after signup

### Phase 6 — Platform (Week 7)
- Webhooks
- Public REST API
- Analytics dashboard
- Admin panel
- ⌘K command palette

### Phase 7 — Polish & Launch
- Empty states, loading states, error boundaries
- E2E tests with Playwright
- Documentation site at `/docs`
- Beta invite flow

---

## 11. What NOT to Build

- ❌ Custom SMTP / warmup infrastructure (use Smartlead/Instantly)
- ❌ Custom CRM (export to user's CRM via webhooks instead)
- ❌ LinkedIn DM automation (against ToS, ban risk)
- ❌ A meetings calendar (use Calendly link in emails)
- ❌ A custom AI training pipeline (use OpenAI/Anthropic APIs)
- ❌ Mobile apps (web-first; mobile responsive is enough)
- ❌ Multi-language i18n (English-only at launch)
- ❌ White-label reseller mode (post-launch)
- ❌ Browser extension (post-launch)

---

## 12. Acceptance Criteria (definition of done for v1.0)

- [ ] User can sign up, create workspace, invite teammates
- [ ] User can connect BYOK keys for at least 4 enrichment providers
- [ ] User can configure a waterfall and run enrichment that respects it
- [ ] User can scrape jobs from at least 10 platforms
- [ ] User sees intent signals from at least 3 sources (funding, job change, hiring spike)
- [ ] User can launch an agent run and see step-by-step trace
- [ ] User can connect Smartlead or Instantly and have agent send through it
- [ ] Stripe subscription works end-to-end (signup → upgrade → cancel)
- [ ] Credit metering blocks actions when balance hits zero
- [ ] Landing page loads <2s, 3D hero runs at 60fps on M1, gracefully degrades on low-end
- [ ] Cross-workspace data leakage is impossible (verified by integration test)
- [ ] All API keys encrypted at rest, never logged
- [ ] All interactive UI has `data-testid`
- [ ] Light + dark modes both fully styled
- [ ] Admin panel restricted to allowlist

---

## 13. Replit-Specific Notes

- Use Replit's PostgreSQL (already provisioned)
- Use Replit's Stripe blueprint for billing setup
- Use Replit's OpenAI blueprint for AI key management
- Workflow: `npm run dev` runs both Express + Vite on same port
- Port: bind to `0.0.0.0:5000` (not localhost)
- Secrets: store in Replit Secrets (env var), never commit
- Deploy: use Replit Reserved VM Deployment for production (always-on)

---

**End of brief.** Build phase 0 first, demo it, then proceed phase by phase. Do not skip ahead. Every phase ships a usable increment.
