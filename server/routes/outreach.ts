import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { outreach, contacts, jobs, workspaceSettings, workspaceApiKeys } from "@shared/schema";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
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

    const search = req.query.search as string | undefined;
    const jobId = req.query.jobId as string | undefined;
    const conditions = [eq(outreach.workspaceId, wid)];
    if (status) conditions.push(eq(outreach.status, status));
    if (jobId) conditions.push(eq(outreach.jobId, jobId));
    if (search) conditions.push(
      or(ilike(outreach.subject, `%${search}%`), ilike(outreach.body, `%${search}%`))!
    );

    const where = and(...conditions);
    const [rows, countResult] = await Promise.all([
      db.select().from(outreach).where(where).orderBy(desc(outreach.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(outreach).where(where),
    ]);

    // Enrich with contact name + job title/company
    const contactIds = [...new Set(rows.map(r => r.contactId).filter(Boolean))] as string[];
    const jobIds    = [...new Set(rows.map(r => r.jobId).filter(Boolean))] as string[];
    const [contactRows, jobRows] = await Promise.all([
      contactIds.length > 0
        ? db.select({ id: contacts.id, fullName: contacts.fullName, firstName: contacts.firstName, lastName: contacts.lastName })
            .from(contacts).where(sql`id = ANY(${contactIds})`)
        : Promise.resolve([]),
      jobIds.length > 0
        ? db.select({ id: jobs.id, title: jobs.title, companyName: jobs.companyName })
            .from(jobs).where(sql`id = ANY(${jobIds})`)
        : Promise.resolve([]),
    ]);
    const contactMap = Object.fromEntries(contactRows.map(c => [c.id, c]));
    const jobMap     = Object.fromEntries(jobRows.map(j => [j.id, j]));

    const enriched = rows.map(r => {
      const c = r.contactId ? contactMap[r.contactId] : null;
      const j = r.jobId     ? jobMap[r.jobId]         : null;
      return {
        ...r,
        contactName: c ? (c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ")) : null,
        jobTitle:    j?.title    ?? null,
        jobCompany:  j?.companyName ?? null,
      };
    });

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      outreach: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/outreach/export/csv  ← MUST be before /:id
router.get("/export/csv", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const { status, search } = req.query as Record<string, string>;
    const conditions = [eq(outreach.workspaceId, wid)];
    if (status && status !== "all") conditions.push(eq(outreach.status, status));
    if (search) conditions.push(or(ilike(outreach.subject, `%${search}%`), ilike(outreach.body, `%${search}%`))!);
    const rows = await db.select().from(outreach).where(and(...conditions)).orderBy(desc(outreach.createdAt)).limit(5000);

    const headers = ["Subject", "Status", "To Email", "Sent At", "Opened At", "Replied At", "Created At"];
    const csvRows = rows.map(r => [
      r.subject || "",
      r.status || "",
      r.toEmail || "",
      r.sentAt?.toISOString() || "",
      r.openedAt?.toISOString() || "",
      r.repliedAt?.toISOString() || "",
      r.createdAt?.toISOString() || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

    const csv = [headers.join(","), ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="outreach-${Date.now()}.csv"`);
    res.send(csv);
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
          calendarUrl: (settings as any)?.profileCalendarUrl || undefined,
          portfolioUrl: settings?.profilePortfolioUrl || undefined,
          linkedinUrl: settings?.profileLinkedin || undefined,
          tone: settings?.profileTone || "professional",
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
      toEmail: z.string().email().optional(),
      status: z.enum(["draft", "scheduled", "sent"]).default("draft"),
    }).parse(req.body);

    // Auto-populate toEmail from contact if not provided
    let toEmail = data.toEmail;
    if (!toEmail && data.contactId) {
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, data.contactId), eq(contacts.workspaceId, req.user!.workspaceId)),
      });
      if (contact?.email) toEmail = contact.email;
    }

    const [record] = await db.insert(outreach).values({
      workspaceId: req.user!.workspaceId,
      ...data,
      toEmail,
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

// DELETE /api/outreach/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const existing = await db.query.outreach.findFirst({
      where: and(eq(outreach.id, req.params.id), eq(outreach.workspaceId, req.user!.workspaceId)),
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    await db.delete(outreach).where(eq(outreach.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/outreach/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const [byStatus, totals] = await Promise.all([
      db.select({
        status: outreach.status,
        count: sql<number>`count(*)`,
      }).from(outreach).where(eq(outreach.workspaceId, wid)).groupBy(outreach.status),
      db.select({
        sent: sql<number>`count(*) filter (where status in ('sent','opened','replied'))`,
        opened: sql<number>`count(*) filter (where status = 'opened' or status = 'replied')`,
        replied: sql<number>`count(*) filter (where status = 'replied')`,
      }).from(outreach).where(eq(outreach.workspaceId, wid)),
    ]);

    const statusMap = byStatus.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {} as Record<string, number>);
    const sent = Number(totals[0]?.sent ?? 0);
    const opened = Number(totals[0]?.opened ?? 0);
    const replied = Number(totals[0]?.replied ?? 0);

    res.json({
      byStatus: statusMap,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
