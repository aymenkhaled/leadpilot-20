import { Router } from "express";
import { db } from "../db.js";
import { jobs, contacts, companies, outreach, agentRuns, intentSignals, usageLog, workspaces } from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/analytics/dashboard
router.get("/dashboard", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      jobStats,
      contactStats,
      companyStats,
      outreachStats,
      signalStats,
      agentStats,
      pipelineStats,
      recentJobs,
      recentSignals,
      recentOutreach,
      funnelData,
      creditUsage,
      workspace,
    ] = await Promise.all([
      // Job counts
      db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.workspaceId, wid)),
      // Contact counts
      db.select({ count: sql<number>`count(*)`, verified: sql<number>`count(*) filter (where email_verified = true)` })
        .from(contacts).where(eq(contacts.workspaceId, wid)),
      // Company counts
      db.select({ count: sql<number>`count(*)` }).from(companies).where(eq(companies.workspaceId, wid)),
      // Outreach stats
      db.select({
        count: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where status = 'sent')`,
        opened: sql<number>`count(*) filter (where status = 'opened')`,
        replied: sql<number>`count(*) filter (where status = 'replied')`,
      }).from(outreach).where(eq(outreach.workspaceId, wid)),
      // Signal counts
      db.select({ count: sql<number>`count(*)`, strong: sql<number>`count(*) filter (where strength = 'strong')` })
        .from(intentSignals).where(eq(intentSignals.workspaceId, wid)),
      // Agent run counts
      db.select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
      }).from(agentRuns).where(eq(agentRuns.workspaceId, wid)),
      // Won jobs and pipeline value
      db.select({
        won: sql<number>`count(*) filter (where status = 'won')`,
        active: sql<number>`count(*) filter (where status not in ('won','lost'))`,
        budgetSum: sql<number>`coalesce(sum(budget_max) filter (where status not in ('won','lost')), 0)`,
      }).from(jobs).where(eq(jobs.workspaceId, wid)),
      // Recent jobs
      db.select().from(jobs).where(eq(jobs.workspaceId, wid)).orderBy(desc(jobs.discoveredAt)).limit(5),
      // Recent signals
      db.select().from(intentSignals).where(eq(intentSignals.workspaceId, wid)).orderBy(desc(intentSignals.detectedAt)).limit(5),
      // Recent outreach
      db.select({
        id: outreach.id,
        subject: outreach.subject,
        status: outreach.status,
        sentAt: outreach.sentAt,
        createdAt: outreach.createdAt,
      }).from(outreach).where(eq(outreach.workspaceId, wid)).orderBy(desc(outreach.createdAt)).limit(5),
      // Funnel
      db.select({ status: jobs.status, count: sql<number>`count(*)` })
        .from(jobs).where(eq(jobs.workspaceId, wid)).groupBy(jobs.status),
      // Credits used this month
      db.select({ total: sql<number>`coalesce(sum(credits_used::numeric), 0)` })
        .from(usageLog).where(and(eq(usageLog.workspaceId, wid), gte(usageLog.createdAt, thirtyDaysAgo))),
      // Workspace (for credit balance)
      db.query.workspaces.findFirst({ where: eq(workspaces.id, wid) }),
    ]);

    const funnel = {
      new: 0, classified: 0, enriched: 0, pitched: 0, replied: 0, won: 0, lost: 0,
    };
    funnelData.forEach(r => { (funnel as any)[r.status] = Number(r.count); });

    res.json({
      jobs: { total: Number(jobStats[0]?.count ?? 0) },
      contacts: {
        total: Number(contactStats[0]?.count ?? 0),
        verified: Number(contactStats[0]?.verified ?? 0),
      },
      companies: { total: Number(companyStats[0]?.count ?? 0) },
      outreach: {
        total: Number(outreachStats[0]?.count ?? 0),
        sent: Number(outreachStats[0]?.sent ?? 0),
        opened: Number(outreachStats[0]?.opened ?? 0),
        replied: Number(outreachStats[0]?.replied ?? 0),
        openRate: outreachStats[0]?.sent > 0
          ? Math.round((Number(outreachStats[0]?.opened) / Number(outreachStats[0]?.sent)) * 100)
          : 0,
        replyRate: outreachStats[0]?.sent > 0
          ? Math.round((Number(outreachStats[0]?.replied) / Number(outreachStats[0]?.sent)) * 100)
          : 0,
      },
      signals: {
        total: Number(signalStats[0]?.count ?? 0),
        strong: Number(signalStats[0]?.strong ?? 0),
      },
      agent: {
        total: Number(agentStats[0]?.total ?? 0),
        completed: Number(agentStats[0]?.completed ?? 0),
      },
      pipeline: {
        won: Number(pipelineStats[0]?.won ?? 0),
        active: Number(pipelineStats[0]?.active ?? 0),
        budgetSum: Number(pipelineStats[0]?.budgetSum ?? 0),
      },
      funnel,
      credits: {
        balance: parseFloat(workspace?.credits?.toString() ?? "0"),
        usedThisMonth: Number(creditUsage[0]?.total ?? 0),
        plan: workspace?.plan ?? "free",
      },
      recent: { jobs: recentJobs, signals: recentSignals, outreach: recentOutreach },
    });
  } catch (err: any) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/jobs-over-time
router.get("/jobs-over-time", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const rows = await db.select({
      date: sql<string>`date_trunc('day', discovered_at)::date`,
      count: sql<number>`count(*)`,
    }).from(jobs)
      .where(and(eq(jobs.workspaceId, wid), gte(jobs.discoveredAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))))
      .groupBy(sql`date_trunc('day', discovered_at)::date`)
      .orderBy(sql`date_trunc('day', discovered_at)::date`);

    res.json(rows.map(r => ({ date: r.date, count: Number(r.count) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/outreach-over-time
router.get("/outreach-over-time", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const rows = await db.select({
      date: sql<string>`date_trunc('day', sent_at)::date`,
      count: sql<number>`count(*)`,
      replied: sql<number>`count(*) filter (where status = 'replied')`,
    }).from(outreach)
      .where(and(
        eq(outreach.workspaceId, wid),
        gte(outreach.sentAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(sql`date_trunc('day', sent_at)::date`)
      .orderBy(sql`date_trunc('day', sent_at)::date`);

    res.json(rows.map(r => ({ date: r.date, sent: Number(r.count), replied: Number(r.replied) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/credits-over-time
router.get("/credits-over-time", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const rows = await db.select({
      date: sql<string>`date_trunc('day', created_at)::date`,
      credits: sql<number>`coalesce(sum(credits_used::numeric), 0)`,
    }).from(usageLog)
      .where(and(
        eq(usageLog.workspaceId, wid),
        gte(usageLog.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .groupBy(sql`date_trunc('day', created_at)::date`)
      .orderBy(sql`date_trunc('day', created_at)::date`);

    res.json(rows.map(r => ({ date: r.date, credits: Number(r.credits) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/top-companies
router.get("/top-companies", async (req: AuthRequest, res) => {
  try {
    const wid = req.user!.workspaceId;
    const rows = await db.select({
      companyName: jobs.companyName,
      companyDomain: jobs.companyDomain,
      jobCount: sql<number>`count(distinct ${jobs.id})`,
      contactCount: sql<number>`count(distinct ${contacts.id})`,
    })
      .from(jobs)
      .leftJoin(contacts, and(eq(contacts.workspaceId, wid), eq(contacts.companyName, jobs.companyName)))
      .where(and(eq(jobs.workspaceId, wid), sql`${jobs.companyName} is not null`))
      .groupBy(jobs.companyName, jobs.companyDomain)
      .orderBy(sql`count(distinct ${jobs.id}) desc`)
      .limit(10);

    res.json(rows.map(r => ({
      name: r.companyName,
      domain: r.companyDomain,
      jobCount: Number(r.jobCount),
      contactCount: Number(r.contactCount),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
