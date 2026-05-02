# LeadPilot 2.0 — Starter Pack

> **Read this before writing any scraper, enrichment, classification, or domain-resolution code.** Every file here is battle-tested production code from LeadPilot v1. Port these instead of rebuilding — they handle real edge cases that took weeks to discover.

---

## How to use this pack

1. Read `../BRIEF.md` first for the overall architecture and product vision.
2. When the brief says "build feature X", check this pack first. If a relevant file exists here, **port it** to the new architecture (UUID IDs, `workspaceId` instead of `userId`, encrypted API keys) — don't rewrite from scratch.
3. Treat this code as a reference implementation, not a drop-in. The new project uses workspaces, UUIDs, BYOK, and credit metering — adapt accordingly.

---

## Folder index

### `enrichment/` — Contact enrichment providers

| File | What it does | Notes for porting |
|---|---|---|
| `aleads.ts` | A-Leads API wrapper (primary contact source in v1) | **Already contains the v1 fixes**: no `job_title` filter, fetches up to 10 contacts, domain-only search. Endpoint: `https://api.a-leads.co/gateway`. In v2: convert from hardcoded service to one provider in the waterfall. |
| `prospeo.ts` | Prospeo API wrapper | Email finding + verification |
| `rocketreach.ts` | RocketReach wrapper | Last-resort email enrichment |
| `decision-maker-finder.ts` | Filters/ranks contacts to find decision makers | Title-based scoring logic |
| `enrichment-orchestrator.ts` | The v1 hardcoded waterfall | **In v2 this becomes user-configurable.** Use the logic but read provider order from `waterfallConfigs` table. |

### `scrapers/` — Job scraping infrastructure

| File | What it does | Notes for porting |
|---|---|---|
| `job-scraper.ts` (4,800+ lines) | The mega-file. Contains 27+ direct scrapers: RemoteOK, WeWorkRemotely, Jobicy, Remotive, Himalayas, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, Recruitee, BambooHR, Workable, NoFluffJobs, HackerNews, DevITJobs, SwissDevJobs, BerlinStartupJobs, JustRemote, LaraJobs | **Split into one file per scraper** in v2 (`scrapers/remoteok.ts`, etc) for maintainability. Each function is independent and lifts cleanly. |
| `apify.ts` | Apify-based scrapers (LinkedIn, Indeed, Glassdoor, Dice, Monster, Naukri) with multi-key rotation | Multi-key rotation logic is critical — preserve it. Each workspace brings its own Apify keys (BYOK). |
| `upwork-scraper.ts` | Upwork: API + Playwright stealth fallback + manual bookmarklet | Triple fallback chain, all three methods battle-tested |
| `playwright-scraper.ts` | Playwright stealth wrapper used by Upwork + others | Stealth config + selectors |
| `google-maps-scraper.ts` | Local business import via Google Maps | Powers the "Local Leads" feature |
| `website-scraper.ts` | Generic site scraping for company emails/contacts | Used as last resort in enrichment |

### `domain-resolution/` — Resolving company domains from job posts

| File | What it does | Notes for porting |
|---|---|---|
| `domain-resolver.ts` | Resolves company domain via Serper (Google search). **Contains the job-aggregator blacklist** — LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Ashby, etc. **Critical:** never write blacklisted domains into the `companies` table. | Port the blacklist exactly. Add new ones if you find them. |
| `ai-company-extractor.ts` | When the job description mentions the company by name but no link, use OpenAI to extract it | Fallback when Serper fails |

### `ai-prompts/` — Battle-tested prompts (this is gold)

| File | What it does | Notes for porting |
|---|---|---|
| `job-classifier.ts` | GPT prompt that classifies into CONTRACT/RECRUITING/INTERNAL/COFOUNDER/CONSULTING/PARTNERSHIP, extracts budget/timeline, agency-fit, recruiter-vs-team | **Reuse the prompts as-is.** They were tuned on hundreds of real jobs. Just swap model from `gpt-4o-mini` to `gpt-5`. |
| `email-generator.ts` | AI-personalized cold email generator | Tone control, anti-AI-detector phrasing |
| `pitch-generator.ts` | Generates a pitch from company profile + target context | Used by email-generator |
| `profile-extractor.ts` | Extracts user's company profile from website/CV upload | Onboarding helper |
| `opportunity-scorer.ts` | Scores jobs 0-100 for opportunity quality | Heuristic + AI hybrid |
| `linkedin-finder.ts` | Finds LinkedIn URLs for contacts | Search-based |

### `email/` — Email sending, validation, deliverability

| File | What it does | Notes for porting |
|---|---|---|
| `email-sender.ts` | Direct SMTP sending wrapper | **In v2: replace with Smartlead/Instantly integration.** Keep this only for transactional fallback. |
| `email-pattern.ts` | Pattern-based email guessing (firstname.lastname@domain etc) | Free fallback when APIs fail |
| `email-pattern-guesser.ts` | Smarter pattern detection from known emails | |
| `email-validator.ts` | Format + MX validation | |
| `smtp-verifier.ts` | SMTP-level email verification (catches catch-all domains) | Useful but slow — use selectively |

### `python-jobspy/` — Python microservice for LinkedIn/Indeed/Glassdoor

| File | What it does |
|---|---|
| `app.py` / `jobspy_service.py` | Flask wrapper around `python-jobspy` library — the only reliable way to scrape Indeed + Glassdoor at scale |
| `run.sh` | Startup script |
| `requirements.txt` | Python deps |

In v2, run this as a separate Replit service or a sidecar process. The Node backend HTTP-calls it.

### `reference/` — v1 architecture for context only

| File | Purpose |
|---|---|
| `v1-schema.ts` | The full v1 Drizzle schema. **Do not copy** — v2 has a new schema in BRIEF.md. Use this only to compare and confirm you've covered every field. |
| `v1-auth.ts` | JWT cookie auth pattern. Keep the same approach in v2 (works well). |

---

## What's NOT in this pack (intentionally)

- Frontend React components — v2 has a new design system, rebuild fresh
- Routes/storage — v2 has a new schema, rebuild
- Settings page — was a mega-form in v1, v2 splits into tabs
- The "internal tool" admin — v2 builds a proper admin panel

---

## Order of porting (matches BRIEF.md phases)

| Phase | Files to port |
|---|---|
| Phase 1 (Core port) | `scrapers/job-scraper.ts` (top 10 scrapers), `domain-resolution/*`, `ai-prompts/job-classifier.ts` |
| Phase 2 (Waterfall) | `enrichment/aleads.ts`, `enrichment/prospeo.ts`, `enrichment/rocketreach.ts`, `email/email-pattern*.ts` |
| Phase 3 (Intent signals) | None — net new |
| Phase 4 (Agentic SDR) | `ai-prompts/email-generator.ts`, `ai-prompts/pitch-generator.ts` for the writer step |
| Phase 5+ | Remaining scrapers, `email/smtp-verifier.ts`, `ai-prompts/opportunity-scorer.ts` |

---

## Critical "do not repeat" reminders

1. **A-Leads:** never `job_title` filter, fetch ≥10 contacts, domain-only search.
2. **Domain resolver blacklist:** keep it complete — every aggregator domain must be filtered before saving to `companies`.
3. **OpenAI cost:** classification was triggered automatically in v1 and got expensive. In v2: only on-demand or when explicitly enabled.
4. **Multi-tenancy:** v1 used `userId`. **v2 uses `workspaceId` everywhere.** Replace as you port.
5. **API keys:** v1 stored as plain varchar. **v2 must encrypt at rest.** Use the `encrypt()`/`decrypt()` helpers from BRIEF.md.
