import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { companies, contacts, jobs } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, count } from "drizzle-orm";
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

    const industry = req.query.industry as string | undefined;
    const conditions = [eq(companies.workspaceId, wid)];
    if (search) conditions.push(ilike(companies.name, `%${search}%`));
    if (industry) conditions.push(ilike(companies.industry, `%${industry}%`));
    const where = and(...conditions);

    const sort = req.query.sort as string | undefined;
    const orderByClause =
      sort === "oldest" ? companies.createdAt
      : sort === "name" ? asc(companies.name)
      : sort === "contacts" ? sql`(select count(*) from contacts where contacts.company_id = ${companies.id}) desc`
      : desc(companies.createdAt);

    const [rows, countResult] = await Promise.all([
      db.select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
        industry: companies.industry,
        size: companies.size,
        location: companies.location,
        fundingStage: companies.fundingStage,
        fundingTotal: companies.fundingTotal,
        foundedYear: companies.foundedYear,
        techStack: companies.techStack,
        tags: companies.tags,
        linkedinUrl: companies.linkedinUrl,
        description: companies.description,
        workspaceId: companies.workspaceId,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
        contactCount: sql<number>`(select count(*) from contacts where contacts.company_id = ${companies.id})`,
        jobCount: sql<number>`(select count(*) from jobs where jobs.company_id = ${companies.id})`,
      }).from(companies).where(where).orderBy(orderByClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(companies).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    // Count workspace companies that have a domain resolved
    const [withDomainResult] = await db.select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(and(eq(companies.workspaceId, wid), sql`${companies.domain} is not null and ${companies.domain} != ''`));

    res.json({
      companies: rows,
      withDomain: Number(withDomainResult?.count ?? 0),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/export/csv  ← MUST be before /:id
router.get("/export/csv", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const { search, industry } = req.query as Record<string, string>;
    const conditions = [eq(companies.workspaceId, wid)];
    if (search) conditions.push(ilike(companies.name, `%${search}%`));
    if (industry && industry !== "all") conditions.push(ilike(companies.industry, `%${industry}%`));
    const rows = await db.select().from(companies).where(and(...conditions)).orderBy(desc(companies.createdAt)).limit(5000);

    const headers = ["Name", "Domain", "Industry", "Size", "Location", "Funding Stage", "Tech Stack", "Created At"];
    const csvRows = rows.map(r => [
      r.name || "",
      r.domain || "",
      r.industry || "",
      r.size || "",
      r.location || "",
      r.fundingStage || "",
      Array.isArray(r.techStack) ? (r.techStack as string[]).join("; ") : "",
      r.createdAt?.toISOString() || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="companies-${Date.now()}.csv"`);
    res.send(csv);
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

// DELETE /api/companies/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const company = await db.query.companies.findFirst({
      where: and(eq(companies.id, req.params.id), eq(companies.workspaceId, req.user!.workspaceId)),
    });
    if (!company) return res.status(404).json({ error: "Company not found" });
    await db.delete(companies).where(eq(companies.id, req.params.id));
    res.json({ success: true });
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
