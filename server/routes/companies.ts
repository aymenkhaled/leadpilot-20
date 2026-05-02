import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { companies, contacts, jobs } from "@shared/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/companies
router.get("/", async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const search = req.query.search as string | undefined;
    const wid = req.user!.workspaceId;
    const offset = (page - 1) * limit;

    const where = search
      ? and(eq(companies.workspaceId, wid), ilike(companies.name, `%${search}%`))
      : eq(companies.workspaceId, wid);

    const [rows, countResult] = await Promise.all([
      db.select().from(companies).where(where).orderBy(desc(companies.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(companies).where(where),
    ]);

    res.json({
      companies: rows,
      pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, req.params.id), eq(companies.workspaceId, req.user!.workspaceId)),
    });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const [compContacts, compJobs] = await Promise.all([
      db.select().from(contacts).where(and(eq(contacts.companyId, company.id), eq(contacts.workspaceId, req.user!.workspaceId))),
      db.select().from(jobs).where(and(eq(jobs.companyId, company.id), eq(jobs.workspaceId, req.user!.workspaceId))).limit(10),
    ]);

    res.json({ company, contacts: compContacts, jobs: compJobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/companies/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, req.params.id), eq(companies.workspaceId, req.user!.workspaceId)),
    });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const [updated] = await db.update(companies)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(companies.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
