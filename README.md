# LeadPilot 2.0 — B2B Prospecting Workspace

A full-stack prospecting product workspace focused on turning business signals into researchable leads and managed outreach. The repository includes both implementation code and a detailed build brief.

## Product concept
The [build brief](BRIEF.md) describes a planned signal-first B2B prospecting platform for agencies, independent professionals, and sales teams. **The specification describes goals, not a guarantee that all proposed features are implemented.**

## Tech stack
- React, Vite, and TypeScript
- Node.js server
- Drizzle ORM
- Background-job / integration-related dependencies

## Layout
- `client/` — user interface
- `server/` — backend
- `shared/` — shared models
- `STARTER_PACK/` — reference and reusable components
- `BRIEF.md` and `DESIGN_BRIEF.md` — product planning

## Local development
```bash
npm install
npm run dev
```

Additional commands:

```bash
npm run build
npm start
```

Database schema work is exposed through `npm run db:push`; inspect and back up your target database before running that command. External integrations require their own local settings.

## Status
Product prototype/in development. Respect prospect consent, privacy requirements, provider policies, and rate limits when testing lead collection or outreach flows.
