import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { jobs, companies, contacts } from "@shared/schema";
import { eq, and, desc, ilike, or, sql, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

const listQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(25),
  status: z.string().optional(),
  platform: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "oldest", "score", "budget"]).default("newest"),
});

// GET /api/jobs
router.get("/", async (req: AuthRequest, res) => {
  try {
    const q = listQuerySchema.parse(req.query);
    const wid = req.user!.workspaceId;
    const offset = (q.page - 1) * q.limit;

    const conditions = [eq(jobs.workspaceId, wid)];
    if (q.status) conditions.push(eq(jobs.status, q.status));
    if (q.platform) conditions.push(eq(jobs.platform, q.platform));
    if (q.search) {
      conditions.push(
        or(
          ilike(jobs.title, `%${q.search}%`),
          ilike(jobs.companyName, `%${q.search}%`),
          ilike(jobs.description, `%${q.search}%`)
        )!
      );
    }

    const orderBy =
      q.sort === "oldest" ? jobs.discoveredAt
        : q.sort === "score" ? jobs.opportunityScore
          : q.sort === "budget" ? jobs.budgetMax
            : desc(jobs.discoveredAt);

    const [rows, countResult] = await Promise.all([
      db.select().from(jobs).where(and(...conditions))
        .orderBy(typeof orderBy === "object" && "column" in orderBy ? orderBy : desc(jobs.discoveredAt))
        .limit(q.limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(and(...conditions)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      jobs: rows,
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.id), eq(jobs.workspaceId, req.user!.workspaceId)),
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Fetch related company and contacts
    const [company, jobContacts] = await Promise.all([
      job.companyId
        ? db.query.companies.findFirst({ where: eq(companies.id, job.companyId!) })
        : Promise.resolve(null),
      db.select().from(contacts).where(
        and(eq(contacts.jobId, job.id), eq(contacts.workspaceId, req.user!.workspaceId))
      ),
    ]);

    res.json({ job, company, contacts: jobContacts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const createJobSchema = z.object({
  platform: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  companyName: z.string().optional(),
  companyDomain: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  budgetType: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  skills: z.array(z.string()).optional(),
});

// POST /api/jobs
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = createJobSchema.parse(req.body);
    const [job] = await db.insert(jobs).values({
      workspaceId: req.user!.workspaceId,
      ...data,
      skills: data.skills || [],
    }).returning();
    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.id), eq(jobs.workspaceId, req.user!.workspaceId)),
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const [updated] = await db.update(jobs)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(jobs.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.id), eq(jobs.workspaceId, req.user!.workspaceId)),
    });
    if (!job) return res.status(404).json({ error: "Job not found" });

    await db.delete(jobs).where(eq(jobs.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/bulk-delete
router.post("/bulk-delete", async (req: AuthRequest, res) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);
    await db.delete(jobs).where(
      and(inArray(jobs.id, ids), eq(jobs.workspaceId, req.user!.workspaceId))
    );
    res.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/stats/overview
router.get("/stats/overview", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const [total, byStatus, byPlatform] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.workspaceId, wid)),
      db.select({ status: jobs.status, count: sql<number>`count(*)` })
        .from(jobs).where(eq(jobs.workspaceId, wid)).groupBy(jobs.status),
      db.select({ platform: jobs.platform, count: sql<number>`count(*)` })
        .from(jobs).where(eq(jobs.workspaceId, wid)).groupBy(jobs.platform)
        .limit(10),
    ]);

    res.json({
      total: Number(total[0]?.count ?? 0),
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}),
      byPlatform: byPlatform.map(r => ({ platform: r.platform, count: Number(r.count) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
