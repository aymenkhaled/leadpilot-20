import { Router } from "express";
import { db } from "../db.js";
import { jobs, contacts, companies } from "@shared/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/search?q=... — global cross-entity search
router.get("/", async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    const wid = req.user!.workspaceId;

    if (!q || q.length < 2) {
      return res.json({ jobs: [], contacts: [], companies: [] });
    }

    const pattern = `%${q}%`;

    const [jobRows, contactRows, companyRows] = await Promise.all([
      db.select({
        id: jobs.id,
        title: jobs.title,
        companyName: jobs.companyName,
        platform: jobs.platform,
        status: jobs.status,
        opportunityScore: jobs.opportunityScore,
      })
        .from(jobs)
        .where(and(
          eq(jobs.workspaceId, wid),
          or(ilike(jobs.title, pattern), ilike(jobs.companyName, pattern))!
        ))
        .limit(8),

      db.select({
        id: contacts.id,
        fullName: contacts.fullName,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        title: contacts.title,
        emailVerified: contacts.emailVerified,
      })
        .from(contacts)
        .where(and(
          eq(contacts.workspaceId, wid),
          or(
            ilike(contacts.fullName, pattern),
            ilike(contacts.email, pattern),
            ilike(contacts.title, pattern)
          )!
        ))
        .limit(8),

      db.select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
        industry: companies.industry,
        size: companies.size,
      })
        .from(companies)
        .where(and(
          eq(companies.workspaceId, wid),
          or(ilike(companies.name, pattern), ilike(companies.domain, pattern))!
        ))
        .limit(6),
    ]);

    res.json({ jobs: jobRows, contacts: contactRows, companies: companyRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
