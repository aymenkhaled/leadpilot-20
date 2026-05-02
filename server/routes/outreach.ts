import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { outreach, contacts, jobs, workspaceSettings, workspaceApiKeys } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";
import { decryptApiKey } from "../crypto.js";

const router = Router();
router.use(requireAuth);

// GET /api/outreach
router.get("/", async (req: AuthRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const status = req.query.status as string | undefined;
    const wid = req.user!.workspaceId;
    const offset = (page - 1) * limit;

    const conditions = [eq(outreach.workspaceId, wid)];
    if (status) conditions.push(eq(outreach.status, status));

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(outreach).where(where).orderBy(desc(outreach.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(outreach).where(where),
    ]);

    res.json({
      outreach: rows,
      pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/outreach/generate
router.post("/generate", async (req: AuthRequest, res) => {
  try {
    const { jobId, contactId } = z.object({
      jobId: z.string().uuid(),
      contactId: z.string().uuid(),
    }).parse(req.body);

    const wid = req.user!.workspaceId;

    const [job, contact, settings] = await Promise.all([
      db.query.jobs.findFirst({ where: and(eq(jobs.id, jobId), eq(jobs.workspaceId, wid)) }),
      db.query.contacts.findFirst({ where: and(eq(contacts.id, contactId), eq(contacts.workspaceId, wid)) }),
      db.query.workspaceSettings.findFirst({ where: eq(workspaceSettings.workspaceId, wid) }),
    ]);

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    // Try to generate with AI if configured
    let subject = `Re: ${job.title}`;
    let body = `Hi ${contact.firstName || "there"},\n\nI came across your ${job.title} posting at ${job.companyName || "your company"} and wanted to reach out.\n\n${settings?.profilePitch || "I'd love to discuss how I can help."}\n\nWould you have 15 minutes to chat?\n\n${settings?.profileCompanyName || ""}`;

    // Use OpenAI if key available
    try {
      const openaiKey = await db.query.workspaceApiKeys.findFirst({
        where: and(eq(workspaceApiKeys.workspaceId, wid), eq(workspaceApiKeys.provider, "openai"), eq(workspaceApiKeys.isActive, true)),
      });

      if (openaiKey) {
        const apiKey = decryptApiKey(openaiKey.keyEncrypted, openaiKey.keyIv, openaiKey.keyTag);
        const { PitchGenerator } = await import("../services/pitch-generator.js");
        const gen = new PitchGenerator();
        gen.setApiKey(apiKey);
        const result = await gen.generatePitch(job as any, contact as any, null, {
          senderName: settings?.profileCompanyName || "Your Team",
          senderCompany: settings?.profileCompanyName || "",
          services: settings?.profileServices || undefined,
          pitch: settings?.profilePitch || undefined,
        });
        subject = result.subject;
        body = result.body;
      }
    } catch (aiErr) {
      console.warn("AI generation failed, using fallback:", aiErr);
    }

    res.json({ subject, body });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/outreach
router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      jobId: z.string().uuid().optional(),
      contactId: z.string().uuid().optional(),
      subject: z.string(),
      body: z.string(),
      status: z.enum(["draft", "scheduled", "sent"]).default("draft"),
    }).parse(req.body);

    const [record] = await db.insert(outreach).values({
      workspaceId: req.user!.workspaceId,
      ...data,
    }).returning();

    res.status(201).json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/outreach/:id
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const [updated] = await db.update(outreach)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(outreach.id, req.params.id), eq(outreach.workspaceId, req.user!.workspaceId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/outreach/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const byStatus = await db.select({
      status: outreach.status,
      count: sql<number>`count(*)`,
    }).from(outreach).where(eq(outreach.workspaceId, wid)).groupBy(outreach.status);

    res.json({ byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
