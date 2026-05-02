import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { intentSignals, companies, jobs } from "@shared/schema";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
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

    const conditions = [eq(intentSignals.workspaceId, wid)];
    if (type) conditions.push(eq(intentSignals.type, type));
    if (strength) conditions.push(eq(intentSignals.strength, strength));

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(intentSignals).where(where).orderBy(desc(intentSignals.detectedAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(intentSignals).where(where),
    ]);

    res.json({
      signals: rows,
      pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const byType = await db.select({
      type: intentSignals.type,
      count: sql<number>`count(*)`,
      strong: sql<number>`count(*) filter (where strength = 'strong')`,
    }).from(intentSignals).where(eq(intentSignals.workspaceId, wid)).groupBy(intentSignals.type);

    res.json({ byType });
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
