import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { intentSignals, companies, jobs } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/signals
router.get("/", async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const type = req.query.type as string | undefined;
    const strength = req.query.strength as string | undefined;
    const wid = req.user!.workspaceId;
    const offset = (page - 1) * limit;

    const search = req.query.search as string | undefined;
    const conditions = [eq(intentSignals.workspaceId, wid)];
    if (type) conditions.push(eq(intentSignals.type, type));
    if (strength) conditions.push(eq(intentSignals.strength, strength));
    if (search) conditions.push(
      or(ilike(intentSignals.title, `%${search}%`), ilike(intentSignals.description, `%${search}%`), ilike(intentSignals.sourceName, `%${search}%`))!
    );

    const sort = req.query.sort as string | undefined;
    const orderByClause = sort === "oldest"
      ? asc(intentSignals.detectedAt)
      : sort === "strength"
        ? sql`case strength when 'strong' then 0 when 'moderate' then 1 else 2 end`
        : desc(intentSignals.detectedAt);

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(intentSignals).where(where).orderBy(orderByClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(intentSignals).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      signals: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const [byType, unactedResult] = await Promise.all([
      db.select({
        type: intentSignals.type,
        count: sql<number>`count(*)`,
        strong: sql<number>`count(*) filter (where strength = 'strong')`,
      }).from(intentSignals).where(eq(intentSignals.workspaceId, wid)).groupBy(intentSignals.type),
      db.select({ count: sql<number>`count(*)` })
        .from(intentSignals)
        .where(and(eq(intentSignals.workspaceId, wid), sql`${intentSignals.actedOnAt} is null`)),
    ]);

    res.json({ byType, unacted: Number(unactedResult[0]?.count ?? 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/export/csv  ← MUST be before /:id
router.get("/export/csv", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const { type, strength, search } = req.query as Record<string, string>;
    const conditions = [eq(intentSignals.workspaceId, wid)];
    if (type && type !== "all") conditions.push(eq(intentSignals.type, type));
    if (strength && strength !== "all") conditions.push(eq(intentSignals.strength, strength));
    if (search) conditions.push(or(ilike(intentSignals.title, `%${search}%`), ilike(intentSignals.description, `%${search}%`))!);
    const rows = await db.select().from(intentSignals).where(and(...conditions)).orderBy(desc(intentSignals.detectedAt)).limit(5000);

    const headers = ["Title", "Type", "Strength", "Source", "Source URL", "Company", "Acted On", "Detected At"];
    const csvRows = rows.map(r => [
      r.title || "",
      r.type || "",
      r.strength || "",
      r.sourceName || "",
      r.sourceUrl || "",
      r.companyId || "",
      r.actedOnAt ? "yes" : "no",
      r.detectedAt?.toISOString() || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="signals-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signals (manual create)
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      type: z.string(),
      title: z.string(),
      description: z.string().optional(),
      strength: z.enum(["weak", "moderate", "strong"]).default("moderate"),
      companyId: z.string().uuid().optional(),
      jobId: z.string().uuid().optional(),
      sourceUrl: z.string().optional(),
      sourceName: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    }).parse(req.body);

    const [signal] = await db.insert(intentSignals).values({
      workspaceId: req.user!.workspaceId,
      ...data,
    }).returning();

    res.status(201).json(signal);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/signals/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await db.query.intentSignals.findFirst({
      where: and(eq(intentSignals.id, req.params.id), eq(intentSignals.workspaceId, req.user!.workspaceId)),
    });
    if (!existing) return res.status(404).json({ error: "Signal not found" });
    await db.delete(intentSignals).where(eq(intentSignals.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signals/bulk-act  ← must be before /:id
router.post("/bulk-act", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const result = await db.update(intentSignals)
      .set({ actedOnAt: new Date() })
      .where(and(eq(intentSignals.workspaceId, wid), sql`${intentSignals.actedOnAt} is null`))
      .returning({ id: intentSignals.id });
    res.json({ success: true, updated: result.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/signals/:id/act
router.post("/:id/act", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(intentSignals)
      .set({ actedOnAt: new Date() })
      .where(and(eq(intentSignals.id, req.params.id), eq(intentSignals.workspaceId, req.user!.workspaceId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Signal not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
